import {
  ExecutionSafety,
  durableJobSchema,
  keeperStatusSchema,
  keeperSubmissionSchema,
  stableIdempotencyKey,
  transactionRequestSchema,
  verificationResultSchema,
  type BoundApproval,
  type ChainReader,
  type DurableJob,
  type KeeperStepLog,
  type KeeperHubProvider,
  type PolicyEnvelope,
  type Simulator,
  type TransactionRequest,
} from "@aether/backend";

export type ExecutionStatus =
  | "new"
  | "intent_persisted"
  | "submitted"
  | "unknown"
  | "reconciling"
  | "confirmed"
  | "verified"
  | "partial"
  | "failed";

export interface ExecutionRecord {
  executionId: string;
  organizationId: string;
  protocolId: string;
  status: ExecutionStatus;
  idempotencyKey: string;
  planHash: string;
  planCreatedBy?: string;
  request: TransactionRequest;
  policy: PolicyEnvelope;
  simulation: unknown;
  approvals: BoundApproval[];
  providerCorrelationId?: string;
  directExecutionId?: string;
  transactionHash?: string;
  transactionLink?: string;
  gasUsedWei?: string;
  error?: string;
  completedAt?: Date | string;
  retryLocked: boolean;
  observationBlockNumber: number;
  correctionOperationId?: string;
  providerStepLogs?: KeeperStepLog[];
}

export interface ExecutionStore {
  getExecution(job: DurableJob): Promise<ExecutionRecord>;
  persistIntent(
    job: DurableJob,
    providerCorrelationId: string,
  ): Promise<ExecutionRecord>;
  update(
    job: DurableJob,
    patch: Partial<ExecutionRecord>,
    auditType: string,
  ): Promise<ExecutionRecord>;
  enqueue(
    queue: "execution.reconcile" | "execution.verify",
    job: DurableJob,
  ): Promise<void>;
}

export class ExecutionProcessor {
  private readonly safety = new ExecutionSafety();
  private readonly finalityConfirmations = positiveIntegerEnv(
    "AETHER_FINALITY_CONFIRMATIONS",
    12,
  );

  constructor(
    private readonly store: ExecutionStore,
    private readonly keeperHub: KeeperHubProvider,
    private readonly chainReader: ChainReader,
    private readonly simulator: Simulator,
  ) {}

  async simulate(rawJob: unknown): Promise<ExecutionRecord> {
    const job = durableJobSchema.parse(rawJob);
    const execution = await this.store.getExecution(job);
    const result = await this.simulator.simulate(
      execution.planHash,
      execution.request,
      execution.observationBlockNumber,
    );
    return this.store.update(
      job,
      {
        simulation: result,
        status: result.success ? "new" : "failed",
      },
      result.success ? "operation.simulated" : "operation.simulation_failed",
    );
  }

  async submit(rawJob: unknown): Promise<ExecutionRecord> {
    const job = durableJobSchema.parse(rawJob);
    let execution = await this.store.getExecution(job);

    if (
      ["submitted", "confirmed", "verified", "partial"].includes(
        execution.status,
      )
    ) {
      return execution;
    }
    if (execution.status === "unknown" || execution.status === "reconciling") {
      if (!execution.retryLocked) {
        throw new Error("Unknown outcomes must hold the retry lock.");
      }
      await this.store.enqueue("execution.reconcile", job);
      return execution;
    }

    this.safety.authorize({
      request: transactionRequestSchema.parse(execution.request),
      policy: execution.policy,
      planHash: execution.planHash,
      simulation: execution.simulation,
      approvals: execution.approvals,
      planCreatedBy: execution.planCreatedBy,
    });

    const providerCorrelationId =
      execution.providerCorrelationId ??
      stableIdempotencyKey(
        job.organizationId,
        job.protocolId,
        execution.executionId,
        execution.planHash,
      );
    execution = await this.store.persistIntent(job, providerCorrelationId);

    try {
      const submission = keeperSubmissionSchema.parse(
        await this.keeperHub.submit(
          providerCorrelationId,
          execution.planHash,
          execution.request,
        ),
      );
      if (submission.status === "unknown") {
        const unknown = await this.store.update(
          job,
          {
            status: "unknown",
            retryLocked: true,
            providerCorrelationId: submission.providerCorrelationId,
            directExecutionId: submission.directExecutionId,
            transactionHash: submission.transactionHash,
          },
          "execution.outcome_unknown",
        );
        await this.store.enqueue("execution.reconcile", job);
        return unknown;
      }
      const submitted = await this.store.update(
        job,
        {
          status: "submitted",
          retryLocked: false,
          providerCorrelationId: submission.providerCorrelationId,
          directExecutionId: submission.directExecutionId,
          transactionHash: submission.transactionHash,
        },
        "execution.submitted",
      );
      await this.store.enqueue("execution.reconcile", job);
      return submitted;
    } catch (error) {
      const httpStatus =
        error instanceof Error &&
        "status" in error &&
        typeof (error as Error & { status?: unknown }).status === "number"
          ? (error as Error & { status: number }).status
          : undefined;
      if (httpStatus === 429) {
        await this.store.update(
          job,
          { status: "intent_persisted", retryLocked: false },
          "execution.rate_limited",
        );
        const retryAfterMs =
          typeof error === "object" &&
          error !== null &&
          "retryAfterMs" in error &&
          typeof (error as { retryAfterMs?: unknown }).retryAfterMs === "number"
            ? (error as Error & { retryAfterMs: number }).retryAfterMs
            : 1_000;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(Math.max(retryAfterMs, 0), 60_000)),
        );
        throw error;
      }
      if (httpStatus && [400, 401, 403, 422].includes(httpStatus)) {
        return this.store.update(
          job,
          { status: "failed", retryLocked: false },
          "execution.provider_rejected",
        );
      }
      const unknown = await this.store.update(
        job,
        { status: "unknown", retryLocked: true },
        "execution.submission_uncertain",
      );
      await this.store.enqueue("execution.reconcile", job);
      if (error instanceof Error && error.name === "SafetyViolation")
        throw error;
      return unknown;
    }
  }

  async reconcile(rawJob: unknown): Promise<ExecutionRecord> {
    const job = durableJobSchema.parse(rawJob);
    const execution = await this.store.getExecution(job);
    if (execution.status === "verified" || execution.status === "partial") {
      return execution;
    }
    if (!execution.providerCorrelationId) {
      throw new Error(
        "Provider correlation must be persisted before reconciliation.",
      );
    }
    const status = keeperStatusSchema.parse(
      await this.keeperHub.reconcile(
        execution.providerCorrelationId,
        execution.directExecutionId,
      ),
    );
    if (status.status === "unknown" || status.status === "pending") {
      await this.store.update(
        job,
        { status: "reconciling", retryLocked: true },
        "execution.reconciliation_pending",
      );
      await new Promise((resolve) =>
        setTimeout(resolve, status.pollIntervalHintMs ?? 2_000),
      );
      const pending = new Error(
        "Reconciliation is pending; retry status lookup without resubmitting.",
      );
      pending.name = "ReconciliationPending";
      throw pending;
    }
    if (status.status === "failed") {
      const providerStepLogs = await this.keeperHub.getStepLogs(
        status.directExecutionId,
      );
      return this.store.update(
        job,
        { status: "failed", retryLocked: false, providerStepLogs },
        "execution.failed",
      );
    }
    const providerStepLogs = await this.keeperHub.getStepLogs(
      status.directExecutionId,
    );
    const confirmed = await this.store.update(
      job,
      {
        status: "confirmed",
        retryLocked: false,
        transactionHash: status.transactionHash,
        transactionLink: status.transactionLink,
        gasUsedWei: status.gasUsedWei,
        error: status.error,
        completedAt: status.completedAt,
        providerStepLogs,
      },
      "execution.confirmed",
    );
    await this.store.enqueue("execution.verify", job);
    return confirmed;
  }

  async verify(rawJob: unknown): Promise<ExecutionRecord> {
    const job = durableJobSchema.parse(rawJob);
    const execution = await this.store.getExecution(job);
    if (execution.status === "verified" || execution.status === "partial") {
      return execution;
    }
    let verification;
    try {
      verification = verificationResultSchema.parse(
        await this.chainReader.verifyOracle(
          execution.request,
          this.finalityConfirmations,
          execution.transactionHash,
        ),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        [
          "UnknownReceiptOutcomeError",
          "FinalityPendingError",
          "ReorgDetectedError",
        ].includes(error.name)
      ) {
        await this.store.update(
          job,
          { status: "reconciling", retryLocked: true },
          "execution.verification_reconciliation_required",
        );
        await this.store.enqueue("execution.reconcile", job);
      }
      throw error;
    }
    if (
      verification.verified &&
      verification.fresh &&
      verification.canonical &&
      verification.confirmations >= this.finalityConfirmations &&
      verification.oracle.toLowerCase() ===
        execution.request.desiredOracle.toLowerCase()
    ) {
      return this.store.update(
        job,
        { status: "verified", retryLocked: false },
        "execution.verified",
      );
    }
    return this.store.update(
      job,
      {
        status: "partial",
        retryLocked: true,
        correctionOperationId: `correction-${execution.executionId}`,
      },
      "execution.forward_correction_required",
    );
  }
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}
