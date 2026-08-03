import {
  ExecutionSafety,
  arcadiaTopics,
  encodeSetOracleCalldata,
  type ChainReader,
  type DurableJob,
  type KeeperHubProvider,
  type Simulator,
} from "@aether/backend";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExecutionProcessor,
  type ExecutionRecord,
  type ExecutionStore,
} from "../src/execution/execution-processor";

const job: DurableJob = {
  organizationId: "org-arcadia",
  protocolId: "arcadia",
  resourceId: "exec-kh-8314",
  idempotencyKey: "a".repeat(64),
  correlationId: "request-1",
};
const request = {
  chainId: 11155111,
  target: "0x7D4A3AfF7c4C51B1726a91c738ACb6F227127C3f",
  functionSignature: "setOracle(address)" as const,
  calldata: encodeSetOracleCalldata(
    "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311",
  ),
  valueWei: "0",
  desiredOracle: "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311",
};
const planHash = ExecutionSafety.planHash(request, "dsv-active");
const providerHealth = {
  status: "healthy" as const,
  checkedAt: "2026-07-30T00:00:00.000Z",
  latencyMs: 0,
  consecutiveFailures: 0,
};
const baseExecution: ExecutionRecord = {
  executionId: job.resourceId,
  organizationId: job.organizationId,
  protocolId: job.protocolId,
  status: "new",
  idempotencyKey: job.idempotencyKey,
  planHash,
  request,
  policy: {
    allowedChainIds: [11155111],
    allowedTargets: [request.target],
    allowedFunctions: ["setOracle(address)"],
    maximumValueWei: "0",
    requireSimulation: true,
    requireIndependentVerification: true,
    approvalThreshold: 1,
    prohibitSelfApproval: false,
  },
  simulation: {
    simulationId: "sim-1",
    planHash,
    success: true,
    gasEstimate: "284211",
    postconditionMatched: true,
    blockNumber: 17_924_118,
  },
  approvals: [
    {
      actorId: "user-mina",
      planHash,
      simulationId: "sim-1",
      decision: "approve",
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
  ],
  retryLocked: false,
  observationBlockNumber: 17_924_118,
};

class MemoryExecutionStore implements ExecutionStore {
  execution = structuredClone(baseExecution);
  enqueued: string[] = [];
  intentPersistedBeforeProvider = false;

  async getExecution() {
    return structuredClone(this.execution);
  }

  async persistIntent(_job: DurableJob, providerCorrelationId: string) {
    this.execution = {
      ...this.execution,
      status: "intent_persisted",
      providerCorrelationId,
    };
    this.intentPersistedBeforeProvider = true;
    return structuredClone(this.execution);
  }

  async update(
    _job: DurableJob,
    patch: Partial<ExecutionRecord>,
    auditType: string,
  ) {
    void auditType;
    this.execution = { ...this.execution, ...patch };
    return structuredClone(this.execution);
  }

  async enqueue(queue: "execution.reconcile" | "execution.verify") {
    this.enqueued.push(queue);
  }
}

describe("ExecutionProcessor idempotency and retry safety", () => {
  let store: MemoryExecutionStore;
  let submit: ReturnType<typeof vi.fn<KeeperHubProvider["submit"]>>;
  let keeperHub: KeeperHubProvider;
  let chainReader: ChainReader;
  let simulator: Simulator;

  beforeEach(() => {
    store = new MemoryExecutionStore();
    submit = vi.fn<KeeperHubProvider["submit"]>(async () => {
      expect(store.intentPersistedBeforeProvider).toBe(true);
      return {
        directExecutionId: "KH-8314",
        providerCorrelationId: store.execution.providerCorrelationId!,
        status: "unknown" as const,
      };
    });
    keeperHub = {
      getHealth: () => ({ provider: "keeperhub", ...providerHealth }),
      submit: async (idempotencyKey, submittedPlanHash, submittedRequest) =>
        submit(idempotencyKey, submittedPlanHash, submittedRequest),
      reconcile: vi.fn(async (providerCorrelationId: string) => ({
        directExecutionId: "KH-8314",
        providerCorrelationId,
        status: "confirmed" as const,
        transactionHash: `0x${"7".repeat(64)}`,
        blockNumber: 17_924_125,
        confirmations: 12,
      })),
      getStepLogs: vi.fn(async () => []),
    };
    chainReader = {
      getHealth: () => ({ provider: "evm-rpc", ...providerHealth }),
      observeOracle: vi.fn(),
      getTransactionActor: vi.fn(),
      getLogs: vi.fn(async () => []),
      getReceipt: vi.fn(),
      verifyOracle: vi.fn(async () => ({
        verified: true,
        oracle: request.desiredOracle,
        oracleUpdatedAt: 1_800_000_000,
        fresh: true,
        blockNumber: 17_924_130,
        blockHash: `0x${"8".repeat(64)}`,
        confirmations: 12,
        canonical: true,
        providerCorrelationId: "rpc-verify",
      })),
    };
    simulator = {
      getHealth: () => ({ provider: "keeperhub", ...providerHealth }),
      simulate: vi.fn(),
    };
  });

  it("persists provider correlation before submit and never resubmits unknown outcomes", async () => {
    const processor = new ExecutionProcessor(
      store,
      keeperHub,
      chainReader,
      simulator,
    );
    const first = await processor.submit(job);
    expect(first.status).toBe("unknown");
    expect(first.retryLocked).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);

    const duplicate = await processor.submit(job);
    expect(duplicate.status).toBe("unknown");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(store.enqueued).toEqual([
      "execution.reconcile",
      "execution.reconcile",
    ]);
  });

  it("treats a provider exception after intent persistence as uncertain", async () => {
    submit.mockRejectedValueOnce(new Error("timeout"));
    const processor = new ExecutionProcessor(
      store,
      keeperHub,
      chainReader,
      simulator,
    );
    const result = await processor.submit(job);
    expect(result.status).toBe("unknown");
    expect(result.retryLocked).toBe(true);
    expect(store.enqueued).toContain("execution.reconcile");
  });

  it("retries reconciliation status without retrying submission", async () => {
    store.execution = {
      ...store.execution,
      status: "unknown",
      retryLocked: true,
      providerCorrelationId: "provider-correlation",
    };
    keeperHub.reconcile = vi.fn(async () => ({
      directExecutionId: "KH-8314",
      providerCorrelationId: "provider-correlation",
      status: "pending" as const,
    }));
    const processor = new ExecutionProcessor(
      store,
      keeperHub,
      chainReader,
      simulator,
    );
    await expect(processor.reconcile(job)).rejects.toMatchObject({
      name: "ReconciliationPending",
    });
    expect(store.execution.status).toBe("reconciling");
    expect(store.execution.retryLocked).toBe(true);
    expect(submit).not.toHaveBeenCalled();
  });

  it("recovers an uncertain submission from executor-bound RPC evidence", async () => {
    const transactionHash = `0x${"9".repeat(64)}`;
    const executorAddress = "0x7055a7dc92b98d9fc7ccf9f9590fa1790e3a0570";
    store.execution = {
      ...store.execution,
      status: "unknown",
      retryLocked: true,
      providerCorrelationId: "provider-correlation",
    };
    process.env.AETHER_EXECUTOR_ADDRESS = executorAddress;
    chainReader.observeOracle = vi.fn(async () => ({
      chainId: request.chainId,
      blockNumber: baseExecution.observationBlockNumber + 5,
      blockHash: `0x${"8".repeat(64)}`,
      contract: request.target,
      oracle: request.desiredOracle,
      oracleUpdatedAt: 1_800_000_000,
      fresh: true,
      canonical: true,
      observedAt: "2026-08-03T00:00:00.000Z",
    }));
    chainReader.getLogs = vi.fn(async () => [
      {
        address: request.target,
        blockNumber: baseExecution.observationBlockNumber + 3,
        blockHash: `0x${"8".repeat(64)}`,
        transactionHash,
        logIndex: 0,
        topics: [
          arcadiaTopics.oracleConfigured,
          `0x${"0".repeat(24)}${"1".repeat(40)}`,
          `0x${"0".repeat(24)}${request.desiredOracle.slice(2)}`,
          `0x${"0".repeat(24)}${executorAddress.slice(2)}`,
        ],
        data: "0x",
        removed: false,
      },
    ]);
    const processor = new ExecutionProcessor(
      store,
      keeperHub,
      chainReader,
      simulator,
    );

    const result = await processor.reconcile(job);

    expect(result.status).toBe("confirmed");
    expect(result.transactionHash).toBe(transactionHash);
    expect(store.enqueued).toContain("execution.verify");
    expect(keeperHub.reconcile).not.toHaveBeenCalled();
    expect(chainReader.getTransactionActor).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("creates a forward-correction state when independent verification fails", async () => {
    store.execution.status = "confirmed";
    chainReader.verifyOracle = vi.fn(async () => ({
      verified: false,
      oracle: "0x91A6D4bF5c0A8dF0E9F12D78771133796a33B741",
      oracleUpdatedAt: 1_799_000_000,
      fresh: false,
      blockNumber: 17_924_130,
      blockHash: `0x${"8".repeat(64)}`,
      confirmations: 12,
      canonical: true,
      providerCorrelationId: "rpc-verify",
    }));
    const processor = new ExecutionProcessor(
      store,
      keeperHub,
      chainReader,
      simulator,
    );
    const result = await processor.verify(job);
    expect(result.status).toBe("partial");
    expect(result.correctionOperationId).toBe("correction-exec-kh-8314");
    expect(result.retryLocked).toBe(true);
  });

  it("routes an unknown receipt back to reconciliation without resubmitting", async () => {
    store.execution = {
      ...store.execution,
      status: "confirmed",
      providerCorrelationId: "provider-correlation",
      transactionHash: `0x${"7".repeat(64)}`,
    };
    const unknownReceipt = new Error("receipt unavailable");
    unknownReceipt.name = "UnknownReceiptOutcomeError";
    chainReader.verifyOracle = vi.fn(async () => {
      throw unknownReceipt;
    });
    const processor = new ExecutionProcessor(
      store,
      keeperHub,
      chainReader,
      simulator,
    );

    await expect(processor.verify(job)).rejects.toBe(unknownReceipt);
    expect(store.execution.status).toBe("reconciling");
    expect(store.execution.retryLocked).toBe(true);
    expect(store.enqueued).toContain("execution.reconcile");
    expect(submit).not.toHaveBeenCalled();
  });
});
