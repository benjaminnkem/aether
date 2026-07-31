import {
  registerModels,
  stableIdempotencyKey,
  type DurableJob,
} from "@aether/backend";
import { InjectConnection } from "@nestjs/mongoose";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { Connection, Model } from "mongoose";
import type {
  ExecutionRecord,
  ExecutionStore,
} from "../execution/execution-processor";
import type { Queue } from "bullmq";

@Injectable()
export class MongoWorkerStore implements ExecutionStore, OnModuleInit {
  private models!: Record<string, Model<unknown>>;
  private queues = new Map<string, Queue>();

  constructor(@InjectConnection() private readonly connection: Connection) {}

  onModuleInit() {
    this.models = registerModels(this.connection);
  }

  setQueues(queues: Map<string, Queue>) {
    this.queues = queues;
  }

  async getExecution(job: DurableJob): Promise<ExecutionRecord> {
    const document = await this.models
      .Execution!.findOne({
        organizationId: job.organizationId,
        protocolId: job.protocolId,
        executionId: job.resourceId,
      })
      .lean()
      .exec();
    if (document) return document as unknown as ExecutionRecord;
    throw new Error(
      `Execution ${job.resourceId} must be persisted before a worker job is queued.`,
    );
  }

  async persistIntent(
    job: DurableJob,
    providerCorrelationId: string,
  ): Promise<ExecutionRecord> {
    return this.update(
      job,
      {
        status: "intent_persisted",
        providerCorrelationId,
        retryLocked: false,
      },
      "execution.intent_persisted",
    );
  }

  async update(
    job: DurableJob,
    patch: Partial<ExecutionRecord>,
    auditType: string,
  ): Promise<ExecutionRecord> {
    const session = await this.connection.startSession();
    try {
      let updated!: ExecutionRecord;
      await session.withTransaction(async () => {
        const document = await this.models
          .Execution!.findOneAndUpdate(
            {
              organizationId: job.organizationId,
              protocolId: job.protocolId,
              executionId: job.resourceId,
            },
            { $set: patch },
            { new: true, session },
          )
          .lean()
          .exec();
        if (!document) throw new Error("Execution not found.");
        updated = document as unknown as ExecutionRecord;
        const eventId = stableIdempotencyKey(
          job.idempotencyKey,
          auditType,
          updated.status,
        );
        await this.models.AuditEvent!.updateOne(
          { eventId },
          {
            $setOnInsert: {
              organizationId: job.organizationId,
              protocolId: job.protocolId,
              eventId,
              actorId: "aether-worker",
              eventType: auditType,
              correlationId: job.correlationId,
              resourceId: job.resourceId,
              result: updated.status,
              evidence: {
                providerCorrelationId: updated.providerCorrelationId,
                transactionHash: updated.transactionHash,
              },
            },
          },
          { upsert: true, session },
        );
      });
      return updated;
    } finally {
      await session.endSession();
    }
  }

  async enqueue(
    queueName: "execution.reconcile" | "execution.verify",
    job: DurableJob,
  ) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} is not initialized.`);
    const jobId = stableIdempotencyKey(job.idempotencyKey, queueName);
    await queue.add(queueName, job, {
      jobId,
      attempts: queueName === "execution.reconcile" ? 20 : 5,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    });
  }
}
