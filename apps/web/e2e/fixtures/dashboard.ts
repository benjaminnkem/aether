const now = "2026-08-03T12:00:00.000Z";
const record = (
  id: string,
  title: string,
  status = "healthy",
  subtitle = "Persisted test evidence",
) => ({ id, title, subtitle, status, timestamp: now });

const steps = [
  {
    id: "read",
    label: "Read state",
    type: "read",
    status: "completed",
    detail: "Pinned observation loaded.",
  },
  {
    id: "policy",
    label: "Policy check",
    type: "check",
    status: "completed",
    detail: "Target and function allowlisted.",
  },
  {
    id: "execute",
    label: "KeeperHub execute",
    type: "write",
    status: "executing",
    detail: "Direct execution is active.",
  },
  {
    id: "verify",
    label: "Independent verify",
    type: "verification",
    status: "queued",
    detail: "Waiting for finality.",
  },
];

export const dashboardFixture = {
  organization: { id: "org_visual", name: "Aether Labs", role: "owner" },
  protocols: [
    {
      id: "pro_visual",
      organizationId: "org_visual",
      name: "Arcadia Market",
      environment: "Ethereum Sepolia",
      health: 74,
      status: "critical",
      release: "v2.4.1",
      repository: "benjaminnkem/aether",
      governance: "0x1111111111111111111111111111111111111111",
      chains: ["11155111"],
      openDrift: 1,
      lastScanAt: now,
    },
  ],
  records: {
    networks: [
      record("sepolia", "Ethereum Sepolia", "healthy", "Chain ID 11155111"),
    ],
    contracts: [
      {
        ...record(
          "market",
          "ArcadiaMarket",
          "healthy",
          "Verified ERC-1967 proxy",
        ),
        value: "0x2222222222222222222222222222222222222222",
      },
    ],
    connections: [
      {
        ...record("github", "GitHub", "healthy", "Connected"),
        meta: "benjaminnkem · benjaminnkem/aether · read-only",
      },
      {
        ...record("keeperhub", "KeeperHub", "healthy", "Connected"),
        meta: "Ethereum Sepolia · wallet funded · simulation ready",
      },
    ],
    "desired-state": [
      {
        ...record("desired-v1", "v2.4.1", "healthy", "owner@example.invalid"),
        value: "Active",
        meta: "sha256:visual",
      },
    ],
    drift: [
      {
        ...record(
          "finding-1",
          "Oracle address diverged",
          "open",
          "Observed at pinned block 6,812,004",
        ),
        severity: "critical",
        value: "0x3333333333333333333333333333333333333333",
      },
    ],
    operations: [
      record(
        "operation-1",
        "Restore approved oracle",
        "awaiting_approval",
        "plan-v1",
      ),
    ],
    executions: [
      record(
        "execution-1",
        "KeeperHub direct execution",
        "executing",
        "kh_visual",
      ),
    ],
    "audit-log": [
      record("audit-1", "observation.drift_detected", "completed", "worker"),
      record(
        "audit-2",
        "operation.plan_created",
        "completed",
        "owner@example.invalid",
      ),
    ],
  },
  metrics: [
    { label: "Open drift", value: "1", detail: "Persisted unresolved finding" },
    { label: "Networks", value: "1", detail: "Configured live network" },
    { label: "Contracts", value: "1", detail: "Validated contract resource" },
    { label: "Executions", value: "1", detail: "Durable execution intent" },
  ],
  operation: {
    id: "operation-1",
    title: "Restore approved oracle",
    summary:
      "Deterministic setOracle(address) correction bound to immutable evidence.",
    planVersion: "plan-v1",
    planHash:
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    status: "awaiting_approval",
    risk: "critical",
    createdAt: now,
    evidence: ["Pinned block 6,812,004", "Desired state v2.4.1"],
    inference: [
      "The change was not represented in approved repository provenance.",
    ],
    policyChecks: [record("policy-1", "Target allowlisted", "healthy")],
    simulation: record("simulation-1", "Exact request simulation", "completed"),
    approvals: [record("approval-1", "Owner approval", "awaiting_approval")],
    steps,
  },
  execution: {
    id: "execution-1",
    operationId: "operation-1",
    directExecutionId: "kh_visual",
    status: "executing",
    network: "Ethereum Sepolia",
    currentStep: "KeeperHub execute",
    startedAt: now,
    updatedAt: now,
    gasEstimate: "86,000",
    steps,
  },
  notifications: [],
  realtime: "connected",
  overviewSummary: {
    healthScore: 74,
    alignedResources: 8,
    totalResources: 9,
    findingsBySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
    connections: [
      { id: "github", label: "GitHub", status: "healthy" },
      { id: "keeperhub", label: "KeeperHub", status: "healthy" },
    ],
    lifecycle: { completed: 2, total: 4, current: "executing" },
    lastObservedAt: now,
  },
};

export const authenticatedSession = {
  authenticated: true,
  user: { id: "usr_visual", email: "owner@example.invalid" },
  context: {
    organizationId: "org_visual",
    protocolId: "pro_visual",
    role: "owner",
  },
  destination: "dashboard",
};

export const githubDesiredStateFixture = {
  repository: "benjaminnkem/aether",
  branch: "main",
  path: "aether/desired-state.yaml",
  commitSha: "f3c7955181aaad913e3cf6bdf6b875d311fe53a7",
  commitUrl:
    "https://github.com/benjaminnkem/aether/commit/f3c7955181aaad913e3cf6bdf6b875d311fe53a7",
  fileUrl:
    "https://github.com/benjaminnkem/aether/blob/f3c7955181aaad913e3cf6bdf6b875d311fe53a7/aether/desired-state.yaml",
  fetchedAt: now,
  content: "version: v2.4.1\nnetworkId: ethereum-sepolia\nchainId: 11155111\n",
  manifest: {
    version: "v2.4.1",
    networkId: "ethereum-sepolia",
    chainId: 11155111,
    contractId: "arcadia-market",
    contractVersion: "v2.4.1",
    implementationAddress: "0x2222222222222222222222222222222222222222",
    oracleAddress: "0x3333333333333333333333333333333333333333",
    administrators: ["0x1111111111111111111111111111111111111111"],
    guardians: ["0x4444444444444444444444444444444444444444"],
    paused: false,
    fee: { value: "50", unit: "bps" },
    minimumExecutorGas: { value: "0.005", unit: "ether" },
    maximumAutomaticTransaction: { value: "0", unit: "ether" },
    release: "v2.4.1",
    source: "github:benjaminnkem/aether@f3c7955",
  },
  manifestHash:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  matchesActiveVersion: true,
  resolution: {
    repositoryContractId: "arcadia-market",
    resolvedContractId: "market",
    matchBasis: "chain-and-implementation",
  },
};
