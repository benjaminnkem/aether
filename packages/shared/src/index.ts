import { z } from "zod";

export const severitySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export const statusSchema = z.enum([
  "healthy",
  "open",
  "investigating",
  "planned",
  "awaiting_approval",
  "simulating",
  "executing",
  "verifying",
  "resolved",
  "failed",
  "retrying",
  "partial",
  "expired",
  "rejected",
  "stale",
]);
export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["owner", "admin", "operator", "reviewer", "viewer"]),
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
  status: z.string(),
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
export const dashboardSchema = z.object({
  organization: organizationSchema,
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
  operation: z.object({
    id: z.string(),
    title: z.string(),
    planHash: z.string(),
    status: statusSchema,
    steps: z.array(operationStepSchema),
  }),
  notifications: z.array(recordSchema),
  scenario: z.string(),
  realtime: z.enum(["connected", "reconnecting", "offline"]),
});
export const desiredStateSchema = z.object({
  version: z.string().regex(/^v\d+\.\d+\.\d+$/),
  chainId: z.coerce.number().int().positive(),
  oracle: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  heartbeatSeconds: z.coerce.number().int().min(60),
  fee: z.object({
    value: z.string().regex(/^\d+$/),
    unit: z.enum(["bps", "wei", "gwei", "ether"]),
  }),
  release: z.string().min(1),
});
export const scenarioSchema = z.enum([
  "healthy",
  "unauthorized-oracle",
  "github-release",
  "cross-chain-mismatch",
  "insufficient-gas",
  "missing-role",
  "approval-rejected",
  "approval-expired",
  "keeperhub-rate-limit",
  "partial-execution",
  "empty-organization",
  "viewer",
  "stale-rpc",
]);

export type Organization = z.infer<typeof organizationSchema>;
export type Protocol = z.infer<typeof protocolSchema>;
export type AetherRecord = z.infer<typeof recordSchema>;
export type OperationStep = z.infer<typeof operationStepSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type DesiredState = z.infer<typeof desiredStateSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;

export const routeTitles: Record<string, string> = {
  overview: "Overview",
  protocols: "Protocols",
  "desired-state": "Desired state",
  deployments: "Deployments",
  contracts: "Contracts",
  drift: "Drift",
  incidents: "Incidents",
  operations: "Operations",
  approvals: "Approvals",
  invariants: "Invariants",
  policies: "Policies",
  "keeperhub-runs": "KeeperHub runs",
  "audit-log": "Audit log",
  integrations: "Integrations",
  team: "Team",
  notifications: "Notifications",
  general: "General settings",
  security: "Security settings",
  "api-keys": "API keys",
  execution: "Execution settings",
  new: "Add protocol",
};
