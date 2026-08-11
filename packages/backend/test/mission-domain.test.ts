import { describe, expect, it } from "vitest";
import {
  assertMissionTransition,
  assertStepTransition,
  contentHash,
} from "../src/domain";
import { assertSimulationBinding, validateAction } from "../src/safety";
import { missionDefinitionSchema } from "@aether/shared";

const address = "0x1111111111111111111111111111111111111111";
const action = {
  chainId: 11155111 as const,
  contractAddress: address,
  functionName: "deposit",
  functionArgs: ["100"],
  abi: [
    {
      type: "function" as const,
      name: "deposit",
      stateMutability: "nonpayable" as const,
      inputs: [{ name: "amount", type: "uint256" }],
      outputs: [],
    },
  ],
  valueWei: "0",
};

const definition = missionDefinitionSchema.parse({
  objective: "Move a fixed demo balance and verify the destination.",
  steps: [
    {
      id: "deposit",
      name: "Deposit",
      dependsOn: [],
      retryClass: "PROVABLE_EFFECT",
      action,
      proof: { kind: "RECEIPT", confirmations: 2 },
    },
  ],
  invariants: [
    {
      id: "destination-balance",
      kind: "NO_UNKNOWN_ATTEMPTS",
      severity: "CRITICAL",
      parameters: {},
    },
  ],
  authorityPolicy: {
    allowedTargets: [address],
    allowedFunctions: ["deposit"],
    maximumValueWei: "0",
    autoApproveForward: true,
    autoApproveRecovery: true,
  },
  recoveryPolicy: {
    onKnownFailure: "ESCALATE",
    onUnknownOutcome: "RECONCILE",
    onIndeterminateOutcome: "ESCALATE",
    maxRecoverySpendWei: "0",
    terminalSafeStates: ["SOURCE_RESTORED"],
  },
  schemaVersion: 1,
});

describe("mission domain", () => {
  it("permits the verified execution path", () => {
    expect(() =>
      assertMissionTransition("EXECUTING", "VERIFYING"),
    ).not.toThrow();
    expect(() =>
      assertMissionTransition("VERIFYING", "COMPLETED"),
    ).not.toThrow();
    expect(() => assertStepTransition("SUBMITTING", "EXECUTED")).not.toThrow();
    expect(() => assertStepTransition("EXECUTED", "VERIFYING")).not.toThrow();
    expect(() => assertStepTransition("VERIFYING", "VERIFIED")).not.toThrow();
  });

  it("rejects unverified completion and unsafe reconciliation shortcuts", () => {
    expect(() => assertMissionTransition("EXECUTING", "COMPLETED")).toThrow();
    expect(() => assertMissionTransition("RECONCILING", "COMPLETED")).toThrow();
    expect(() => assertStepTransition("OUTCOME_UNKNOWN", "VERIFIED")).toThrow();
  });

  it("allows an executing run to fail closed when an unexpected error occurs", () => {
    expect(() =>
      assertMissionTransition("EXECUTING", "NEEDS_ATTENTION"),
    ).not.toThrow();
    expect(() =>
      assertMissionTransition("NEEDS_ATTENTION", "RECONCILING"),
    ).not.toThrow();
  });

  it("binds execution to the exact simulated request", () => {
    const requestBodyHash = contentHash(action);
    expect(() =>
      assertSimulationBinding({ requestBodyHash }, action),
    ).not.toThrow();
    expect(() =>
      assertSimulationBinding(
        { requestBodyHash },
        { ...action, functionArgs: ["101"] },
      ),
    ).toThrow();
  });

  it("rejects writes outside the frozen mission authority", () => {
    expect(validateAction(action, definition)).toEqual(action);
    expect(() =>
      validateAction({ ...action, chainId: 1 as never }, definition),
    ).toThrow();
    expect(() =>
      validateAction(
        {
          ...action,
          contractAddress: "0x2222222222222222222222222222222222222222",
        },
        definition,
      ),
    ).toThrow();
  });

  it("hashes canonical objects independently of property order", () => {
    expect(contentHash({ b: 2, a: 1 })).toBe(contentHash({ a: 1, b: 2 }));
  });

  it("validates compensation authority at mission-version creation", () => {
    expect(() =>
      missionDefinitionSchema.parse({
        ...definition,
        steps: [
          {
            ...definition.steps[0],
            compensation: {
              id: "restore",
              action: {
                ...action,
                contractAddress: "0x2222222222222222222222222222222222222222",
              },
              proof: { kind: "RECEIPT", confirmations: 2 },
            },
          },
        ],
      }),
    ).toThrow(/Compensation target is not allowlisted/);
  });
});
