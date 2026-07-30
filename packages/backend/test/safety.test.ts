import { describe, expect, it } from "vitest";
import { ExecutionSafety, SafetyViolation } from "../src/safety";

const request = {
  chainId: 84532,
  target: "0x7D4A3AfF7c4C51B1726a91c738ACb6F227127C3f",
  functionSignature: "setOracle(address)" as const,
  calldata:
    "0x7c423f540000000000000000000000002c8a7e78b8d6909a2171b8449a3c1b8d64f44311",
  valueWei: "0",
  desiredOracle: "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311",
};

const safety = new ExecutionSafety();
const planHash = ExecutionSafety.planHash(request, "dsv-1");
const simulation = {
  simulationId: "sim-1",
  planHash,
  success: true,
  gasEstimate: "284211",
  postconditionMatched: true,
  blockNumber: 17_924_118,
};
const policy = {
  allowedChainIds: [84532],
  allowedTargets: [request.target],
  allowedFunctions: ["setOracle(address)" as const],
  maximumValueWei: "0",
  requireSimulation: true as const,
  requireIndependentVerification: true as const,
  approvalThreshold: 1,
};

describe("ExecutionSafety", () => {
  it("authorizes only the exact simulated and approved request", () => {
    expect(() =>
      safety.authorize({
        request,
        policy,
        planHash,
        simulation,
        approvals: [
          {
            actorId: "user-owner",
            planHash,
            simulationId: "sim-1",
            decision: "approve",
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects an approval bound to another plan", () => {
    expect(() =>
      safety.authorize({
        request,
        policy,
        planHash,
        simulation,
        approvals: [
          {
            actorId: "user-owner",
            planHash: `0x${"1".repeat(64)}`,
            simulationId: "sim-1",
            decision: "approve",
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        ],
      }),
    ).toThrowError(SafetyViolation);
  });

  it("rejects value transfer even if a wider policy is supplied", () => {
    expect(() =>
      safety.authorize({
        request: { ...request, valueWei: "1" },
        policy: { ...policy, maximumValueWei: "2" },
        planHash,
        simulation,
        approvals: [],
      }),
    ).toThrowError(/zero value/);
  });
});
