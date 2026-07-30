import { delay, http, HttpResponse } from "msw";
import {
  type AetherRecord,
  type Dashboard,
  type OperationStep,
  type Scenario,
} from "@aether/shared";

const now = "2026-07-30T14:42:00.000Z";
const tx = "0x7f92cdd4b9c61bb4729083f6c2db11a4d535acc05372a8cc66dd1e485944ac12";
const address = "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311";
const healthySteps: OperationStep[] = ([
  ["read", "Read current oracle", "read"],
  ["check", "Evaluate oracle allowlist", "check"],
  ["simulate", "Simulate restoration", "simulation"],
  ["approve", "Collect 2-of-3 approval", "approval"],
  ["write", "Execute setOracle", "write"],
  ["finality", "Wait 12 confirmations", "wait"],
  ["verify", "Verify state and freshness", "verification"],
  ["notify", "Close incident", "notification"],
] as const).map(([id, label, type]) => ({
  id,
  label,
  type: type as OperationStep["type"],
  status: "planned",
  detail: `${label} against Arcadia Market on Base Sepolia.`,
}));

const baseRecords: Record<string, AetherRecord[]> = {
  protocols: [
    { id: "arcadia", title: "Arcadia Markets", subtitle: "Production · 3 chains", status: "healthy", value: "v2.4.1", meta: "100% aligned", timestamp: now },
    { id: "atlas", title: "Atlas Treasury", subtitle: "Staging · 2 chains", status: "healthy", value: "v1.8.0", meta: "99% aligned", timestamp: now },
  ],
  deployments: [
    { id: "base", title: "Base Sepolia", subtitle: "Block 17,924,118 · Alchemy", status: "healthy", value: "0.184 ETH", meta: "13 contracts", timestamp: now },
    { id: "eth", title: "Ethereum Sepolia", subtitle: "Block 6,482,991 · Tenderly", status: "healthy", value: "0.392 ETH", meta: "13 contracts", timestamp: now },
    { id: "arb", title: "Arbitrum Sepolia", subtitle: "Block 91,133,402 · QuickNode", status: "healthy", value: "0.226 ETH", meta: "12 contracts", timestamp: now },
  ],
  contracts: [
    { id: "market", title: "ArcadiaMarketProxy", subtitle: address, status: "healthy", value: "UUPS proxy", meta: "ABI verified", timestamp: now },
    { id: "oracle", title: "OracleAdapter", subtitle: "0x93C7…2B91", status: "healthy", value: "Price source", meta: "Owner: Safe", timestamp: now },
    { id: "fee", title: "FeeController", subtitle: "0x84A1…18F0", status: "healthy", value: "50 bps", meta: "Role protected", timestamp: now },
  ],
  drift: [],
  incidents: [],
  operations: [
    { id: "op-release", title: "Roll out FeeController v2", subtitle: "Plan v3 · 8 steps", status: "verifying", severity: "medium", value: "2/3 chains", meta: "KeeperHub KH-8312", timestamp: now },
  ],
  approvals: [
    { id: "apr-1", title: "FeeController v2 rollout", subtitle: "Expires in 47m · Plan 0x5ad8…4c91", status: "open", severity: "medium", value: "1 of 2", meta: "Security reviewer required", timestamp: now },
  ],
  invariants: [
    { id: "inv-1", title: "Oracle freshness < 30m", subtitle: "Evaluated at block 17,924,118", status: "healthy", value: "4m 12s", meta: "Blocking", timestamp: now },
    { id: "inv-2", title: "Approved implementation only", subtitle: "Code hash allowlist v4", status: "healthy", value: "Pass", meta: "Blocking", timestamp: now },
    { id: "inv-3", title: "Executor gas > 0.1 ETH", subtitle: "Across active deployments", status: "healthy", value: "0.184 ETH", meta: "Warning", timestamp: now },
  ],
  policies: [
    { id: "pol-1", title: "Production execution policy", subtitle: "Version 12 · active", status: "healthy", value: "2 approvals", meta: "Canary required", timestamp: now },
    { id: "pol-2", title: "Emergency pause policy", subtitle: "Version 4 · active", status: "healthy", value: "1 reviewer", meta: "No automation", timestamp: now },
  ],
  "keeperhub-runs": [
    { id: "KH-8312", title: "KH-8312 · workflow", subtitle: "FeeController v2 rollout", status: "executing", value: "318,442 gas", meta: "2 transactions", timestamp: now },
    { id: "KH-8308", title: "KH-8308 · simulation", subtitle: "Oracle restoration", status: "resolved", value: "Pass", meta: "0 transactions", timestamp: now },
  ],
  "audit-log": [
    { id: "aud-1", title: "Desired state v2.4.1 activated", subtitle: "Mina Chen · GitHub PR #482", status: "resolved", value: "req_01J8K5", meta: "Manifest hash retained", timestamp: now },
    { id: "aud-2", title: "KeeperHub workflow submitted", subtitle: "Aether worker · operation op-release", status: "executing", value: "corr_2FC71", meta: "Inputs redacted", timestamp: now },
  ],
  integrations: [
    { id: "int-kh", title: "KeeperHub", subtitle: "Mock REST adapter", status: "healthy", value: "Connected", meta: "Execution + simulation", timestamp: now },
    { id: "int-gh", title: "GitHub", subtitle: "aether-labs/arcadia", status: "healthy", value: "Connected", meta: "Read metadata, checks", timestamp: now },
    { id: "int-rpc", title: "RPC providers", subtitle: "3 chains · failover enabled", status: "healthy", value: "Operational", meta: "216ms median", timestamp: now },
    { id: "int-ai", title: "OpenAI", subtitle: "Deterministic mock adapter", status: "healthy", value: "Mock mode", meta: "No external data sent", timestamp: now },
  ],
  team: [
    { id: "mina", title: "Mina Chen", subtitle: "mina@arcadia.finance", status: "healthy", value: "Owner", meta: "Last active now", timestamp: now },
    { id: "sam", title: "Sam Okafor", subtitle: "sam@arcadia.finance", status: "healthy", value: "Security reviewer", meta: "MFA enforced", timestamp: now },
    { id: "bot", title: "deployment-bot", subtitle: "Service account · expires in 42d", status: "healthy", value: "Developer", meta: "GitHub only", timestamp: now },
  ],
  notifications: [
    { id: "note-1", title: "Canary verification in progress", subtitle: "FeeController v2 · Base Sepolia", status: "verifying", value: "Now", meta: "Operation update", timestamp: now },
  ],
};

export const createScenarioDashboard = (scenario: Scenario = "healthy", stage = 0): Dashboard => {
  const records = structuredClone(baseRecords);
  let health = 98;
  let role: Dashboard["organization"]["role"] = "owner";
  let operationStatus: Dashboard["operation"]["status"] = "planned";
  let steps = structuredClone(healthySteps);
  let realtime: Dashboard["realtime"] = "connected";

  if (scenario === "empty-organization") {
    Object.keys(records).forEach((key) => (records[key] = []));
    health = 0;
  }
  if (scenario === "viewer") role = "viewer";
  if (scenario === "stale-rpc") {
    health = 82;
    realtime = "reconnecting";
    records.deployments![1] = { ...records.deployments![1]!, status: "stale", meta: "Partial scan · 11/13 reads" };
  }
  if (scenario === "unauthorized-oracle") {
    health = stage >= 6 ? 98 : 61;
    const resolved = stage >= 6;
    records.drift = [{
      id: "drift-oracle",
      title: "Unauthorized oracle address",
      subtitle: "OracleAdapter · Base Sepolia",
      status: resolved ? "resolved" : stage >= 1 ? "investigating" : "open",
      severity: "critical",
      value: resolved ? address : "0x6F2B…E912",
      meta: resolved ? "Verified at block 17,924,184" : `Desired ${address.slice(0, 10)}…`,
      timestamp: now,
    }];
    records.incidents = [{
      id: "inc-oracle",
      title: "Critical oracle integrity incident",
      subtitle: "1 market · $12.4m supplied value",
      status: resolved ? "resolved" : "investigating",
      severity: "critical",
      value: resolved ? "Closed" : "SEV-1",
      meta: resolved ? "Forward state verified" : `Introduced by ${tx.slice(0, 12)}…`,
      timestamp: now,
    }];
    const statuses: Dashboard["operation"]["status"][] = ["investigating", "planned", "awaiting_approval", "simulating", "executing", "verifying", "resolved"];
    operationStatus = statuses[Math.min(stage, statuses.length - 1)]!;
    steps = steps.map((step, index) => ({
      ...step,
      status: index < stage + 2 ? (resolved ? "resolved" : index === stage + 1 ? operationStatus : "resolved") : "planned",
    }));
  }
  if (scenario === "github-release") records.drift = [{ id: "release", title: "Expected FeeController release drift", subtitle: "GitHub PR #482 · Base pending", status: "planned", severity: "medium", value: "v2.3.0 → v2.4.0", meta: "Authorized source", timestamp: now }];
  if (scenario === "cross-chain-mismatch") records.drift = [{ id: "mismatch", title: "Cross-chain release mismatch", subtitle: "Arbitrum remains on v2.3.0", status: "open", severity: "high", value: "1 chain behind", meta: "Ethereum + Base aligned", timestamp: now }];
  if (scenario === "insufficient-gas") records["keeperhub-runs"]![0] = { ...records["keeperhub-runs"]![0]!, status: "failed", severity: "high", meta: "Executor wallet requires 0.041 ETH" };
  if (scenario === "missing-role") operationStatus = "failed";
  if (scenario === "approval-rejected") operationStatus = "rejected";
  if (scenario === "approval-expired") operationStatus = "expired";
  if (scenario === "keeperhub-rate-limit") operationStatus = "retrying";
  if (scenario === "partial-execution") operationStatus = "partial";

  return {
    organization: { id: "org-arcadia", name: "Arcadia Labs", role },
    protocols: [{
      id: "arcadia",
      organizationId: "org-arcadia",
      name: "Arcadia Markets",
      environment: "Production",
      health,
      status: health > 90 ? "healthy" : "open",
      release: "v2.4.1",
      repository: "aether-labs/arcadia",
      governance: "Safe 2-of-3",
      chains: ["Base", "Ethereum", "Arbitrum"],
      openDrift: records.drift!.filter((record) => record.status !== "resolved").length,
      lastScanAt: now,
    }],
    records,
    metrics: [
      { label: "Protocol health", value: `${health}%`, detail: health > 90 ? "All blocking invariants pass" : "Critical oracle drift is open", trend: health > 90 ? "+2 this week" : "-37 since drift" },
      { label: "Desired alignment", value: health > 90 ? "39 / 39" : "38 / 39", detail: "Typed resources match intent" },
      { label: "Open drift", value: String(records.drift!.filter((record) => record.status !== "resolved").length), detail: "Across 3 deployments" },
      { label: "KeeperHub success", value: "99.2%", detail: "Last 30 days · 124 runs" },
    ],
    operation: { id: "op-oracle", title: "Restore approved oracle", planHash: "0xa41d92c09fb4…8e77", status: operationStatus, steps },
    notifications: records.notifications!,
    scenario,
    realtime,
  };
};

let scenario: Scenario = "healthy";
let stage = 0;
export const resetScenario = () => {
  scenario = "healthy";
  stage = 0;
};
export const handlers = [
  http.get("*/v1/dashboard", async () => {
    await delay(180);
    return HttpResponse.json(createScenarioDashboard(scenario, stage));
  }),
  http.post("*/v1/demo/scenario", async ({ request }) => {
    await delay(160);
    const body = (await request.json()) as { scenario: Scenario };
    scenario = body.scenario;
    stage = 0;
    return HttpResponse.json(createScenarioDashboard(scenario, stage));
  }),
  http.post("*/v1/demo/advance", async () => {
    await delay(240);
    stage = Math.min(stage + 1, 6);
    return HttpResponse.json(createScenarioDashboard(scenario, stage));
  }),
  http.post("*/v1/operations/op-oracle/approval", async ({ request }) => {
    await delay(220);
    const body = (await request.json()) as { decision: "approve" | "reject" };
    stage = body.decision === "approve" ? 3 : 0;
    if (body.decision === "reject") scenario = "approval-rejected";
    return HttpResponse.json(createScenarioDashboard(scenario, stage));
  }),
  http.post("*/v1/desired-state/validate", async ({ request }) => {
    await delay(180);
    return HttpResponse.json(await request.json());
  }),
];
export const mockScenarioNames: Array<{ value: Scenario; label: string }> = [
  { value: "healthy", label: "Healthy protocol" },
  { value: "unauthorized-oracle", label: "Unauthorized oracle drift" },
  { value: "github-release", label: "Expected GitHub release" },
  { value: "cross-chain-mismatch", label: "Cross-chain mismatch" },
  { value: "insufficient-gas", label: "Insufficient executor gas" },
  { value: "missing-role", label: "Simulation missing role" },
  { value: "approval-rejected", label: "Approval rejected" },
  { value: "approval-expired", label: "Approval expired" },
  { value: "keeperhub-rate-limit", label: "KeeperHub rate limit" },
  { value: "partial-execution", label: "Partial execution" },
  { value: "empty-organization", label: "Empty organization" },
  { value: "viewer", label: "Read-only viewer" },
  { value: "stale-rpc", label: "Stale RPC / partial scan" },
];
