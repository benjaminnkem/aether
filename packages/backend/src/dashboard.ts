import type {
  AetherRecord,
  Dashboard,
  OperationStep,
  Scenario,
} from "@aether/shared";
import { ExecutionSafety } from "./safety";
import type { PolicyEnvelope, TransactionRequest } from "./contracts";
import type { BoundApproval } from "./contracts";

export interface MvpState {
  scenario: Scenario;
  lifecycleStage: number;
  desiredState?: Record<string, unknown>;
  setup?: Record<string, unknown>;
  approval?: BoundApproval;
}

export const defaultMvpState: MvpState = {
  scenario: "healthy",
  lifecycleStage: 6,
};

const timestamp = "2026-07-30T14:42:00.000Z";
const approvedOracle = "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311";
const observedOracle = "0x91A6D4bF5c0A8dF0E9F12D78771133796a33B741";
const market = "0x7D4A3AfF7c4C51B1726a91c738ACb6F227127C3f";
const txHash =
  "0x7f92cdd4b9c61bb4729083f6c2db11a4d535acc05372a8cc66dd1e485944ac12";

export const mvpOperationRequest: TransactionRequest = {
  chainId: 84532,
  target: market,
  functionSignature: "setOracle(address)",
  calldata:
    "0x7c423f540000000000000000000000002c8a7e78b8d6909a2171b8449a3c1b8d64f44311",
  valueWei: "0",
  desiredOracle: approvedOracle,
};
export const mvpPlanHash = ExecutionSafety.planHash(
  mvpOperationRequest,
  "dsv-active",
);
export const mvpPolicy: PolicyEnvelope = {
  allowedChainIds: [84532],
  allowedTargets: [market],
  allowedFunctions: ["setOracle(address)"],
  maximumValueWei: "0",
  requireSimulation: true,
  requireIndependentVerification: true,
  approvalThreshold: 1,
};

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
  timestamp,
});

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
  const step = (
    id: string,
    label: string,
    type: OperationStep["type"],
    index: number,
    detail: string,
  ): OperationStep => ({ id, label, type, status: statuses[index]!, detail });
  return [
    step(
      "evidence",
      "Confirm observed drift",
      "read",
      0,
      `RPC reads show ${observedOracle}; desired state requires ${approvedOracle}.`,
    ),
    step(
      "policy",
      "Build safe correction",
      "check",
      1,
      "Target and setOracle(address) are allowlisted; value transfer is zero.",
    ),
    step(
      "approval",
      "Collect reviewer approval",
      "approval",
      2,
      "One protocol-owner approval is required for critical configuration drift.",
    ),
    step(
      "simulation",
      "Simulate exact calldata",
      "simulation",
      3,
      scenario === "missing-role"
        ? "Reverted: AETHER_EXECUTOR is missing ORACLE_ADMIN_ROLE."
        : "Fork simulation passes with postcondition and gas checks.",
    ),
    step(
      "execute",
      "Execute through KeeperHub",
      "write",
      4,
      "KeeperHub submits setOracle(address) using the approved plan hash.",
    ),
    step(
      "verify",
      "Verify independently",
      "verification",
      5,
      "A separate RPC read checks the final oracle and freshness invariant.",
    ),
  ];
}

function operationStatus(
  scenario: Scenario,
  stage: number,
): Dashboard["operation"]["status"] {
  if (scenario === "healthy" || stage >= 6) return "resolved";
  if (scenario === "missing-role") return "failed";
  if (scenario === "partial-execution") return "correction_required";
  if (scenario === "unknown-outcome") return "reconciling";
  return (
    (
      [
        "investigating",
        "investigating",
        "plan_ready",
        "approved",
        "simulating",
        "executing",
      ] as const
    )[stage] ?? "verifying"
  );
}

function executionStatus(
  scenario: Scenario,
  stage: number,
): Dashboard["execution"]["status"] {
  if (scenario === "healthy" || stage >= 6) return "completed";
  if (scenario === "missing-role") return "failed";
  if (scenario === "partial-execution") return "partial";
  if (scenario === "unknown-outcome") return "unknown";
  if (stage < 4) return "queued";
  if (stage === 4) return "simulating";
  return "executing";
}

export function createDashboard(state: MvpState): Dashboard {
  const scenario = state.scenario;
  const stage = state.lifecycleStage;
  const resolved = scenario === "healthy" || stage >= 6;
  const opStatus = operationStatus(scenario, stage);
  const execStatus = executionStatus(scenario, stage);
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
            txHash,
          ),
        ]
      : [
          record(
            "audit-drift",
            "Critical drift incident opened",
            "Aether policy engine · unauthorized change",
            "open",
            "finding_01J8N7",
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
            "KeeperHub adapter · KH-8314",
            execStatus,
            "exec-kh-8314",
            execStatus === "unknown"
              ? "Receipt unavailable; reconciliation active"
              : txHash,
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
        lastScanAt: timestamp,
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
        detail: resolved ? "No active findings" : "1 critical finding",
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
          market,
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
          "Typed workflow adapter",
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
          opStatus,
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
          execStatus,
          stage >= 5 ? "Transaction submitted" : "Awaiting execution",
          txHash,
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
      planHash: mvpPlanHash,
      status: opStatus,
      risk: severity,
      createdAt: timestamp,
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
      status: execStatus,
      network: "Base Sepolia",
      currentStep:
        execStatus === "completed"
          ? "Independent verification complete"
          : execStatus === "unknown"
            ? "Reconciling transaction outcome"
            : execStatus === "partial"
              ? "Forward correction required"
              : execStatus === "failed"
                ? "Simulation failed"
                : stage >= 5
                  ? "Waiting for confirmations"
                  : "Awaiting approved plan",
      startedAt: timestamp,
      updatedAt: timestamp,
      txHash: stage >= 5 ? txHash : undefined,
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
