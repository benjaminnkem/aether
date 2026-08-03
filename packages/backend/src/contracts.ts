import { z } from "zod";

export const tenantContextSchema = z.object({
  actorId: z.string().min(1),
  organizationId: z.string().min(1),
  protocolId: z.string().min(1),
  role: z.enum(["owner", "operator", "reviewer", "viewer"]),
});

export type TenantContext = z.infer<typeof tenantContextSchema>;

const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const commitShaSchema = z.string().regex(/^[a-f0-9]{40}$/i);

export const providerHealthSchema = z.object({
  provider: z.enum(["evm-rpc", "keeperhub", "github", "openai"]),
  status: z.enum(["healthy", "degraded", "unavailable", "not_configured"]),
  checkedAt: z.string().datetime(),
  latencyMs: z.number().int().nonnegative().optional(),
  consecutiveFailures: z.number().int().nonnegative(),
  rateLimitedUntil: z.string().datetime().optional(),
  detail: z.string().max(240).optional(),
});

export type ProviderHealth = z.infer<typeof providerHealthSchema>;

export interface HealthCheckedProvider {
  getHealth(): ProviderHealth;
}

export const transactionRequestSchema = z.object({
  chainId: z.number().int().positive(),
  target: evmAddressSchema,
  functionSignature: z.literal("setOracle(address)"),
  calldata: z.string().regex(/^0x[a-fA-F0-9]+$/),
  valueWei: z.string().regex(/^\d+$/),
  desiredOracle: evmAddressSchema,
});

export type TransactionRequest = z.infer<typeof transactionRequestSchema>;

export const policyEnvelopeSchema = z.object({
  allowedChainIds: z.array(z.number().int().positive()).min(1),
  allowedTargets: z.array(evmAddressSchema).min(1),
  allowedFunctions: z.array(z.literal("setOracle(address)")).min(1),
  maximumValueWei: z.string().regex(/^\d+$/),
  requireSimulation: z.literal(true),
  requireIndependentVerification: z.literal(true),
  approvalThreshold: z.number().int().min(1),
  prohibitSelfApproval: z.boolean().default(false),
});

export type PolicyEnvelope = z.infer<typeof policyEnvelopeSchema>;

export const simulationResultSchema = z.object({
  simulationId: z.string().min(1),
  planHash: bytes32Schema,
  success: z.boolean(),
  gasEstimate: z.string().regex(/^\d+$/),
  postconditionMatched: z.boolean(),
  blockNumber: z.number().int().positive(),
  errorCode: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
});

export const keeperSubmissionSchema = z.object({
  directExecutionId: z.string().min(1),
  providerCorrelationId: z.string().min(1),
  status: z.enum(["accepted", "submitted", "unknown"]),
  transactionHash: bytes32Schema.optional(),
  transactionLink: z.string().url().optional(),
  gasUsedWei: z.string().regex(/^\d+$/).optional(),
  error: z.string().max(1_000).optional(),
  completedAt: z.string().datetime().optional(),
  pollIntervalHintMs: z.number().int().min(250).max(60_000).optional(),
});

export const keeperStatusSchema = z.object({
  directExecutionId: z.string().min(1),
  providerCorrelationId: z.string().min(1),
  status: z.enum(["pending", "confirmed", "failed", "unknown"]),
  transactionHash: bytes32Schema.optional(),
  transactionLink: z.string().url().optional(),
  gasUsedWei: z.string().regex(/^\d+$/).optional(),
  error: z.string().max(1_000).optional(),
  completedAt: z.string().datetime().optional(),
  pollIntervalHintMs: z.number().int().min(250).max(60_000).optional(),
  blockNumber: z.number().int().positive().optional(),
  confirmations: z.number().int().nonnegative().optional(),
  transactions: z
    .array(
      z.object({
        hash: bytes32Schema,
        stepId: z.string().min(1),
        stepName: z.string().min(1),
        chainId: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  steps: z
    .array(
      z.object({
        stepId: z.string().min(1),
        stepName: z.string().min(1),
        status: z.enum([
          "pending",
          "running",
          "success",
          "failed",
          "cancelled",
        ]),
      }),
    )
    .optional(),
});

export const keeperStepLogSchema = z.object({
  logId: z.string().min(1),
  directExecutionId: z.string().min(1),
  stepId: z.string().min(1),
  stepName: z.string().min(1),
  stepType: z.string().min(1),
  status: z.enum(["pending", "running", "success", "failed", "cancelled"]),
  transactionHash: bytes32Schema.optional(),
  error: z.string().max(1_000).optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  evidence: z.record(z.string(), z.unknown()),
});

export const keeperStepLogsSchema = z.array(keeperStepLogSchema);
export type KeeperStepLog = z.infer<typeof keeperStepLogSchema>;

export const chainObservationSchema = z.object({
  chainId: z.number().int().positive(),
  blockNumber: z.number().int().positive(),
  blockHash: bytes32Schema,
  contract: evmAddressSchema,
  oracle: evmAddressSchema,
  oracleUpdatedAt: z.number().int().nonnegative(),
  fresh: z.boolean(),
  canonical: z.boolean(),
  observedAt: z.string().datetime(),
});

export const verificationResultSchema = z.object({
  verified: z.boolean(),
  oracle: evmAddressSchema,
  oracleUpdatedAt: z.number().int().nonnegative(),
  fresh: z.boolean(),
  blockNumber: z.number().int().positive(),
  blockHash: bytes32Schema,
  confirmations: z.number().int().nonnegative(),
  canonical: z.boolean(),
  providerCorrelationId: z.string().min(1),
});

export const chainLogSchema = z.object({
  address: evmAddressSchema,
  blockNumber: z.number().int().positive(),
  blockHash: bytes32Schema,
  transactionHash: bytes32Schema,
  logIndex: z.number().int().nonnegative(),
  topics: z.array(bytes32Schema),
  data: z.string().regex(/^0x[a-fA-F0-9]*$/),
  removed: z.boolean(),
});

export const chainReceiptSchema = z.object({
  transactionHash: bytes32Schema,
  blockNumber: z.number().int().positive(),
  blockHash: bytes32Schema,
  success: z.boolean(),
  confirmations: z.number().int().nonnegative(),
  canonical: z.boolean(),
  logs: z.array(chainLogSchema),
});

export const githubReleaseSchema = z.object({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  tag: z.string().min(1),
  commitSha: commitShaSchema,
  url: z.string().url(),
  publishedAt: z.string().datetime(),
});

export const githubRepositorySchema = z.object({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  defaultBranch: z.string().min(1),
  url: z.string().url(),
  visibility: z.enum(["public", "private", "internal"]),
  archived: z.boolean(),
  pushedAt: z.string().datetime(),
});

export const githubCommitSchema = z.object({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  commitSha: commitShaSchema,
  url: z.string().url(),
  message: z.string().min(1),
  authoredAt: z.string().datetime(),
  verified: z.boolean(),
});

export const githubPullRequestSchema = z.object({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  number: z.number().int().positive(),
  url: z.string().url(),
  state: z.enum(["open", "closed"]),
  merged: z.boolean(),
  headCommitSha: commitShaSchema,
  baseCommitSha: commitShaSchema,
  updatedAt: z.string().datetime(),
});

export const investigationInputSchema = z.object({
  findingId: z.string().min(1),
  observedFacts: z.array(z.string().min(1)).min(1).max(30),
  desiredStateFacts: z.array(z.string().min(1)).min(1).max(30),
  allowedChainIds: z.array(z.number().int().positive()).min(1),
  allowedTargets: z.array(evmAddressSchema).min(1),
  allowedFunctions: z.array(z.literal("setOracle(address)")).min(1),
});

export const investigationSuggestionSchema = z.object({
  summary: z.string().min(1).max(2_000),
  facts: z.array(z.string().min(1).max(500)).min(1).max(30),
  inferences: z.array(z.string().min(1).max(500)).max(30),
  confidence: z.number().min(0).max(1),
  affectedInvariants: z.array(z.string().min(1).max(300)).max(20),
  recommendedAction: z.string().min(1).max(1_000),
  evidenceReferences: z.array(z.string().min(1)).min(1).max(30),
  suggestedPlan: z
    .object({
      chainId: z.number().int().positive(),
      target: evmAddressSchema,
      functionSignature: z.literal("setOracle(address)"),
      desiredOracle: evmAddressSchema,
      rationale: z.string().min(1).max(1_000),
    })
    .nullable(),
  advisoryOnly: z.literal(true),
});

export type InvestigationInput = z.infer<typeof investigationInputSchema>;

export interface ChainReader extends HealthCheckedProvider {
  observeOracle(
    chainId: number,
    contract: string,
    blockNumber?: number,
  ): Promise<z.input<typeof chainObservationSchema>>;
  getLogs(input: {
    chainId: number;
    address: string;
    fromBlock: number;
    toBlock: number;
    topics?: string[];
  }): Promise<z.input<typeof chainLogSchema>[]>;
  getTransactionActor(
    chainId: number,
    transactionHash: string,
  ): Promise<string>;
  getReceipt(
    chainId: number,
    transactionHash: string,
    minimumConfirmations: number,
  ): Promise<z.input<typeof chainReceiptSchema> | undefined>;
  verifyOracle(
    request: TransactionRequest,
    minimumConfirmations: number,
    transactionHash?: string,
  ): Promise<z.input<typeof verificationResultSchema>>;
}

export interface Simulator extends HealthCheckedProvider {
  simulate(
    planHash: string,
    request: TransactionRequest,
    blockNumber: number,
  ): Promise<z.input<typeof simulationResultSchema>>;
}

export interface KeeperHubProvider extends HealthCheckedProvider {
  submit(
    idempotencyKey: string,
    planHash: string,
    request: TransactionRequest,
  ): Promise<z.input<typeof keeperSubmissionSchema>>;
  reconcile(
    providerCorrelationId: string,
    directExecutionId?: string,
  ): Promise<z.input<typeof keeperStatusSchema>>;
  getStepLogs(
    directExecutionId: string,
  ): Promise<z.input<typeof keeperStepLogSchema>[]>;
}

export interface GitHubProvider extends HealthCheckedProvider {
  getRepository(
    repository: string,
  ): Promise<z.input<typeof githubRepositorySchema>>;
  getRelease(
    repository: string,
    tag: string,
  ): Promise<z.input<typeof githubReleaseSchema>>;
  getCommit(
    repository: string,
    reference: string,
  ): Promise<z.input<typeof githubCommitSchema>>;
  getPullRequest(
    repository: string,
    number: number,
  ): Promise<z.input<typeof githubPullRequestSchema>>;
}

export interface InvestigationAssistant extends HealthCheckedProvider {
  suggest(
    input: InvestigationInput,
  ): Promise<z.input<typeof investigationSuggestionSchema>>;
}

export const queueNames = [
  "observation.scan",
  "drift.evaluate",
  "investigation.run",
  "operation.simulate",
  "execution.submit",
  "execution.reconcile",
  "execution.verify",
  "audit.dispatch",
] as const;

export type QueueName = (typeof queueNames)[number];

export const durableJobSchema = z.object({
  organizationId: z.string().min(1),
  protocolId: z.string().min(1),
  resourceId: z.string().min(1),
  idempotencyKey: z.string().min(16),
  correlationId: z.string().min(1),
});

export type DurableJob = z.infer<typeof durableJobSchema>;

export const boundApprovalSchema = z.object({
  actorId: z.string().min(1),
  planHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  simulationId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  expiresAt: z.string().datetime(),
});

export type BoundApproval = z.infer<typeof boundApprovalSchema>;

export const realtimeEventTypeSchema = z.enum([
  "dashboard.updated",
  "drift.detected",
  "operation.updated",
  "execution.updated",
  "audit.recorded",
]);

export interface RealtimeEnvelope {
  id: string;
  sequence: number;
  type: z.infer<typeof realtimeEventTypeSchema>;
  organizationId: string;
  protocolId: string;
  resourceId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
