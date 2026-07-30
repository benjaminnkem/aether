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
});

export type PolicyEnvelope = z.infer<typeof policyEnvelopeSchema>;

export const simulationResultSchema = z.object({
  simulationId: z.string().min(1),
  planHash: bytes32Schema,
  success: z.boolean(),
  gasEstimate: z.string().regex(/^\d+$/),
  postconditionMatched: z.boolean(),
  blockNumber: z.number().int().positive(),
  errorCode: z.string().optional(),
});

export const keeperSubmissionSchema = z.object({
  workflowId: z.string().min(1),
  providerCorrelationId: z.string().min(1),
  status: z.enum(["accepted", "submitted", "unknown"]),
  transactionHash: bytes32Schema.optional(),
});

export const keeperStatusSchema = z.object({
  workflowId: z.string().min(1),
  providerCorrelationId: z.string().min(1),
  status: z.enum(["pending", "confirmed", "failed", "unknown"]),
  transactionHash: bytes32Schema.optional(),
  blockNumber: z.number().int().positive().optional(),
  confirmations: z.number().int().nonnegative().optional(),
});

export const chainObservationSchema = z.object({
  chainId: z.number().int().positive(),
  blockNumber: z.number().int().positive(),
  blockHash: bytes32Schema,
  contract: evmAddressSchema,
  oracle: evmAddressSchema,
  observedAt: z.string().datetime(),
});

export const verificationResultSchema = z.object({
  verified: z.boolean(),
  oracle: evmAddressSchema,
  blockNumber: z.number().int().positive(),
  confirmations: z.number().int().nonnegative(),
  providerCorrelationId: z.string().min(1),
});

export const githubReleaseSchema = z.object({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  tag: z.string().min(1),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/i),
  url: z.string().url(),
  publishedAt: z.string().datetime(),
});

export interface ChainReader {
  observeOracle(
    chainId: number,
    contract: string,
    blockNumber?: number,
  ): Promise<z.input<typeof chainObservationSchema>>;
  verifyOracle(
    request: TransactionRequest,
    minimumConfirmations: number,
  ): Promise<z.input<typeof verificationResultSchema>>;
}

export interface Simulator {
  simulate(
    planHash: string,
    request: TransactionRequest,
    blockNumber: number,
  ): Promise<z.input<typeof simulationResultSchema>>;
}

export interface KeeperHubProvider {
  submit(
    idempotencyKey: string,
    planHash: string,
    request: TransactionRequest,
  ): Promise<z.input<typeof keeperSubmissionSchema>>;
  reconcile(
    providerCorrelationId: string,
  ): Promise<z.input<typeof keeperStatusSchema>>;
}

export interface GitHubProvider {
  getRelease(
    repository: string,
    tag: string,
  ): Promise<z.input<typeof githubReleaseSchema>>;
}

export const queueNames = [
  "observation.scan",
  "drift.evaluate",
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
