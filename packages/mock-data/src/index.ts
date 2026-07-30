import { delay, http, HttpResponse } from "msw";
import {
  type AetherRecord,
  type Dashboard,
  type DesiredState,
  type OperationStep,
  type Scenario,
} from "@aether/shared";

const now = "2026-07-30T14:42:00.000Z";
const approvedOracle = "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311";
const observedOracle = "0x91A6D4bF5c0A8dF0E9F12D78771133796a33B741";
const transaction =
  "0x7f92cdd4b9c61bb4729083f6c2db11a4d535acc05372a8cc66dd1e485944ac12";

const record = (
  id: string,
  title: string,
  subtitle: string,
  status: AetherRecord["status"],
  value?: string,
  meta?: string,
  severity?: AetherRecord["severity"],
): AetherRecord => ({
  id,
  title,
  subtitle,
  status,
  value,
  meta,
  severity,
  timestamp: now,
});

const step = (
  id: string,
  label: string,
  type: OperationStep["type"],
  status: OperationStep["status"],
  detail: string,
): OperationStep => ({ id, label, type, status, detail });

const scenarioLabels: Record<Scenario, string> = {
  healthy: "Healthy protocol",
  "unauthorized-oracle": "Critical oracle drift",
  "approval-execution": "Approval and successful execution",
  "missing-role": "Simulation failure: missing role",
  "partial-execution": "Partial execution and correction",
  "unknown-outcome": "Unknown transaction outcome",
};

export const mockScenarioNames = Object.entries(scenarioLabels).map(
  ([value, label]) => ({ value: value as Scenario, label }),
);

function operationSteps(stage: number, scenario: Scenario): OperationStep[] {
  const statuses: OperationStep["status"][] = [
    stage >= 1 ? "completed" : "investigating",
    stage >= 2 ? "completed" : "plan_ready",
    stage >= 3 ? "completed" : "awaiting_approval",
    stage >= 4 ? "completed" : "queued",
    stage >= 5 ? "completed" : "queued",
    stage >= 6 ? "completed" : "queued",
  ];
  if (scenario === "missing-role") statuses[3] = "failed";
  if (scenario === "partial-execution") {
    statuses[4] = "partial";
    statuses[5] = "correction_required";
  }
  if (scenario === "unknown-outcome") {
    statuses[4] = "unknown";
    statuses[5] = "reconciling";
  }
  return [
    step(
      "evidence",
      "Confirm observed drift",
      "read",
      statuses[0]!,
      `RPC reads show ${observedOracle}; desired state requires ${approvedOracle}.`,
    ),
    step(
      "policy",
      "Build safe correction",
      "check",
      statuses[1]!,
      "Target and setOracle(address) are allowlisted; value transfer is zero.",
    ),
    step(
      "approval",
      "Collect reviewer approval",
      "approval",
      statuses[2]!,
      "One protocol-owner approval is required for critical configuration drift.",
    ),
    step(
      "simulation",
      "Simulate exact calldata",
      "simulation",
      statuses[3]!,
      scenario === "missing-role"
        ? "Reverted: AETHER_EXECUTOR is missing ORACLE_ADMIN_ROLE."
        : "Fork simulation passes with postcondition and gas checks.",
    ),
    step(
      "execute",
      "Execute through KeeperHub",
      "write",
      statuses[4]!,
      "KeeperHub submits setOracle(address) using the approved plan hash.",
    ),
    step(
      "verify",
      "Verify independently",
      "verification",
      statuses[5]!,
      "A separate RPC read checks the final oracle and freshness invariant.",
    ),
  ];
}

function statusFor(scenario: Scenario, stage: number) {
  if (scenario === "healthy" || stage >= 6) return "resolved" as const;
  if (scenario === "missing-role") return "failed" as const;
  if (scenario === "partial-execution") return "correction_required" as const;
  if (scenario === "unknown-outcome") return "reconciling" as const;
  return ([
    "investigating",
    "investigating",
    "plan_ready",
    "approved",
    "simulating",
    "executing",
  ][stage] ?? "verifying") as Dashboard["operation"]["status"];
}

function executionStatus(scenario: Scenario, stage: number) {
  if (scenario === "healthy" || stage >= 6) return "completed" as const;
  if (scenario === "missing-role") return "failed" as const;
  if (scenario === "partial-execution") return "partial" as const;
  if (scenario === "unknown-outcome") return "unknown" as const;
  if (stage < 4) return "queued" as const;
  if (stage === 4) return "simulating" as const;
  return "executing" as const;
}

export function createScenarioDashboard(
  scenario: Scenario = "healthy",
  requestedStage = 0,
): Dashboard {
  const defaultStage =
    scenario === "healthy"
      ? 6
      : scenario === "approval-execution"
        ? 3
        : scenario === "missing-role"
          ? 4
          : scenario === "partial-execution" || scenario === "unknown-outcome"
            ? 5
            : 0;
  const stage = Math.max(requestedStage, defaultStage);
  const resolved = scenario === "healthy" || stage >= 6;
  const operationStatus = statusFor(scenario, stage);
  const currentExecutionStatus = executionStatus(scenario, stage);
  const severity = resolved ? "info" : "critical";
  const drift = resolved
    ? []
    : [
        record(
          "drift-oracle-001",
          "Unauthorized oracle address",
          "ArcadiaMarketProxy · Base Sepolia",
          stage >= 5 ? "investigating" : "open",
          `${observedOracle.slice(0, 10)}…`,
          `Desired ${approvedOracle.slice(0, 10)}… · block 17,924,118`,
          "critical",
        ),
      ];
  const audit = [
    record(
      "audit-scan",
      "Observation scan completed",
      "Aether observer · Base Sepolia block 17,924,118",
      "completed",
      "scan_01J8N6",
      resolved ? "All resources aligned" : "1 critical difference",
    ),
    ...(resolved
      ? [
          record(
            "audit-verify",
            "Oracle correction independently verified",
            "Aether verifier · 12 confirmations",
            "resolved",
            "verify_01J8N9",
            transaction,
          ),
        ]
      : [
          record(
            "audit-drift",
            "Critical drift incident opened",
            "Aether policy engine · unauthorized change",
            "open",
            "incident_01J8N7",
            "Evidence snapshot retained",
            "critical",
          ),
        ]),
    ...(stage >= 3
      ? [
          record(
            "audit-approval",
            "Correction plan approved",
            "Mina Chen · owner",
            "approved",
            "plan v1",
            "Plan hash 0x5ad8…4c91",
          ),
        ]
      : []),
    ...(stage >= 5
      ? [
          record(
            "audit-execution",
            "KeeperHub workflow updated",
            "Mock KeeperHub adapter · KH-8314",
            currentExecutionStatus,
            "exec-kh-8314",
            currentExecutionStatus === "unknown"
              ? "Receipt unavailable; reconciliation active"
              : transaction,
          ),
        ]
      : []),
  ];

  return {
    organization: {
      id: "org-arcadia",
      name: "Arcadia Labs",
      role: "owner",
    },
    protocols: [
      {
        id: "arcadia",
        organizationId: "org-arcadia",
        name: "Arcadia Markets",
        environment: "Testnet",
        health: resolved ? 100 : scenario === "partial-execution" ? 58 : 64,
        status: resolved ? "healthy" : "critical",
        release: "v2.4.2",
        repository: "github.com/arcadia-labs/markets",
        governance: "Arcadia Security Safe · 2-of-3",
        chains: ["Base Sepolia", "Ethereum Sepolia"],
        openDrift: drift.length,
        lastScanAt: now,
      },
    ],
    metrics: [
      {
        label: "Protocol health",
        value: resolved ? "100%" : "64%",
        detail: resolved
          ? "All observed resources aligned"
          : "Critical drift open",
        trend: resolved ? "Verified 2m ago" : "Detected 11m ago",
      },
      {
        label: "Networks",
        value: "2",
        detail: "Both RPC providers responding",
      },
      {
        label: "Contracts",
        value: "3",
        detail: "Proxy and ABI metadata verified",
      },
      {
        label: "Open drift",
        value: String(drift.length),
        detail: resolved ? "No active incidents" : "1 critical finding",
      },
    ],
    records: {
      networks: [
        record(
          "base-sepolia",
          "Base Sepolia",
          "Chain 84532 · block 17,924,118",
          "healthy",
          "216 ms",
          "RPC fresh · executor 0.184 ETH",
        ),
        record(
          "eth-sepolia",
          "Ethereum Sepolia",
          "Chain 11155111 · block 6,482,991",
          "healthy",
          "284 ms",
          "RPC fresh · executor 0.392 ETH",
        ),
      ],
      contracts: [
        record(
          "market",
          "ArcadiaMarketProxy",
          "0x7D4A3AfF7c4C51B1726a91c738ACb6F227127C3f",
          resolved ? "healthy" : "critical",
          "UUPS proxy",
          "ABI verified",
        ),
        record(
          "oracle",
          "OracleAdapter",
          approvedOracle,
          "healthy",
          "Price source",
          "Owner: Arcadia Security Safe",
        ),
        record(
          "fee",
          "FeeController",
          "0x84A1d4E153eD36F4DeF11F2D30e90E614B9418F0",
          "healthy",
          "50 bps",
          "Role protected",
        ),
      ],
      connections: [
        record(
          "github",
          "GitHub",
          "arcadia-labs/markets · main",
          "healthy",
          "Connected",
          "Read-only release provenance",
        ),
        record(
          "keeperhub",
          "KeeperHub",
          "Mock workflow adapter",
          "healthy",
          "Connected",
          "Simulation and execution",
        ),
      ],
      drift,
      operations: [
        record(
          "op-oracle-restoration",
          "Restore approved oracle",
          "Immutable plan v1 · Base Sepolia",
          operationStatus,
          "6 steps",
          "Plan 0x5ad8…4c91",
          severity,
        ),
      ],
      executions: [
        record(
          "exec-kh-8314",
          "KH-8314 · Oracle restoration",
          "KeeperHub workflow · Base Sepolia",
          currentExecutionStatus,
          stage >= 5 ? "Transaction submitted" : "Awaiting execution",
          transaction,
          severity,
        ),
      ],
      "audit-log": audit,
    },
    operation: {
      id: "op-oracle-restoration",
      title: "Restore approved oracle",
      summary:
        "Restore ArcadiaMarketProxy to the oracle address approved in desired state v2.4.2.",
      planVersion: "v1",
      planHash:
        "0x5ad8a4a010143742c20e3bfc25e30cedd0ea40f153d35c32d7d7726142844c91",
      status: operationStatus,
      risk: severity,
      createdAt: now,
      evidence: [
        `Observed oracle: ${observedOracle}`,
        `Desired oracle: ${approvedOracle}`,
        "Change first appeared between blocks 17,923,901 and 17,924,118.",
      ],
      inference: [
        "The change was not associated with the configured GitHub release.",
        "A privileged direct call is the most likely source; attribution is not proven.",
      ],
      policyChecks: [
        record(
          "target",
          "Target allowlist",
          "ArcadiaMarketProxy is approved",
          "healthy",
          "Pass",
        ),
        record(
          "function",
          "Function allowlist",
          "setOracle(address) is approved",
          "healthy",
          "Pass",
        ),
        record(
          "value",
          "Value transfer",
          "No native token transfer",
          "healthy",
          "0 ETH",
        ),
      ],
      simulation: record(
        "simulation",
        scenario === "missing-role"
          ? "Simulation reverted"
          : "Simulation passed",
        "Base Sepolia fork · block 17,924,118",
        scenario === "missing-role" ? "failed" : "healthy",
        scenario === "missing-role" ? "Missing role" : "284,211 gas",
        scenario === "missing-role"
          ? "AETHER_EXECUTOR lacks ORACLE_ADMIN_ROLE"
          : "Postcondition matched",
      ),
      approvals: [
        record(
          "approval-mina",
          stage >= 3 ? "Approved by Mina Chen" : "Owner approval required",
          stage >= 3
            ? "Bound to plan v1 and simulation sim_8314"
            : "Expires 60 minutes after simulation",
          stage >= 3 ? "approved" : "awaiting_approval",
          stage >= 3 ? "Approved" : "0 of 1",
        ),
      ],
      steps: operationSteps(stage, scenario),
    },
    execution: {
      id: "exec-kh-8314",
      operationId: "op-oracle-restoration",
      workflowId: "KH-8314",
      status: currentExecutionStatus,
      network: "Base Sepolia",
      currentStep:
        currentExecutionStatus === "completed"
          ? "Independent verification complete"
          : currentExecutionStatus === "unknown"
            ? "Reconciling transaction outcome"
            : currentExecutionStatus === "partial"
              ? "Forward correction required"
              : currentExecutionStatus === "failed"
                ? "Simulation failed"
                : stage >= 5
                  ? "Waiting for confirmations"
                  : "Awaiting approved plan",
      startedAt: now,
      updatedAt: now,
      txHash: stage >= 5 ? transaction : undefined,
      gasEstimate: "284,211",
      gasUsed:
        stage >= 5 && scenario !== "unknown-outcome" ? "279,884" : undefined,
      error:
        scenario === "missing-role"
          ? "Execution blocked before submission: missing ORACLE_ADMIN_ROLE."
          : scenario === "partial-execution"
            ? "Transaction confirmed, but the independent freshness check failed."
            : scenario === "unknown-outcome"
              ? "RPC timeout after submission; do not retry until reconciliation completes."
              : undefined,
      reconciliation:
        scenario === "partial-execution"
          ? "Create a forward-correction plan to restore the oracle heartbeat."
          : scenario === "unknown-outcome"
            ? "Aether is checking the transaction hash across two RPC providers and KeeperHub."
            : undefined,
      steps: operationSteps(stage, scenario),
    },
    notifications: audit.slice(0, 3),
    scenario,
    lifecycleStage: stage,
    realtime: scenario === "unknown-outcome" ? "reconnecting" : "connected",
  };
}

let activeScenario: Scenario = "healthy";
let lifecycleStage = 0;

const snapshot = () => createScenarioDashboard(activeScenario, lifecycleStage);

export function resetScenario() {
  activeScenario = "healthy";
  lifecycleStage = 0;
}

async function latency() {
  await delay(180);
}

export const handlers = [
  http.get("/v1/dashboard", async () => {
    await latency();
    return HttpResponse.json(snapshot());
  }),
  http.post("/v1/demo/scenario", async ({ request }) => {
    const body = (await request.json()) as { scenario: Scenario };
    activeScenario = body.scenario;
    lifecycleStage = 0;
    await latency();
    return HttpResponse.json(snapshot());
  }),
  http.post("/v1/demo/advance", async () => {
    lifecycleStage =
      activeScenario === "unauthorized-oracle"
        ? Math.min(2, lifecycleStage + 1)
        : Math.min(6, lifecycleStage + 1);
    await latency();
    return HttpResponse.json(snapshot());
  }),
  http.post("/v1/operations/:operationId/approval", async ({ request }) => {
    const body = (await request.json()) as { decision: "approve" | "reject" };
    if (body.decision === "reject") {
      activeScenario = "unauthorized-oracle";
      lifecycleStage = 2;
    } else {
      activeScenario = "approval-execution";
      lifecycleStage = 3;
    }
    await latency();
    return HttpResponse.json(snapshot());
  }),
  http.post("/v1/desired-state/validate", async ({ request }) => {
    await latency();
    return HttpResponse.json((await request.json()) as DesiredState);
  }),
];

type Listener = (event: {
  id: string;
  type: "dashboard.updated" | "operation.progress";
  sequence: number;
  createdAt: string;
}) => void;
const listeners = new Set<Listener>();
let sequence = 0;
const publish = () => {
  sequence += 1;
  listeners.forEach((listener) =>
    listener({
      id: `evt-${sequence}`,
      type: "operation.progress",
      sequence,
      createdAt: now,
    }),
  );
};

export const mockTransport = {
  async getDashboard() {
    await latency();
    return snapshot();
  },
  async setScenario(scenario: Scenario) {
    activeScenario = scenario;
    lifecycleStage = 0;
    publish();
    await latency();
    return snapshot();
  },
  async advanceLifecycle() {
    lifecycleStage =
      activeScenario === "unauthorized-oracle"
        ? Math.min(2, lifecycleStage + 1)
        : Math.min(6, lifecycleStage + 1);
    publish();
    await latency();
    return snapshot();
  },
  async approveOperation(decision: "approve" | "reject") {
    if (decision === "approve") {
      activeScenario = "approval-execution";
      lifecycleStage = 3;
    } else {
      activeScenario = "unauthorized-oracle";
      lifecycleStage = 2;
    }
    publish();
    await latency();
    return snapshot();
  },
  async validateDesiredState(input: DesiredState) {
    await latency();
    return input;
  },
};

export const mockRealtime = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
