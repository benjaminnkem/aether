# Aether System Architecture

## 1. Architecture objectives

Aether must be easy to demonstrate locally, safe enough to execute real testnet transactions, and structured so production responsibilities are not tangled together. The architecture prioritizes:

- strict multi-tenant boundaries;
- frontend-first development with mock/live parity;
- durable asynchronous processing;
- deterministic policy around AI suggestions;
- provider abstraction;
- idempotent external side effects;
- independent post-execution verification;
- complete correlation and auditability;
- simple horizontal scaling.

---

## 2. Turborepo layout

```text
Aether/
├── apps/
│   ├── web/                         # Next.js App Router product and landing site
│   ├── api/                         # NestJS HTTP/SSE API
│   └── worker/                      # NestJS standalone BullMQ consumers/schedulers
│
├── packages/
│   ├── ui/                          # Shared Aether design system
│   ├── shared/                      # Domain types, constants, Zod schemas, events
│   ├── sdk/                         # Typed client used by web and tests
│   ├── mock-data/                   # Deterministic scenarios and MSW handlers
│   ├── contracts/                   # Foundry contracts, scripts, artifacts
│   ├── config/                      # ESLint, TS, Tailwind, env validation
│   └── testing/                     # Fixtures, factories, test utilities
│
├── tooling/
│   ├── docker/                      # Mongo, Redis, optional local chain
│   └── scripts/                     # Setup, seed, verify, demo and CI scripts
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   ├── ENVIRONMENT.md
│   ├── TESTING.md
│   ├── SECURITY.md
│   ├── INTEGRATIONS.md
│   ├── OPERATIONS.md
│   ├── ASSUMPTIONS.md
│   └── IMPLEMENTATION_STATUS.md
│
├── .agents/skills/
├── .codex/
├── AGENTS.md
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

Use pnpm workspaces and Turborepo task dependencies. Pin Node and pnpm versions. Avoid package-level circular imports.

---

## 3. Applications

### 3.1 `apps/web`

Responsibilities:

- public marketing pages;
- authentication and onboarding interfaces;
- complete dashboard and responsive app shell;
- query/mutation orchestration through the typed SDK;
- mock data mode through MSW;
- realtime operation stream consumption;
- visual desired-state editor, drift views, operation graph, approvals, KeeperHub logs, and audit timelines;
- accessibility and reduced-motion behavior.

The web app never receives KeeperHub organization keys, GitHub installation tokens, blockchain private keys, AI provider keys, or notification secrets.

Suggested internal structure:

```text
apps/web/src/
├── app/
│   ├── (marketing)/
│   ├── (auth)/
│   └── app/
├── components/
│   ├── layout/
│   ├── marketing/
│   ├── protocol/
│   ├── drift/
│   ├── operations/
│   ├── approvals/
│   ├── keeperhub/
│   └── audit/
├── features/                        # Feature slices with queries/forms/components
├── lib/
│   ├── api/
│   ├── auth/
│   ├── motion/
│   ├── realtime/
│   └── utils/
├── stores/                          # UI/session preferences only
└── mocks/
```

Use Zustand for ephemeral client UI state, not as a replacement for server state. Use TanStack Query for server data and mutations.

### 3.2 `apps/api`

Responsibilities:

- authentication and tenant authorization;
- synchronous CRUD and query APIs;
- desired-state validation and activation;
- policy evaluation and approval endpoints;
- webhook ingestion and signature verification;
- job enqueueing through a transactional outbox;
- SSE stream endpoints;
- integration connection/configuration status;
- read models for dashboard and audit interfaces.

The API must not perform long RPC scans, AI investigations, execution polling, or notification retries inside request handlers.

### 3.3 `apps/worker`

Responsibilities:

- scan scheduling and chain reads;
- GitHub webhook processing and repository import;
- drift detection;
- invariant evaluation;
- AI investigation and plan generation;
- KeeperHub simulation, execution, monitoring, and reconciliation;
- post-execution verification;
- notification delivery;
- outbox publishing;
- dead-letter and stuck-operation reconciliation.

Run multiple consumers with queue-specific concurrency. Use distributed locks for overlapping protocol/resource operations.

---

## 4. Shared packages

### `packages/ui`

Original Aether components: buttons, inputs, dialogs, drawers, command palette, tables, badges, skeletons, charts, timelines, code blocks, address/hash components, operation graph nodes, invariant cards, empty states, and accessible primitives.

### `packages/shared`

- domain enums and IDs;
- Zod request/response schemas;
- desired-state schema;
- AI structured-output schemas;
- operation-plan schema;
- domain event schema;
- error codes;
- permission and policy types;
- canonical serialization and hashing helpers.

Do not import server-only packages into browser bundles.

### `packages/sdk`

A typed Axios client with:

- base URL and auth configuration;
- request ID propagation;
- standardized problem-details errors;
- retry only for safe/idempotent requests;
- organization context header or path handling;
- generated/manual typed endpoint methods;
- SSE helper outside Axios where required.

### `packages/mock-data`

Deterministic scenario factories:

- healthy protocol;
- unauthorized oracle drift;
- planned GitHub upgrade;
- cross-chain version mismatch;
- insufficient gas;
- simulation failure;
- approval expiry;
- partial execution and correction;
- KeeperHub rate limit;
- empty/new organization;
- permission-restricted viewer.

### `packages/contracts`

Foundry workspace with demo contracts, tests, deployment scripts, drift scripts, ABI exports, and generated deployment metadata.

---

## 5. Backend modules

Use NestJS modules with domain boundaries. Suggested modules:

```text
auth
organizations
memberships
protocols
deployments
contracts
desired-state
snapshots
drift
incidents
invariants
policies
operations
approvals
executions
audit
notifications
integrations
github
keeperhub
blockchain
ai
webhooks
outbox
realtime
health
```

A module owns its persistence schema and service rules. Other modules interact through public services, typed commands/events, or query interfaces rather than reaching into model internals.

---

## 6. Provider adapters

Every external integration must define a domain-facing interface and at least a mock adapter.

### Blockchain adapter

```ts
interface BlockchainProvider {
  getChainIdentity(chainId: number): Promise<ChainIdentity>;
  getCode(request: GetCodeRequest): Promise<Hex>;
  readContract<T>(request: ReadContractRequest): Promise<ReadResult<T>>;
  getLogs(request: GetLogsRequest): Promise<DecodedLogPage>;
  getTransaction(hash: Hex): Promise<TransactionEvidence>;
  waitForFinality(request: FinalityRequest): Promise<FinalityResult>;
}
```

Implementations:

- `MockBlockchainProvider`
- `ViemBlockchainProvider`
- optional separate verification RPC provider

### KeeperHub adapter

```ts
interface ExecutionProvider {
  listActionSchemas(): Promise<ActionSchema[]>;
  simulate(request: ExecutionRequest): Promise<SimulationResult>;
  execute(
    request: ExecutionRequest,
    idempotencyKey: string,
  ): Promise<ExecutionReceipt>;
  getExecution(executionId: string): Promise<ExecutionState>;
  waitForExecution(request: WaitExecutionRequest): Promise<ExecutionState>;
  getNodeLogs(executionId: string, nodeId: string): Promise<NodeLog[]>;
}
```

Implementations:

- `MockKeeperHubProvider`
- `KeeperHubRestProvider`
- optional `KeeperHubMcpDevelopmentAdapter` for tooling/authoring, not a runtime dependency unless intentionally supported

### GitHub adapter

- repository listing;
- tree/file retrieval;
- commit/PR/release evidence;
- app installation token refresh;
- webhook validation;
- optional check/comment posting.

Implementations: mock and GitHub App.

### AI adapter

- investigation;
- plan generation;
- failure explanation;
- correction proposal.

Implementations: deterministic mock and OpenAI structured-output adapter.

### Notification adapter

- in-app always available;
- mock provider;
- email/Slack/Discord/Telegram/generic webhook providers as configured.

---

## 7. Persistence model

Use MongoDB and Mongoose. All tenant-owned documents include `organizationId`. Protocol-scoped documents also include `protocolId`. Use immutable IDs rather than user-controlled slugs for authorization.

### Principal collections

- `users`
- `organizations`
- `memberships`
- `invitations`
- `sessions`
- `protocols`
- `deployments`
- `contractResources`
- `abiVersions`
- `desiredStateVersions`
- `stateSnapshots`
- `driftRecords`
- `incidents`
- `invariantDefinitions`
- `invariantEvaluations`
- `policyVersions`
- `operations`
- `operationPlanVersions`
- `operationSteps`
- `approvals`
- `executionRecords`
- `executionEvents`
- `auditRecords`
- `integrationConnections`
- `webhookDeliveries`
- `notifications`
- `outboxEvents`
- `idempotencyRecords`
- `jobLeases`

### Required index patterns

- unique organization/user membership;
- organization + protocol + status + updatedAt;
- deployment + resource + latest snapshot;
- unique active drift fingerprint;
- operation + plan version;
- execution provider + external execution ID;
- organization + idempotency key;
- outbox status + nextAttemptAt;
- webhook provider + delivery ID;
- audit organization + createdAt;
- TTL only for expendable sessions, ephemeral tokens, and selected raw events—not core audit history.

Document every index and the query it serves.

### Transactions

Use MongoDB transactions for multi-document transitions such as:

- activating a desired-state version and emitting an outbox event;
- creating an approved immutable plan plus approval requirements;
- recording execution acceptance plus outbox/reconciliation event;
- changing operation status and appending domain event.

Local MongoDB must run as a replica set.

---

## 8. Domain state machines

### Desired state

```text
DRAFT → VALIDATING → VALID → AWAITING_APPROVAL → ACTIVE → SUPERSEDED
                    └→ INVALID
```

### Drift

```text
OPEN → INVESTIGATING → CLASSIFIED → PLANNED → RESOLVED
                         ├→ ACKNOWLEDGED
                         ├→ SUPPRESSED_UNTIL
                         └→ DESIRED_STATE_STALE
```

### Operation

```text
DRAFT
→ INVESTIGATING
→ PLAN_READY
→ POLICY_CHECKED
→ SIMULATING
→ AWAITING_APPROVAL
→ READY_TO_EXECUTE
→ CANARY_EXECUTING
→ CANARY_OBSERVING
→ ROLLOUT_EXECUTING
→ VERIFYING
→ COMPLETED
```

Terminal/exception states:

```text
BLOCKED_BY_POLICY
SIMULATION_FAILED
APPROVAL_REJECTED
APPROVAL_EXPIRED
CANCELLED
CANARY_FAILED
PARTIALLY_COMPLETED
CORRECTION_REQUIRED
CORRECTED
FAILED
MANUAL_INTERVENTION_REQUIRED
```

Enforce transitions in domain services. Do not permit arbitrary status assignment from controllers or clients.

---

## 9. Event and queue architecture

### Queue names

- `github-webhooks`
- `repository-import`
- `protocol-scan`
- `drift-analysis`
- `invariant-evaluation`
- `ai-investigation`
- `plan-generation`
- `execution-simulation`
- `execution-submit`
- `execution-monitor`
- `post-verification`
- `notification-delivery`
- `outbox-publish`
- `reconciliation`

### Job identity

Every job includes:

- job type and schema version;
- organization ID;
- protocol ID where applicable;
- operation/execution ID where applicable;
- correlation ID;
- causation ID;
- stable deduplication key;
- attempt count and timestamps.

### Delivery semantics

Assume at-least-once delivery. Consumers must:

1. validate schema;
2. acquire required lease/lock;
3. check idempotency/domain state;
4. perform work;
5. atomically persist result and outbox event;
6. acknowledge job;
7. release lock.

External writes require reconciliation before retrying unknown outcomes.

---

## 10. End-to-end execution flow

```text
Trigger
  ↓
Fresh observation at known block
  ↓
Drift/operation objective
  ↓
Evidence collection
  ↓
AI typed plan proposal
  ↓
Schema validation
  ↓
Deterministic policy evaluation
  ↓
Exact request simulation
  ↓
Approval collection on immutable plan hash
  ↓
Pre-execution freshness and policy recheck
  ↓
Persist idempotency intent and execution record
  ↓
KeeperHub submit
  ↓
Monitor provider execution and chain finality
  ↓
Independent state reads
  ↓
Postconditions and invariants
  ↓
Complete, warn, or plan forward correction
```

### Important ordering

Simulation may occur before approvals to help approvers understand risk, but a final freshness/policy check is mandatory after approval. For long approval windows, simulation should be repeated when configured or when material state changes.

---

## 11. Idempotency and reconciliation

### Internal API idempotency

Mutation endpoints that may be retried accept an idempotency key. Store:

- organization ID;
- route/action;
- normalized request hash;
- status: in-progress/completed/failed-retryable/failed-final;
- response reference;
- expiry.

Same key + same request returns the previous result. Same key + different request is rejected.

### KeeperHub idempotency

Derive a stable key from organization, operation plan version, step ID, and semantic attempt number. Store it before submission. Never generate a new key merely because the HTTP response timed out.

### Reconciliation

A scheduled reconciler finds:

- operation stuck in submitting/running;
- execution ID missing after possible acceptance;
- transaction hash known but provider state stale;
- provider completed but local verification absent;
- pending transaction beyond SLA;
- partially completed workflow;
- orphaned locks and jobs.

It resolves using external execution records, idempotency state, chain evidence, and current contract state before deciding to retry or escalate.

---

## 12. Security architecture

### Trust boundaries

1. Browser is untrusted.
2. Incoming GitHub and generic webhooks are untrusted until signature verification.
3. RPC/indexer data may be stale or inconsistent.
4. Repository and onchain strings are untrusted AI data.
5. AI output is untrusted until schema and policy validation.
6. External execution status must be reconciled with chain evidence.

### Secret handling

- Environment/schema validation at startup.
- No secret values in validation errors.
- Separate browser-safe and server-only configuration modules.
- GitHub installation tokens generated server-side and short-lived.
- KeeperHub keys server-side only.
- Private keys restricted to local contract deployment scripts or secure runtime secret providers; never used by the web app.
- Redaction middleware for logs and tracing.

### SSRF controls

For custom RPC and webhook URLs:

- require HTTPS in live mode;
- resolve and reject loopback, link-local, metadata, private, and reserved ranges unless explicitly permitted in local mode;
- limit redirects;
- pin or revalidate DNS per request policy;
- apply timeout and response-size limits;
- allowlist chains/providers in production mode.

### Authorization

Use permission guards plus resource loading constrained by tenant. Never load by ID globally and check tenant afterward in a way that leaks existence.

---

## 13. API conventions

- REST JSON APIs under `/v1`.
- Problem Details-style errors with stable `code`, `message`, `requestId`, and optional field errors.
- Cursor pagination for high-volume feeds.
- ISO UTC timestamps.
- Decimal/bigint values encoded as strings with unit metadata.
- ETags or version fields for concurrency-sensitive edits.
- `Idempotency-Key` on retryable creation/action endpoints.
- `X-Request-Id` accepted/generated and propagated.
- SSE event IDs for resumability.

Representative endpoints:

```text
POST   /v1/organizations
GET    /v1/protocols
POST   /v1/protocols
POST   /v1/protocols/:id/scan
GET    /v1/protocols/:id/overview
GET    /v1/protocols/:id/drift
POST   /v1/protocols/:id/desired-state/validate
POST   /v1/protocols/:id/desired-state/:version/activate
POST   /v1/drift/:id/investigate
POST   /v1/operations
POST   /v1/operations/:id/simulate
POST   /v1/operations/:id/approvals
POST   /v1/operations/:id/execute
GET    /v1/operations/:id/events
GET    /v1/executions/:id
POST   /v1/webhooks/github
```

Generate OpenAPI and use it to verify SDK compatibility.

---

## 14. Frontend data architecture

### Query keys

Include organization and protocol scope in every key:

```ts
["organizations", organizationId][("protocols", organizationId, filters)][
  ("protocol", organizationId, protocolId)
][("drift", organizationId, protocolId, filters)][
  ("operation", organizationId, operationId)
];
```

Clear or partition caches on organization change.

### Mock/live switch

```env
NEXT_PUBLIC_AETHER_DATA_MODE=mock|api
```

- `mock`: MSW intercepts the exact SDK calls and provides deterministic delayed responses, errors, mutations, and realtime scenarios.
- `api`: SDK calls NestJS.

Components do not branch on mode.

### Forms

React Hook Form + Zod. Preserve server validation. Big integer/unit inputs need explicit unit selectors and previews.

### Realtime reducer

Use operation event sequence/version. Ignore duplicates, buffer or refetch on gaps, and reconcile with canonical API state.

---

## 15. Smart-contract workspace

Use Foundry for contracts and tests, with generated ABI/deployment JSON copied into a shared artifact location consumed by backend import tools.

Suggested contracts:

```text
AetherDemoMarketV1.sol
AetherDemoMarketV2.sol
FeeController.sol
MockPriceOracle.sol
OracleAdapter.sol
DemoTreasury.sol
AetherOpsRegistry.sol        # optional operation hash attestation
```

Use standard OpenZeppelin patterns where appropriate. Tests must cover access control, pause, upgrade authorization, initialization, fee bounds, oracle freshness, and intended drift scenarios.

Provide scripts:

```text
deploy-local
seed-healthy-state
create-oracle-drift
create-fee-drift
create-role-drift
restore-state-directly       # development only
prepare-upgrade-v2
verify-deployment
export-aether-manifest
```

Never deploy unaudited demo contracts with real value.

---

## 16. Deployment modes

```env
AETHER_APP_MODE=demo|local|testnet|production
AETHER_CHAIN_PROVIDER=mock|viem
AETHER_KEEPERHUB_PROVIDER=mock|rest
AETHER_GITHUB_PROVIDER=mock|app
AETHER_AI_PROVIDER=mock|openai
AETHER_NOTIFICATION_PROVIDER=mock|live
NEXT_PUBLIC_AETHER_DATA_MODE=mock|api
AETHER_MAINNET_ENABLED=false
```

### Demo

No credentials required. Complete UI and deterministic scenarios.

### Local

Mongo replica set, Redis, local Anvil, local contracts, mock KeeperHub or optional live KeeperHub testnet.

### Testnet

Real RPC, GitHub App optional, real KeeperHub, AI provider optional, strict allowlists.

### Production

Explicit mainnet enablement, secret manager, hardened auth, monitoring, quotas, backups, and operational runbooks. This mode must not be silently enabled.

---

## 17. CI/CD quality gates

- format check;
- lint;
- TypeScript compile;
- unit tests;
- frontend component/accessibility tests;
- API integration tests with Mongo replica set and Redis;
- contract tests;
- production builds;
- dependency audit and secret scan;
- Playwright smoke tests;
- optional testnet workflow as manually approved CI job.

No production/testnet execution job should run automatically on pull requests from forks.

---

## 18. Architecture decision records to create

Codex should create ADRs for:

1. MongoDB + Mongoose and transaction requirements.
2. BullMQ queue and outbox design.
3. SSE versus WebSocket.
4. Foundry contract workspace.
5. AI safety boundary.
6. KeeperHub REST runtime versus MCP development usage.
7. Desired-state canonicalization and hashing.
8. Authentication provider choice.
9. Safe/multisig handling.
10. Mock/live adapter strategy.
