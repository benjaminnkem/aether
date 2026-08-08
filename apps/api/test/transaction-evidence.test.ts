import { describe, expect, it } from "vitest";
import { transactionEvidence } from "../src/runtime/mission-store";

describe("run transaction evidence", () => {
  it("returns forward and recovery transaction links with their timestamps", () => {
    const forwardHash = `0x${"1".repeat(64)}`;
    const recoveryHash = `0x${"2".repeat(64)}`;
    const result = transactionEvidence(
      [
        {
          executionAttemptId: "attempt_forward",
          planId: "plan_forward",
          stepRunId: "step_run",
          keeperHubExecutionId: "keeper_forward",
          transactionHash: forwardHash,
          providerTransactionLink: `https://keeper.example/transactions/${forwardHash}`,
          status: "CONFIRMED",
          createdAt: new Date("2026-08-08T12:00:00.000Z"),
          terminalAt: new Date("2026-08-08T12:01:00.000Z"),
        },
        {
          executionAttemptId: "attempt_recovery",
          planId: "plan_recovery",
          stepRunId: "step_run",
          keeperHubExecutionId: "keeper_recovery",
          transactionHash: recoveryHash,
          status: "CONFIRMED",
          createdAt: new Date("2026-08-08T12:02:00.000Z"),
        },
      ],
      [
        { planId: "plan_forward", kind: "FORWARD" },
        { planId: "plan_recovery", kind: "COMPENSATION" },
      ],
      [{ stepRunId: "step_run", stepId: "authorize" }],
      null,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      transactionHash: forwardHash,
      explorerUrl: `https://sepolia.etherscan.io/tx/${forwardHash}`,
      kind: "FORWARD",
      stepId: "authorize",
      providerTransactionLink: `https://keeper.example/transactions/${forwardHash}`,
      createdAt: new Date("2026-08-08T12:00:00.000Z"),
    });
    expect(result[1]).toMatchObject({
      transactionHash: recoveryHash,
      kind: "COMPENSATION",
    });
  });

  it("deduplicates receipt executions already represented by an attempt", () => {
    const transactionHash = `0x${"a".repeat(64)}`;
    const result = transactionEvidence(
      [{ transactionHash, executionAttemptId: "attempt_1" }],
      [],
      [],
      {
        executions: [
          { transactionHash, executionAttemptId: "attempt_1" },
          {
            transactionHash: `0x${"b".repeat(64)}`,
            executionAttemptId: "attempt_receipt_only",
          },
        ],
      },
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.receiptOnly).toBeUndefined();
    expect(result[1]?.receiptOnly).toBe(true);
  });

  it("does not expose a non-HTTPS provider link to browser clients", () => {
    const result = transactionEvidence(
      [
        {
          transactionHash: `0x${"c".repeat(64)}`,
          providerTransactionLink: "javascript:alert(1)",
        },
      ],
      [],
      [],
      null,
    );

    expect(result[0]?.providerTransactionLink).toBeUndefined();
  });
});
