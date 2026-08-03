import {
  durableJobSchema,
  queueNames,
  redact,
  stableIdempotencyKey,
  arcadiaTopics,
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
import { randomUUID } from "node:crypto";
import type { Connection } from "mongoose";
import { ExecutionProcessor } from "./execution/execution-processor";
import { MongoWorkerStore } from "./persistence/mongo-worker-store";
import {
  CHAIN_READER,
  INVESTIGATION_ASSISTANT,
  KEEPER_HUB,
  SIMULATOR,
} from "./providers/providers";
import type {
  ChainReader,
  InvestigationAssistant,
  KeeperHubProvider,
  Simulator,
} from "@aether/backend";
import { activeLiveChain } from "@aether/shared";

@Injectable()
export class WorkerRuntime
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly redis: IORedis;
  private readonly queues = new Map<QueueName, Queue>();
  private readonly workers: Worker[] = [];
  private outboxTimer?: NodeJS.Timeout;
  private readonly processor: ExecutionProcessor;
  private readonly chainReader: ChainReader;
  private readonly investigationAssistant: InvestigationAssistant;
  private readonly rpcLogBlockRange: number;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly store: MongoWorkerStore,
    @Inject(KEEPER_HUB) keeperHub: KeeperHubProvider,
    @Inject(CHAIN_READER) chainReader: ChainReader,
    @Inject(SIMULATOR) simulator: Simulator,
    @Inject(INVESTIGATION_ASSISTANT)
    investigationAssistant: InvestigationAssistant,
  ) {
    this.chainReader = chainReader;
    this.investigationAssistant = investigationAssistant;
    this.rpcLogBlockRange = boundedInteger(
      process.env.AETHER_RPC_LOG_BLOCK_RANGE,
      10,
      1,
      10_000,
    );
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
    await this.recoverLockedExecutions();
    await this.publishOutbox();
    this.outboxTimer = setInterval(() => void this.publishOutbox(), 1_000);
  }

  private async recoverLockedExecutions() {
    const queue = this.queues.get("execution.reconcile");
    if (!queue) return;
    const executions = await this.connection
      .collection("executions")
      .find({
        status: { $in: ["unknown", "reconciling"] },
        retryLocked: true,
      })
      .project({
        organizationId: 1,
        protocolId: 1,
        executionId: 1,
        idempotencyKey: 1,
        providerCorrelationId: 1,
      })
      .toArray();
    for (const execution of executions) {
      const data = durableJobSchema.parse({
        organizationId: execution.organizationId,
        protocolId: execution.protocolId,
        resourceId: execution.executionId,
        idempotencyKey: stableIdempotencyKey(
          String(execution.idempotencyKey),
          "execution.reconcile",
        ),
        correlationId:
          execution.providerCorrelationId ?? String(execution.executionId),
      });
      const existing = await queue.getJob(data.idempotencyKey);
      const existingState = existing ? await existing.getState() : undefined;
      if (existing && existingState === "failed") {
        await existing.retry("failed");
      } else if (existing && existingState === "delayed") {
        await existing.promote();
      } else if (!existing) {
        await queue.add("execution.reconcile", data, {
          jobId: data.idempotencyKey,
        });
      }
    }
  }

  private async process(name: QueueName, job: Job) {
    const data = durableJobSchema.parse(job.data);
    const filter = {
      organizationId: data.organizationId,
      protocolId: data.protocolId,
      queueName: name,
      idempotencyKey: data.idempotencyKey,
    };
    const jobs = this.connection.collection("job_runs");
    await jobs.updateOne(
      filter,
      {
        $set: {
          status: "running",
          resourceId: data.resourceId,
          correlationId: data.correlationId,
          attemptsMade: job.attemptsMade + 1,
          updatedAt: new Date(),
        },
        $setOnInsert: { ...filter, createdAt: new Date() },
      },
      { upsert: true },
    );
    try {
      let result: unknown;
      switch (name) {
        case "operation.simulate":
          result = await this.processor.simulate(data);
          break;
        case "execution.submit":
          result = await this.processor.submit(data);
          break;
        case "execution.reconcile":
          result = await this.processor.reconcile(data);
          break;
        case "execution.verify":
          result = await this.processor.verify(data);
          break;
        case "observation.scan":
          result = await this.scan(data);
          break;
        case "drift.evaluate":
          result = await this.evaluateDrift(data);
          break;
        case "investigation.run":
          result = await this.investigate(data);
          break;
        case "audit.dispatch":
          result = {
            status: "completed",
            queue: name,
            resourceId: data.resourceId,
          };
          break;
      }
      await jobs.updateOne(filter, {
        $set: {
          status: "completed",
          result: redact(result),
          completedAt: new Date(),
          updatedAt: new Date(),
        },
        $unset: { error: "" },
      });
      return result;
    } catch (error) {
      const finalAttempt =
        job.attemptsMade + 1 >= Number(job.opts.attempts ?? 1);
      await jobs.updateOne(filter, {
        $set: {
          status: finalAttempt ? "failed" : "queued",
          error:
            error instanceof Error ? error.message : "Provider job failed.",
          attemptsMade: job.attemptsMade + 1,
          updatedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async scan(job: DurableJob) {
    const tenant = {
      organizationId: job.organizationId,
      protocolId: job.protocolId,
    };
    const [network, contract, desired] = await Promise.all([
      this.connection.collection("networks").findOne({
        ...tenant,
        chainId: activeLiveChain.chainId,
        networkId: activeLiveChain.slug,
      }),
      this.connection.collection("contracts").findOne({
        ...tenant,
        chainId: activeLiveChain.chainId,
        networkId: activeLiveChain.slug,
      }),
      this.connection
        .collection("desired_state_versions")
        .findOne({ ...tenant, active: true }),
    ]);
    if (!network || !contract || !desired) {
      throw new Error(
        "A network, validated contract, and active desired state are required before scanning.",
      );
    }
    if (Number(network.chainId) !== activeLiveChain.chainId) {
      throw new Error(
        `Observation is restricted to ${activeLiveChain.displayName} chain ${activeLiveChain.chainId}.`,
      );
    }
    const observation = await this.chainReader.observeOracle(
      activeLiveChain.chainId,
      String(contract.address),
    );
    const previousObservation = await this.connection
      .collection("observations")
      .findOne(tenant, { sort: { blockNumber: -1 } });
    const earliestSupportedBlock = Math.max(
      0,
      observation.blockNumber - this.rpcLogBlockRange + 1,
    );
    const fromBlock = previousObservation
      ? Math.max(
          earliestSupportedBlock,
          Number(previousObservation.blockNumber) + 1,
        )
      : earliestSupportedBlock;
    const logs = await this.chainReader.getLogs({
      chainId: activeLiveChain.chainId,
      address: String(contract.address),
      fromBlock,
      toBlock: observation.blockNumber,
      topics: [arcadiaTopics.oracleConfigured],
    });
    const originLog = logs.at(-1);
    const originActor = originLog
      ? await this.chainReader.getTransactionActor(
          activeLiveChain.chainId,
          originLog.transactionHash,
        )
      : undefined;
    const topicAddress = (topic: string | undefined) =>
      topic ? `0x${topic.slice(-40)}` : undefined;
    const observationId = `obs_${observation.blockHash.slice(2, 18)}`;
    await this.connection.collection("observations").updateOne(
      { ...tenant, observationId },
      {
        $setOnInsert: {
          ...tenant,
          observationId,
          networkId: String(network.networkId),
          blockNumber: observation.blockNumber,
          blockHash: observation.blockHash,
          values: {
            oracle: observation.oracle,
            oracleUpdatedAt: observation.oracleUpdatedAt,
            fresh: observation.fresh,
            canonical: observation.canonical,
            origin: originLog
              ? {
                  transactionHash: originLog.transactionHash,
                  blockNumber: originLog.blockNumber,
                  actor: originActor,
                  event: "OracleConfigured",
                  previousOracle: topicAddress(originLog.topics[1]),
                  newOracle: topicAddress(originLog.topics[2]),
                  eventActor: topicAddress(originLog.topics[3]),
                  observedAt: observation.observedAt,
                }
              : undefined,
          },
          providerCorrelationId: `rpc-${observation.blockHash.slice(2, 14)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    await this.queues.get("drift.evaluate")!.add(
      "drift.evaluate",
      { ...job, resourceId: observationId },
      {
        jobId: stableIdempotencyKey(job.idempotencyKey, "drift.evaluate"),
      },
    );
    return {
      status: "completed",
      observationId,
      blockNumber: observation.blockNumber,
    };
  }

  private async evaluateDrift(job: DurableJob) {
    const tenant = {
      organizationId: job.organizationId,
      protocolId: job.protocolId,
    };
    const [observation, desired] = await Promise.all([
      this.connection
        .collection("observations")
        .findOne({ ...tenant, observationId: job.resourceId }),
      this.connection
        .collection("desired_state_versions")
        .findOne({ ...tenant, active: true }),
    ]);
    if (!observation || !desired) {
      throw new Error("Observation or desired state is unavailable.");
    }
    const observedOracle = String(
      (observation.values as Record<string, unknown>).oracle,
    );
    const desiredOracle = String(
      (desired.manifest as Record<string, unknown>).oracleAddress,
    );
    const observationValues = observation.values as Record<string, unknown>;
    const findingKey = stableIdempotencyKey(
      job.organizationId,
      job.protocolId,
      "oracle-address",
      desiredOracle.toLowerCase(),
    );
    const findingId = `drift_${findingKey.slice(0, 20)}`;
    const addressMatches =
      observedOracle.toLowerCase() === desiredOracle.toLowerCase();
    const matches = addressMatches && observationValues.fresh === true;
    await this.connection.collection("drift_findings").updateOne(
      { ...tenant, findingId },
      {
        $set: {
          status: matches ? "resolved" : "open",
          severity: "critical",
          observed: observedOracle,
          desired: desiredOracle,
          evidence: {
            observationId: job.resourceId,
            chainId: activeLiveChain.chainId,
            networkId: activeLiveChain.slug,
            blockNumber: observation.blockNumber,
            blockHash: observation.blockHash,
            origin: observationValues.origin,
            addressMatches,
            fresh: observationValues.fresh === true,
          },
          updatedAt: new Date(),
        },
        $setOnInsert: {
          ...tenant,
          findingId,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
    return { status: matches ? "resolved" : "open", findingId };
  }

  private async investigate(job: DurableJob) {
    const tenant = {
      organizationId: job.organizationId,
      protocolId: job.protocolId,
    };
    const [finding, desired, contract] = await Promise.all([
      this.connection
        .collection("drift_findings")
        .findOne({ ...tenant, findingId: job.resourceId }),
      this.connection
        .collection("desired_state_versions")
        .findOne({ ...tenant, active: true }),
      this.connection.collection("contracts").findOne({
        ...tenant,
        chainId: activeLiveChain.chainId,
        networkId: activeLiveChain.slug,
      }),
    ]);
    if (!finding || !desired || !contract) {
      throw new Error(
        "Finding, desired state, and contract evidence are required.",
      );
    }
    const evidence = finding.evidence as Record<string, unknown>;
    const suggestion = await this.investigationAssistant.suggest({
      findingId: job.resourceId,
      observedFacts: [
        `Observed oracle: ${String(finding.observed)}`,
        `Pinned block: ${String(evidence.blockNumber)}`,
      ],
      desiredStateFacts: [
        `Desired oracle: ${String(finding.desired)}`,
        `Desired state version: ${String(desired.versionId)}`,
      ],
      allowedChainIds: [activeLiveChain.chainId],
      allowedTargets: [String(contract.address)],
      allowedFunctions: ["setOracle(address)"],
    });
    const investigationId = `inv_${randomUUID()}`;
    await this.connection.collection("investigations").insertOne({
      ...tenant,
      investigationId,
      findingId: job.resourceId,
      facts: suggestion.facts,
      inferences: suggestion.inferences,
      confidence: suggestion.confidence,
      affectedInvariants: suggestion.affectedInvariants,
      recommendedAction: suggestion.recommendedAction,
      suggestion,
      advisoryOnly: true,
      providerCorrelationId: job.correlationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { status: "completed", investigationId };
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
      const existingJob = await queue.getJob(data.idempotencyKey);
      if (existingJob && (await existingJob.getState()) === "failed") {
        await existingJob.retry("failed");
      } else if (!existingJob) {
        await queue.add(queueName, data, {
          jobId: data.idempotencyKey,
        });
      }
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

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `AETHER_RPC_LOG_BLOCK_RANGE must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return parsed;
}
