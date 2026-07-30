import {
  durableJobSchema,
  queueNames,
  stableIdempotencyKey,
  type DurableJob,
  type QueueName,
} from "@aether/backend";
import {
  Injectable,
  Inject,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import type { Connection } from "mongoose";
import { ExecutionProcessor } from "./execution/execution-processor";
import { MongoWorkerStore } from "./persistence/mongo-worker-store";
import { CHAIN_READER, KEEPER_HUB, SIMULATOR } from "./providers/providers";
import type {
  ChainReader,
  KeeperHubProvider,
  Simulator,
} from "@aether/backend";

@Injectable()
export class WorkerRuntime
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly redis: IORedis;
  private readonly queues = new Map<QueueName, Queue>();
  private readonly workers: Worker[] = [];
  private outboxTimer?: NodeJS.Timeout;
  private readonly processor: ExecutionProcessor;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly store: MongoWorkerStore,
    @Inject(KEEPER_HUB) keeperHub: KeeperHubProvider,
    @Inject(CHAIN_READER) chainReader: ChainReader,
    @Inject(SIMULATOR) simulator: Simulator,
  ) {
    this.redis = new IORedis(
      process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
      {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      },
    );
    this.processor = new ExecutionProcessor(
      store,
      keeperHub,
      chainReader,
      simulator,
    );
  }

  async onApplicationBootstrap() {
    for (const name of queueNames) {
      this.queues.set(
        name,
        new Queue(name, {
          connection: this.redis,
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: "exponential", delay: 1_000 },
            removeOnComplete: 1_000,
            removeOnFail: 5_000,
          },
        }),
      );
    }
    this.store.setQueues(this.queues);
    for (const name of queueNames) {
      this.workers.push(
        new Worker(name, async (job) => this.process(name, job), {
          connection: this.redis,
          concurrency: name === "execution.submit" ? 1 : 5,
        }),
      );
    }
    await this.publishOutbox();
    this.outboxTimer = setInterval(() => void this.publishOutbox(), 1_000);
  }

  private async process(name: QueueName, job: Job) {
    const data = durableJobSchema.parse(job.data);
    switch (name) {
      case "operation.simulate":
        return this.processor.simulate(data);
      case "execution.submit":
        return this.processor.submit(data);
      case "execution.reconcile":
        return this.processor.reconcile(data);
      case "execution.verify":
        return this.processor.verify(data);
      case "observation.scan":
      case "drift.evaluate":
      case "audit.dispatch":
        return {
          status: "completed",
          queue: name,
          resourceId: data.resourceId,
        };
    }
  }

  private async publishOutbox() {
    const collection = this.connection.collection("outbox_events");
    const events = await collection
      .find({
        publishedAt: { $exists: false },
        queueName: { $in: [...queueNames] },
      })
      .sort({ sequence: 1 })
      .limit(100)
      .toArray();
    for (const event of events) {
      const queueName = event.queueName as QueueName;
      const queue = this.queues.get(queueName);
      if (!queue) continue;
      const payload = event.payload as Record<string, unknown>;
      const data: DurableJob = durableJobSchema.parse({
        organizationId: event.organizationId,
        protocolId: event.protocolId,
        resourceId: event.resourceId,
        idempotencyKey:
          payload.idempotencyKey ??
          stableIdempotencyKey(String(event.eventId), queueName),
        correlationId: payload.correlationId ?? String(event.eventId),
      });
      await queue.add(queueName, data, {
        jobId: data.idempotencyKey,
      });
      await collection.updateOne(
        { _id: event._id, publishedAt: { $exists: false } },
        {
          $set: { publishedAt: new Date() },
          $inc: { attempts: 1 },
        },
      );
    }
  }

  async onApplicationShutdown() {
    if (this.outboxTimer) clearInterval(this.outboxTimer);
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    await this.redis.quit();
  }
}
