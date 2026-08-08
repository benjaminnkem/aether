import { z } from "zod";

export * from "./chains";

export const idSchema = z.string().min(1).max(160);
export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const hashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
export const uintStringSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/)
  .refine((value) => {
    try {
      BigInt(value);
      return true;
    } catch {
      return false;
    }
  }, "Expected an unsigned integer string");

export const workspaceRoleSchema = z.enum([
  "OWNER",
  "OPERATOR",
  "VIEWER",
  "AGENT",
]);
export const missionStateSchema = z.enum([
  "DRAFT",
  "READY",
  "PREFLIGHT",
  "EXECUTING",
  "VERIFYING",
  "RECONCILING",
  "DEGRADED",
  "INVESTIGATING",
  "AWAITING_APPROVAL",
  "RECOVERING",
  "VERIFYING_RECOVERY",
  "PAUSED",
  "COMPLETED",
  "RECOVERED",
  "NEEDS_ATTENTION",
  "ABORTED_SAFE",
]);
export const stepStateSchema = z.enum([
  "PENDING",
  "PRECONDITION_CHECK",
  "SIMULATING",
  "SIMULATION_FAILED",
  "AWAITING_APPROVAL",
  "READY_TO_SUBMIT",
  "SUBMITTING",
  "OUTCOME_UNKNOWN",
  "RECONCILING",
  "EXECUTED",
  "VERIFYING",
  "VERIFIED",
  "FAILED_KNOWN",
  "COMPENSATING",
  "COMPENSATED",
  "NEEDS_ATTENTION",
  "SKIPPED",
]);
export const retryClassSchema = z.enum([
  "SEMANTICALLY_IDEMPOTENT",
  "PROVABLE_EFFECT",
  "NON_REPLAYABLE",
]);
export const invariantResultSchema = z.enum(["PASS", "FAIL", "UNKNOWN"]);
export const reconciliationResolutionSchema = z.enum([
  "LANDED",
  "NOT_LANDED_SAFE_TO_RETRY",
  "INDETERMINATE",
]);
export const dispositionSchema = z.enum([
  "CONTINUE",
  "SAFE_RETRY",
  "COMPENSATE",
  "APPROVAL",
  "ESCALATE",
]);

const proofSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("RECEIPT"),
      confirmations: z.number().int().min(1).max(100),
    })
    .strict(),
  z
    .object({
      kind: z.literal("EVENT"),
      address: addressSchema,
      topic0: hashSchema,
      indexed: z.array(hashSchema).max(4).default([]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("CONTRACT_READ"),
      address: addressSchema,
      functionName: z.string().min(1).max(120),
      args: z.array(z.string().max(256)).max(16),
      abi: z.array(z.record(z.string(), z.unknown())).max(100),
      operator: z.enum(["EQ", "NEQ", "GTE", "LTE"]),
      expected: z.string().max(512),
    })
    .strict(),
  z
    .object({
      kind: z.literal("ERC20_BALANCE"),
      token: addressSchema,
      account: addressSchema,
      operator: z.enum(["EQ", "GTE", "LTE"]),
      amount: uintStringSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("ERC20_ALLOWANCE"),
      token: addressSchema,
      owner: addressSchema,
      spender: addressSchema,
      operator: z.enum(["EQ", "GTE", "LTE"]),
      amount: uintStringSchema,
    })
    .strict(),
]);

export const actionSchema = z
  .object({
    chainId: z.literal(11155111),
    contractAddress: addressSchema,
    functionName: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .max(120),
    functionArgs: z.array(z.union([z.string().max(512), z.boolean()])).max(24),
    abi: z.array(z.record(z.string(), z.unknown())).max(100),
    valueWei: uintStringSchema.default("0"),
  })
  .strict();

const compensationSchema = z
  .object({
    id: idSchema,
    action: actionSchema,
    proof: proofSchema,
  })
  .strict();

export const missionStepSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(120),
    dependsOn: z.array(idSchema).max(32),
    action: actionSchema,
    retryClass: retryClassSchema,
    proof: proofSchema,
    compensation: compensationSchema.optional(),
    executionGate: z
      .object({
        kind: z.literal("BLOCKED"),
        reason: z.string().trim().min(1).max(240),
      })
      .strict()
      .optional(),
  })
  .strict();

export const missionInvariantSchema = z
  .object({
    id: idSchema,
    kind: z.enum([
      "CHAIN_ID",
      "TARGET_ALLOWLIST",
      "FUNCTION_ALLOWLIST",
      "ERC20_BALANCE",
      "ERC20_ALLOWANCE",
      "CONTRACT_READ",
      "MAX_WRITES",
      "DEADLINE",
      "NO_UNKNOWN_ATTEMPTS",
    ]),
    severity: z.enum(["CRITICAL", "WARNING"]),
    parameters: z.record(
      z.string(),
      z.union([z.string(), z.array(z.string())]),
    ),
  })
  .strict();

export const missionDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    objective: z.string().min(1).max(1000),
    steps: z.array(missionStepSchema).min(1).max(32),
    invariants: z.array(missionInvariantSchema).min(1).max(64),
    recoveryPolicy: z
      .object({
        maxRecoverySpendWei: uintStringSchema,
        terminalSafeStates: z.array(z.string().min(1).max(120)).min(1).max(16),
        onKnownFailure: z.enum(["COMPENSATE", "ESCALATE"]),
        onUnknownOutcome: z.literal("RECONCILE"),
        onIndeterminateOutcome: z.literal("ESCALATE"),
      })
      .strict(),
    authorityPolicy: z
      .object({
        autoApproveForward: z.boolean(),
        autoApproveRecovery: z.boolean(),
        maximumValueWei: uintStringSchema,
        allowedTargets: z.array(addressSchema).min(1).max(64),
        allowedFunctions: z.array(z.string().min(1).max(120)).min(1).max(64),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set(value.steps.map((step) => step.id));
    if (ids.size !== value.steps.length)
      context.addIssue({
        code: "custom",
        message: "Step IDs must be unique",
        path: ["steps"],
      });
    for (const [index, step] of value.steps.entries()) {
      for (const dependency of step.dependsOn) {
        if (!ids.has(dependency))
          context.addIssue({
            code: "custom",
            message: `Unknown dependency ${dependency}`,
            path: ["steps", index, "dependsOn"],
          });
        else if (
          value.steps.findIndex((candidate) => candidate.id === dependency) >=
          index
        )
          context.addIssue({
            code: "custom",
            message: `Dependency ${dependency} must appear before the dependent step`,
            path: ["steps", index, "dependsOn"],
          });
      }
      if (
        !value.authorityPolicy.allowedTargets.some(
          (target) =>
            target.toLowerCase() === step.action.contractAddress.toLowerCase(),
        )
      )
        context.addIssue({
          code: "custom",
          message: "Step target is not allowlisted",
          path: ["steps", index, "action", "contractAddress"],
        });
      if (
        !value.authorityPolicy.allowedFunctions.includes(
          step.action.functionName,
        )
      )
        context.addIssue({
          code: "custom",
          message: "Step function is not allowlisted",
          path: ["steps", index, "action", "functionName"],
        });
      if (step.compensation) {
        if (
          !value.authorityPolicy.allowedTargets.some(
            (target) =>
              target.toLowerCase() ===
              step.compensation!.action.contractAddress.toLowerCase(),
          )
        )
          context.addIssue({
            code: "custom",
            message: "Compensation target is not allowlisted",
            path: ["steps", index, "compensation", "action", "contractAddress"],
          });
        if (
          !value.authorityPolicy.allowedFunctions.includes(
            step.compensation.action.functionName,
          )
        )
          context.addIssue({
            code: "custom",
            message: "Compensation function is not allowlisted",
            path: ["steps", index, "compensation", "action", "functionName"],
          });
      }
    }
  });

export const investigationResultSchema = z
  .object({
    summary: z.string().min(1).max(2000),
    likelyCauses: z
      .array(
        z
          .object({
            cause: z.string().min(1).max(500),
            evidenceIds: z.array(idSchema).max(20),
            confidence: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(10),
    recommendedDisposition: z.enum(["CONTINUE", "RECOVER", "ESCALATE"]),
    operatorNotes: z.array(z.string().min(1).max(500)).max(20),
    uncertainty: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict();

export const apiErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    correlationId: z.string().min(1),
    details: z.unknown().optional(),
  })
  .strict();

export const createMissionSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).default(""),
    definition: missionDefinitionSchema,
  })
  .strict();
export const createRunSchema = z
  .object({
    input: z.record(z.string(), z.union([z.string().max(512), z.boolean()])),
    externalId: z.string().max(160).optional(),
  })
  .strict();
export const decisionSchema = z
  .object({ reason: z.string().trim().min(2).max(1000) })
  .strict();

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type MissionState = z.infer<typeof missionStateSchema>;
export type StepState = z.infer<typeof stepStateSchema>;
export type RetryClass = z.infer<typeof retryClassSchema>;
export type MissionDefinition = z.infer<typeof missionDefinitionSchema>;
export type MissionAction = z.infer<typeof actionSchema>;
export type InvestigationResult = z.infer<typeof investigationResultSchema>;

export const TERMINAL_MISSION_STATES: ReadonlySet<MissionState> = new Set([
  "COMPLETED",
  "RECOVERED",
  "NEEDS_ATTENTION",
  "ABORTED_SAFE",
]);
