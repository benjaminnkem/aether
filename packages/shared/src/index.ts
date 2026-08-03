import { z } from "zod";
import { activeLiveChain } from "./chains";

export * from "./chains";

export const severitySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const statusSchema = z.enum([
  "healthy",
  "warning",
  "critical",
  "open",
  "investigating",
  "plan_ready",
  "awaiting_approval",
  "approved",
  "queued",
  "simulating",
  "executing",
  "confirming",
  "verifying",
  "completed",
  "resolved",
  "failed",
  "partial",
  "unknown",
  "reconciling",
  "correction_required",
  "rejected",
]);

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["owner", "operator", "reviewer", "viewer"]),
});

export const authSessionSchema = z.object({
  authenticated: z.literal(true),
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
  }),
  context: z
    .object({
      organizationId: z.string().min(1),
      protocolId: z.string().min(1),
      role: z.enum(["owner", "operator", "reviewer", "viewer"]),
    })
    .optional(),
  destination: z.enum(["dashboard", "onboarding"]),
});

export const protocolSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  environment: z.string(),
  health: z.number().min(0).max(100),
  status: statusSchema,
  release: z.string(),
  repository: z.string(),
  governance: z.string(),
  chains: z.array(z.string()),
  openDrift: z.number().int().nonnegative(),
  lastScanAt: z.string(),
});

export const recordSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  status: statusSchema,
  severity: severitySchema.optional(),
  value: z.string().optional(),
  meta: z.string().optional(),
  timestamp: z.string(),
});

export const operationStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum([
    "read",
    "check",
    "simulation",
    "approval",
    "write",
    "wait",
    "verification",
    "notification",
    "correction",
  ]),
  status: statusSchema,
  detail: z.string(),
});

export const operationSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  planVersion: z.string(),
  planHash: z.string(),
  status: statusSchema,
  risk: severitySchema,
  createdAt: z.string(),
  evidence: z.array(z.string()),
  inference: z.array(z.string()),
  policyChecks: z.array(recordSchema),
  simulation: recordSchema,
  approvals: z.array(recordSchema),
  steps: z.array(operationStepSchema),
});

export const executionSchema = z.object({
  id: z.string(),
  operationId: z.string(),
  directExecutionId: z.string(),
  status: statusSchema,
  network: z.string(),
  currentStep: z.string(),
  startedAt: z.string(),
  updatedAt: z.string(),
  txHash: z.string().optional(),
  gasEstimate: z.string(),
  gasUsed: z.string().optional(),
  error: z.string().optional(),
  reconciliation: z.string().optional(),
  steps: z.array(operationStepSchema),
});

export const overviewSummarySchema = z.object({
  healthScore: z.number().min(0).max(100),
  alignedResources: z.number().int().nonnegative(),
  totalResources: z.number().int().nonnegative(),
  findingsBySeverity: z.object({
    critical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
  }),
  connections: z.array(
    z.object({ id: z.string(), label: z.string(), status: statusSchema }),
  ),
  lifecycle: z.object({
    completed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    current: z.string(),
  }),
  lastObservedAt: z.string(),
});

export const dashboardSchema = z.object({
  organization: organizationSchema.nullable(),
  protocols: z.array(protocolSchema),
  records: z.record(z.string(), z.array(recordSchema)),
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      detail: z.string(),
      trend: z.string().optional(),
    }),
  ),
  operation: operationSchema.optional(),
  execution: executionSchema.optional(),
  notifications: z.array(recordSchema),
  realtime: z.enum(["connected", "reconnecting", "offline"]),
  overviewSummary: overviewSummarySchema.default({
    healthScore: 0,
    alignedResources: 0,
    totalResources: 0,
    findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    connections: [],
    lifecycle: { completed: 0, total: 0, current: "Not started" },
    lastObservedAt: new Date(0).toISOString(),
  }),
});

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const desiredStateSchema = z.object({
  version: z.string().regex(/^v\d+\.\d+\.\d+$/),
  networkId: z.literal(activeLiveChain.slug),
  chainId: z.coerce.number().pipe(z.literal(activeLiveChain.chainId)),
  contractId: z.string().min(1),
  contractVersion: z.string().min(1),
  implementationAddress: addressSchema,
  oracleAddress: addressSchema,
  administrators: z.array(addressSchema).min(1),
  guardians: z.array(addressSchema).min(1),
  paused: z.boolean(),
  fee: z.object({
    value: z.string().regex(/^\d+$/),
    unit: z.literal("bps"),
  }),
  minimumExecutorGas: z.object({
    value: z.string().regex(/^\d+(\.\d+)?$/),
    unit: z.literal("ether"),
  }),
  maximumAutomaticTransaction: z.object({
    value: z.string().regex(/^\d+(\.\d+)?$/),
    unit: z.literal("ether"),
  }),
  release: z.string().min(1),
  source: z.string().min(1),
});

export const githubDesiredStateSourceSchema = z.object({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  branch: z.string().min(1),
  path: z.string().min(1),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/i),
  commitUrl: z.string().url(),
  fileUrl: z.string().url(),
  fetchedAt: z.string().datetime(),
  content: z.string().min(1).max(262_144),
  manifest: desiredStateSchema,
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/i),
  matchesActiveVersion: z.boolean(),
  resolution: z.object({
    repositoryContractId: z.string().min(1),
    resolvedContractId: z.string().min(1),
    matchBasis: z.literal("chain-and-implementation"),
  }),
});

export type Organization = z.infer<typeof organizationSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type Protocol = z.infer<typeof protocolSchema>;
export type AetherRecord = z.infer<typeof recordSchema>;
export type OperationStep = z.infer<typeof operationStepSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type Execution = z.infer<typeof executionSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type OverviewSummary = z.infer<typeof overviewSummarySchema>;
export type DesiredState = z.infer<typeof desiredStateSchema>;
export type GitHubDesiredStateSource = z.infer<
  typeof githubDesiredStateSourceSchema
>;

export const routeTitles: Record<string, string> = {
  overview: "Overview",
  "protocol-setup": "Protocol Setup",
  "desired-state": "Desired State",
  drift: "Drift",
  operations: "Operation Detail",
  executions: "KeeperHub Execution",
  "audit-log": "Audit Log",
};
