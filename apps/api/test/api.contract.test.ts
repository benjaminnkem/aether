import { describe, expect, it } from "vitest";
import {
  createMissionSchema,
  createRunSchema,
  investigationResultSchema,
  missionDefinitionSchema,
} from "@aether/shared";

describe("v1 request contracts", () => {
  it("requires a retry class and constrained Sepolia action for each write", () => {
    expect(() =>
      missionDefinitionSchema.parse({
        objective: "Run one write",
        steps: [{ id: "write", name: "Write", action: {} }],
      }),
    ).toThrow();
  });

  it("rejects floating-point or exponent-form onchain values", () => {
    const invalid = {
      name: "Invalid amount",
      definition: {
        objective: "Reject unsafe numeric input",
        steps: [],
        invariants: [],
        authorityPolicy: {
          allowedTargets: [],
          allowedFunctions: [],
          maximumValueWei: "1.1",
          approvalThresholdWei: "0",
        },
        recoveryPolicy: {
          onKnownFailure: "ESCALATE",
          onUnknownOutcome: "ESCALATE",
          maximumRecoverySpendWei: "0",
          compensations: [],
        },
        confirmationThreshold: 2,
      },
    };
    expect(() => createMissionSchema.parse(invalid)).toThrow();
  });

  it("bounds external run input", () => {
    expect(
      createRunSchema.parse({ externalId: "agent-42", input: { order: "42" } }),
    ).toEqual({
      externalId: "agent-42",
      input: { order: "42" },
    });
  });

  it("rejects unsupported incident dispositions and extra fields", () => {
    expect(() =>
      investigationResultSchema.parse({
        summary: "Evidence is incomplete.",
        likelyCauses: [],
        recommendedDisposition: "EXECUTE",
        operatorNotes: [],
        uncertainty: [],
      }),
    ).toThrow();
    expect(() =>
      investigationResultSchema.parse({
        summary: "Evidence is incomplete.",
        likelyCauses: [],
        recommendedDisposition: "ESCALATE",
        operatorNotes: [],
        uncertainty: [],
        transaction: { to: "0x00" },
      }),
    ).toThrow();
  });
});
