# Aether Product Requirements Document

**Document status:** Build specification  
**Product:** Aether  
**Category:** Autonomous protocol operations, desired-state control, and onchain execution assurance  
**Primary execution layer:** KeeperHub  
**Primary users:** Protocol engineers, operations teams, security teams, governance operators, multisig signers, and auditors

---

## 1. Executive summary

Aether is an AI-assisted protocol operations platform that keeps smart-contract systems aligned with their approved intended state.

A protocol team connects deployed contracts, repositories, governance or multisig authorities, and execution infrastructure. The team defines a desired state: approved implementations, contract parameters, role assignments, oracle addresses, treasury thresholds, operational schedules, and safety invariants. Aether observes the actual onchain state, detects drift, investigates its cause, generates an ordered remediation or rollout plan, evaluates that plan through deterministic policy and simulation, requests the required approvals, executes approved actions through KeeperHub, and independently verifies postconditions.

Aether is not a wallet chatbot and not an autonomous signer. Its safety model separates intelligence, authorization, execution, and verification:

> AI investigates and proposes. Deterministic policy authorizes. Humans or governance approve. KeeperHub executes. Aether verifies.

The initial product must support a compelling testnet/local demonstration while maintaining production-shaped boundaries for multi-tenancy, auditability, reliability, and future integrations.

---

## 2. Product problem

Smart-contract protocols are living production systems. After deployment, teams must repeatedly:

- upgrade proxy implementations;
- change fees, limits, risk parameters, and reward rates;
- rotate owners, guardians, operators, and signers;
- replace or validate oracle feeds;
- pause and unpause markets;
- synchronize deployments across chains;
- fund execution wallets;
- execute governance decisions;
- monitor scheduled maintenance;
- prove what changed, who approved it, and whether it completed correctly.

Today these activities are commonly spread across deployment scripts, Safe transactions, governance pages, block explorers, GitHub pull requests, spreadsheets, cron jobs, chat messages, and individual engineers' knowledge. This produces several operational risks:

1. **Configuration drift:** the team believes a value is one thing while the contract stores another.
2. **Cross-chain divergence:** one chain is upgraded while another is left behind.
3. **Unsafe sequencing:** dependent calls are executed in the wrong order.
4. **Incomplete execution:** a multi-step operation partially completes and no one detects the unfinished state.
5. **Poor observability:** a transaction fails or stalls without a reliable operational record.
6. **Weak intent traceability:** a team cannot connect an onchain write to an approved release, proposal, or incident response.
7. **Manual verification:** teams treat transaction confirmation as success without checking the final contract state.
8. **Fragile automation:** custom scripts lack consistent retries, gas handling, idempotency, policy enforcement, and audit evidence.

---

## 3. Product vision

Aether should become the operational control plane for smart-contract protocols: the place where a team can see what should exist, what actually exists, what changed, why it changed, what should happen next, who approved the response, how the response executed, and whether the protocol returned to a safe state.

### 3.1 Product principles

1. **State, not chat, is the primary interface.** Aether may include an assistant, but dashboards, plans, evidence, and execution state are primary.
2. **Read before write.** Every operation starts from fresh observed state.
3. **Evidence before conclusion.** AI findings must link to transactions, events, releases, proposals, snapshots, and policy evaluations.
4. **No unbounded autonomy.** The agent cannot bypass deterministic policy or approval requirements.
5. **Exact execution intent.** Simulation and execution must use the same normalized request body, except for execution-only metadata.
6. **Verification after confirmation.** A confirmed transaction is not sufficient; expected storage, events, balances, and invariants must be re-read.
7. **Forward correction, not fictional rollback.** Confirmed blockchain writes are irreversible. Recovery uses explicit compensating transactions.
8. **Adapter-first architecture.** GitHub, KeeperHub, AI, RPC, notifications, and blockchain indexers must be replaceable.
9. **Mock and live parity.** The complete product is usable in deterministic mock mode and switches to live providers through configuration.
10. **Audit everything important.** Intent, evidence, decisions, approvals, execution IDs, transaction hashes, errors, and verification results must be attributable and immutable in the application audit model.

---

## 4. Goals and non-goals

### 4.1 Goals

- Let teams create organizations, protocols, environments, and chain deployments.
- Import protocol metadata from GitHub or configure it manually.
- Maintain versioned desired-state manifests.
- Observe contract state across supported EVM networks.
- Detect and classify configuration drift.
- Evaluate user-defined and template-based invariants.
- Investigate drift using onchain and repository evidence.
- Generate structured, ordered operation plans.
- Apply deterministic policy and approval requirements.
- Simulate, execute, monitor, and verify actions through KeeperHub.
- Provide complete realtime operation and audit interfaces.
- Demonstrate a real corrective transaction through KeeperHub.
- Support safe local, mock, testnet, and later production modes.

### 4.2 Non-goals for the initial release

- Custodying user private keys.
- Acting as an unrestricted autonomous treasury manager.
- Supporting every protocol architecture or every EVM chain immediately.
- Replacing formal smart-contract audits.
- Guaranteeing that AI explanations are correct without evidence.
- Automatically executing critical mainnet upgrades by default.
- Providing legal, financial, or compliance certification.
- Implementing a full token-governance platform.
- Providing universal storage-layout verification for arbitrary proxy patterns in the first MVP.
- Pretending that a confirmed onchain transaction can be rolled back.

---

## 5. Core terminology

### Organization

A tenant containing members, teams, protocols, integrations, policies, and billing boundaries.

### Protocol

A logical smart-contract product such as a lending protocol, vault system, bridge, stablecoin, or DAO treasury system.

### Environment

A separation such as development, staging, testnet, or production.

### Deployment

A protocol instance on a specific chain and environment.

### Contract resource

A named contract known to Aether, including address, ABI, role, proxy metadata, and expected configuration.

### Desired state

A versioned declaration of approved contract addresses, implementations, parameters, roles, invariants, and operational policies.

### Observed state

A point-in-time snapshot of values read from the blockchain and related trusted sources.

### Drift

A meaningful difference between desired and observed state.

### Incident

A collection of related high-severity findings that may threaten availability, integrity, solvency, permissions, or execution capability.

### Invariant

A condition that must remain true, such as oracle freshness, fee limits, administrator thresholds, or solvency.

### Operation

A planned and tracked set of reads, simulations, approvals, writes, waits, and verification checks intended to reach a defined outcome.

### Plan step

A typed node in an operation graph with inputs, preconditions, expected outputs, postconditions, and optional compensation.

### Policy

A deterministic authorization rule governing chains, contracts, functions, values, timing, approvals, and autonomous execution.

### Execution

The KeeperHub run or direct action that performs or coordinates an approved onchain operation.

### Forward correction

A new operation that compensates for already-confirmed writes and restores a safe state.

---

## 6. Personas and permissions

### 6.1 Organization Owner

Can manage organization settings, integrations, policies, membership, execution modes, and critical approvals.

### 6.2 Protocol Administrator

Can create protocols, manage desired state, configure contracts, create operations, and approve actions within policy.

### 6.3 Operator

Can investigate drift, generate plans, run simulations, and approve or execute permitted operations.

### 6.4 Developer

Can connect repositories, manage ABIs and deployment metadata, create desired-state proposals, and view execution results.

### 6.5 Security Reviewer

Can manage invariants, review evidence and plans, block operations, and approve high-risk actions.

### 6.6 Signer / Approver

Can approve specific operations but may not edit the plan or organization configuration.

### 6.7 Auditor / Viewer

Read-only access to protocols, operations, evidence, and audit logs, subject to redaction policy.

### 6.8 Service accounts

Scoped machine identities for CI, GitHub, monitoring, and other integrations. Service accounts must have minimum permissions, expiration/rotation support, and visible activity attribution.

---

## 7. User journeys

### 7.1 Beginner onboarding

1. User creates an account and organization.
2. User chooses **Try a demo protocol** or **Connect an existing protocol**.
3. User imports from GitHub or adds contracts manually.
4. Aether discovers networks, addresses, ABIs, proxy types, and candidate monitored values.
5. User reviews discovered resources.
6. User selects monitoring templates and execution mode.
7. Aether performs an initial read-only scan.
8. User receives a health summary and guided explanation of any findings.

### 7.2 Unauthorized oracle drift

1. Contract emits an oracle-change event or a scheduled scan detects a new address.
2. Aether creates a drift record and correlates the originating transaction.
3. Aether searches approved desired-state versions, GitHub changes, governance records, and prior operations.
4. The new oracle fails freshness or allowlist checks.
5. Aether raises a critical incident and creates a proposed restoration plan.
6. Deterministic policy requires two approvals.
7. KeeperHub simulates and then executes the approved call.
8. Aether verifies the stored oracle, price freshness, expected event, and market invariants.
9. The incident closes with a complete audit timeline.

### 7.3 Planned GitHub upgrade

1. A desired-state pull request changes FeeController v1 to v2 and fee from 100 to 50 bps.
2. The merged pull request webhook is validated and queued.
3. Aether creates a new pending desired-state version and identifies affected deployments.
4. AI produces a rollout plan; deterministic checks validate targets, ABI, bytecode, initialization, and policy.
5. A canary deployment is selected.
6. Authorized signers approve.
7. KeeperHub executes canary steps.
8. Aether observes for the configured window, evaluates invariants, and proceeds or stops.
9. Remaining deployments are updated and verified.
10. Aether posts a summary back to GitHub and records all transaction links.

### 7.4 Cross-chain missed deployment

1. Ethereum is at v2; Base remains at v1.
2. Aether identifies expected release parity and classifies Base as known rollout drift.
3. Investigation finds a prior execution failed due to insufficient native gas.
4. Policy permits a bounded top-up or requests approval.
5. KeeperHub executes top-up and upgrade actions.
6. Aether confirms the implementation and configuration across both chains.

### 7.5 Partial execution and forward correction

1. Role grant and oracle update confirm; market activation fails.
2. Aether marks the operation partially completed and prevents blind retry of completed writes.
3. It reads current state and maps confirmed versus unconfirmed effects.
4. The planner proposes a forward-correction graph.
5. Safety policy evaluates the correction independently.
6. After approval, KeeperHub executes compensating calls.
7. Aether verifies restoration and closes the original operation as corrected, not rolled back.

---

## 8. Functional requirements

### 8.1 Authentication and tenancy

- Email/password or magic-link authentication for the initial product.
- Wallet linking for identity proof and optional approval signatures.
- Organization creation and switching.
- Role-based access control at organization and protocol scope.
- Server-side tenant enforcement on every query and mutation.
- Session expiration, refresh, revocation, and device visibility.
- Optional future SSO boundary without redesigning core authorization.
- Audit events for login, logout, failed login, role changes, integration changes, and approvals.

### 8.2 Organization and team management

- Invite, accept, resend, revoke, and expire invitations.
- Assign organization and protocol roles.
- Disable users without deleting their historical attribution.
- Require stronger authentication for high-risk approvals.
- Show effective permissions and why a user has them.
- Prevent removal of the last organization owner.

### 8.3 Protocol management

- Create, edit, archive, and restore protocols.
- Separate environments under one protocol.
- Add multiple EVM deployments.
- Store protocol metadata, links, repository, governance type, Safe address, and risk profile.
- Archive rather than hard-delete protocols with audit or execution history.
- Clone a protocol configuration into staging or demo mode without copying secrets.

### 8.4 GitHub integration

- Install a GitHub App at organization or repository scope.
- Request only required permissions.
- List accessible repositories and branches.
- Discover Solidity files, Foundry/Hardhat config, deployment artifacts, ABIs, chain IDs, proxy metadata, and Aether manifests.
- Import selected resources only after review.
- Validate webhook signatures and queue webhook work before returning success.
- Process installation, repository, push, pull request, release, and installation-revocation events as configured.
- Correlate commits, pull requests, releases, and desired-state changes.
- Post optional operation summaries back to a pull request or deployment check.
- Refresh short-lived installation tokens server-side and never expose them to the browser.
- Support manual setup when GitHub is absent.

### 8.5 Desired-state management

- Form editor and YAML/JSON code editor backed by one runtime schema.
- Draft, validate, compare, approve, activate, supersede, and roll back the _declaration_ to a previous version.
- Each version records hash, author, source commit/PR, validation status, approval, and activation time.
- Support global defaults and chain-specific overrides.
- Support resources:
  - contract address;
  - expected bytecode or implementation address;
  - proxy type and admin;
  - paused state;
  - typed function/read values;
  - roles and owners;
  - oracle address, decimals, heartbeat, and reference bounds;
  - treasury balances and outflow limits;
  - release version;
  - recurring maintenance expectations.
- Reject ambiguous numeric units. Store canonical units and display human-readable conversions.
- Preserve comments and provenance where possible.
- Preview the drift impact before activation.

### 8.6 Contract and ABI registry

- Add contracts manually or from GitHub artifacts.
- Validate addresses, chain IDs, checksums, and deployed bytecode presence.
- Store immutable ABI versions and associate them with code/version evidence.
- Detect common proxy patterns where feasible.
- Record implementation, proxy admin, beacon, and initialization metadata.
- Permit manual override with a visible warning and approver attribution.
- Distinguish read functions from write functions.
- Generate safe typed input forms from ABIs but never expose arbitrary unrestricted calls to ordinary users.

### 8.7 Observation and snapshots

- Scheduled scans, manual scans, and event-triggered scans.
- Multicall/batched reads where safe and supported.
- Capture block number, block hash, chain timestamp, RPC provider, and read status.
- Store normalized snapshots with hashes.
- Mark partial snapshots and never treat missing reads as matching desired state.
- Detect chain reorganization and revalidate snapshots where necessary.
- Backoff and fail over across configured RPC endpoints.
- Provide freshness indicators and last-successful-scan time.

### 8.8 Drift detection

- Compare desired and observed values using typed comparators.
- Support exact, set, range, tolerance, freshness, threshold, and custom deterministic comparators.
- Group related drift into an incident candidate.
- Classify drift as expected, benign, suspicious, critical, unknown, or ignored-with-expiry.
- Calculate severity using resource criticality, invariant impact, value at risk, authorization evidence, duration, and blast radius.
- Deduplicate repeated detections while retaining occurrences.
- Reopen resolved drift if it recurs.
- Let authorized users acknowledge, suppress temporarily, or mark desired state outdated, with reason and expiry.

### 8.9 Invariants

- Template-based invariant builder for beginners.
- Advanced deterministic expression format for approved fields.
- Evaluation phases: observation, pre-plan, pre-execution, after each critical step, final verification, continuous monitoring.
- Severity and blocking behavior per invariant.
- Examples:
  - oracle age below threshold;
  - fee below maximum;
  - approved implementation only;
  - at least N guardians;
  - no sole EOA administrator;
  - treasury native balance above minimum;
  - outflow below daily limit;
  - total assets greater than or equal to liabilities;
  - protocol not unexpectedly paused.
- Record inputs, output, evaluator version, timestamp, and evidence.
- Never let an LLM directly determine whether a blocking invariant passed.

### 8.10 Investigation and evidence

- Trace the transaction and events that introduced drift.
- Identify sender, target, function selector, decoded inputs, block, confirmations, and related state changes.
- Correlate with GitHub commits, PRs, releases, governance proposals, Safe transactions, previous Aether operations, and known maintenance windows.
- Produce confidence-scored hypotheses with explicit evidence and uncertainty.
- Distinguish “onchain state is wrong” from “desired-state declaration is stale.”
- Provide a human-readable explanation suitable for a beginner and an expandable technical view.
- Defend against prompt injection from repository files, contract metadata, decoded strings, and webhook payloads.

### 8.11 Operation planning

- Convert an objective into a typed directed acyclic graph, or an explicitly controlled loop where required.
- Plan step types:
  - read state;
  - fetch evidence;
  - deterministic calculation;
  - simulate call;
  - request approval;
  - direct contract call;
  - workflow execution;
  - wait for confirmation;
  - wait for observation window;
  - evaluate invariant;
  - notify;
  - manual checkpoint;
  - compensation/forward correction.
- Every write step must include chain, target, ABI/function, arguments, value, signer context, preconditions, postconditions, risk, idempotency intent, and evidence.
- Plans are immutable after approval. Any material revision creates a new version and invalidates prior approvals.
- Detect circular dependencies, impossible preconditions, duplicate writes, and steps that conflict with desired state.

### 8.12 Policy engine

- Deterministic rules independent of AI.
- Rules can constrain:
  - organization, protocol, environment, and chain;
  - contract addresses and code hashes;
  - function selectors;
  - token/native value;
  - daily and per-operation limits;
  - time windows;
  - required simulation;
  - required invariant results;
  - approval count and roles;
  - autonomous versus manual execution;
  - canary requirements;
  - mainnet prohibition;
  - emergency actions.
- Default deny for unknown targets, unknown functions, unknown chains, and malformed plans.
- Policy evaluation returns machine-readable reasons and an understandable UI explanation.
- Policy changes are versioned, approved, and audited.

### 8.13 Approvals

- Single, sequential, parallel, threshold, role-based, and optional wallet-signature approvals.
- Show the exact immutable plan hash being approved.
- Expire approvals after plan changes, policy changes, excessive time, material state changes, or configured TTL.
- Prevent self-approval where separation of duties is required.
- Capture approve, reject, request changes, revoke, and abstain actions.
- Support Safe/governance as execution authority without claiming Aether owns signatures.
- Re-check current state and policy after the final approval and before execution.

### 8.14 KeeperHub execution

- Support a mock provider and a live REST provider; optionally use MCP during development and agent-assisted workflow authoring.
- Keep organization API credentials server-side.
- Distinguish organization API keys from webhook-trigger keys.
- Discover action schemas rather than hard-coding unsupported actions where appropriate.
- For direct writes, simulate the exact normalized request before execution.
- Use a stable idempotency key per semantic execution attempt.
- Persist request hash, idempotency key, KeeperHub execution ID, and correlation metadata before retry loops.
- Respect provider rate limits and poll hints.
- Treat transaction hash and execution records as authoritative evidence, not UI optimism.
- Support workflow and direct-contract-call execution models.
- Surface node-level status, logs, gas, errors, outputs, transaction hashes, and timing.
- Handle partial success explicitly.
- Account for simulation context differences, including Safe/multisig sender semantics.
- Never blindly resubmit after a client timeout; first reconcile by idempotency key, execution ID, or observed onchain state.

### 8.15 Verification

- Wait for configured confirmations/finality appropriate to the environment.
- Re-read expected storage and balances from an independent provider where possible.
- Confirm expected events without relying on events alone.
- Evaluate all postconditions and relevant invariants.
- Detect unexpected side effects, including role changes, value transfers, or paused state.
- Mark result as completed, completed-with-warning, partially-completed, failed, correction-required, corrected, or manual-intervention-required.
- Store pre-state and post-state hashes.
- Generate a signed/hashable operation report suitable for external attestation later.

### 8.16 Canary rollout

- Select canary deployment/resource manually or by policy.
- Prefer lowest-value or designated staging/canary targets.
- Require canary-specific preconditions and observation window.
- Stop rollout on blocking invariant failure, ambiguous state, provider outage, or unexpected event.
- Require re-approval when the plan materially changes after canary.
- Support intentionally excluded resources with documented reason.

### 8.17 Forward correction

- Map confirmed and unconfirmed effects before planning correction.
- Never re-execute completed writes merely because a later step failed.
- Define compensation steps during planning where possible.
- Treat correction as a separately authorized operation linked to the original.
- Verify restoration or new safe state.
- Preserve the original operation status as partially completed/corrected rather than rewriting history.

### 8.18 Realtime operations

- Server-sent events or WebSocket stream for operation updates.
- Reconnect using last event ID or cursor.
- Persist events so reconnecting clients can recover missed updates.
- Idempotent reducer on the frontend to tolerate duplicate/out-of-order events.
- Polling fallback when realtime transport is unavailable.
- Clear stale-data indicators.

### 8.19 Notifications

- In-app notification center.
- Optional Slack, Discord, Telegram, email, and generic webhooks through adapters.
- Severity, protocol, environment, and event-type routing.
- Deduplication and cooldowns.
- Retry with dead-letter handling.
- Signed outbound webhooks.
- Redact secrets and sensitive calldata according to policy.

### 8.20 Audit and reporting

- Append-only domain audit records.
- Record actor, tenant, source IP/device where appropriate, action, resource, before/after metadata, reason, request ID, and timestamp.
- Link desired-state versions, drift, incidents, operations, approvals, KeeperHub executions, and transaction hashes.
- Export operation report as JSON and PDF-ready HTML later; Markdown/JSON required initially.
- Search and filter by protocol, actor, chain, action, severity, status, and date.
- Retention and redaction policy hooks.

### 8.21 Search and command palette

- Global search for protocols, deployments, contracts, drift, incidents, operations, executions, transaction hashes, addresses, and audit records.
- Command palette actions respect permissions and cannot bypass confirmation flows.
- Keyboard navigation and accessible focus management.

---

## 9. Complete interface scope

The frontend-first build must include all of the following routes and meaningful states:

### Public

- `/`
- `/product`
- `/security`
- `/docs` placeholder/product guide
- `/login`
- `/signup`
- `/forgot-password`
- `/accept-invite`

### App shell

- `/app/overview`
- `/app/protocols`
- `/app/protocols/new`
- `/app/protocols/[protocolId]`
- `/app/protocols/[protocolId]/desired-state`
- `/app/protocols/[protocolId]/deployments`
- `/app/protocols/[protocolId]/contracts`
- `/app/protocols/[protocolId]/drift`
- `/app/protocols/[protocolId]/incidents`
- `/app/protocols/[protocolId]/operations`
- `/app/protocols/[protocolId]/approvals`
- `/app/protocols/[protocolId]/invariants`
- `/app/protocols/[protocolId]/policies`
- `/app/keeperhub-runs`
- `/app/audit-log`
- `/app/integrations`
- `/app/team`
- `/app/notifications`
- `/app/settings/general`
- `/app/settings/security`
- `/app/settings/api-keys`
- `/app/settings/execution`

### Required overlays

- Add/edit protocol modal.
- Add deployment modal.
- Add/import contract modal.
- GitHub repository import wizard.
- Desired-state editor and diff modal.
- Invariant template builder.
- Policy editor.
- Approval/rejection modal.
- Create operation modal.
- Large right-side drawers for drift, incident, contract, execution, and audit detail.
- Global command palette.
- Notification center.

---

## 10. AI requirements

### 10.1 Permitted AI responsibilities

- Explain protocol and contract context.
- Summarize observed differences.
- Generate evidence-backed investigation hypotheses.
- Propose typed operation plans.
- Suggest invariants and policies for human review.
- Explain simulation and execution failures.
- Propose forward-correction alternatives.
- Produce beginner and expert explanations from the same evidence.

### 10.2 Prohibited AI authority

The AI must never independently:

- sign transactions;
- bypass policy;
- modify approved plan calldata after approval;
- mark a deterministic invariant as passed;
- grant itself permissions;
- expose secrets;
- execute an unknown target/function;
- silently reinterpret token units;
- claim an external action succeeded without provider/onchain evidence.

### 10.3 Structured outputs

All AI outputs used by the system must be validated against versioned schemas. Invalid, incomplete, contradictory, or oversized output is rejected and retried safely or escalated to a human.

### 10.4 Prompt-injection defense

Treat repository text, contract metadata, token names, event strings, decoded calldata, governance descriptions, and webhook payloads as untrusted data. They may be quoted in evidence but never treated as system instructions. Tool access must be allowlisted and scoped to the current tenant and task.

---

## 11. Non-functional requirements

### 11.1 Security

- Strict tenant isolation.
- No secrets in browser bundles.
- Encryption in transit and at rest through platform capabilities.
- Secret manager-ready configuration.
- Rate limiting, abuse protection, and request size limits.
- CSRF protection where cookie auth is used.
- Secure cookie flags and token rotation.
- Signature verification for incoming webhooks.
- SSRF protection for user-defined RPCs and webhooks.
- URL allowlists and private-network blocking.
- Input validation and output encoding.
- Content Security Policy for the web app.
- Dependency and secret scanning in CI.
- Audit all privileged changes.
- Mainnet disabled by default.

### 11.2 Reliability

- Durable queues for scans, webhooks, plans, execution monitoring, verification, and notifications.
- At-least-once processing with idempotent consumers.
- Distributed locks for operations that must not overlap.
- Transactional outbox pattern for database-to-queue consistency.
- Dead-letter queues and replay tools.
- Provider timeouts, circuit breakers, exponential backoff, jitter, and failover.
- Reconciliation jobs for stuck operations and unknown outcomes.
- Graceful shutdown and job lease recovery.

### 11.3 Performance

- Dashboard initial content usable within a reasonable local/dev budget.
- Paginate and virtualize large tables.
- Avoid per-row RPC calls from request handlers.
- Batch reads and cache immutable metadata.
- Use background jobs for expensive scans and AI investigations.
- Stream operation updates rather than aggressively polling all records.
- Apply MongoDB indexes based on documented query patterns.

### 11.4 Scalability

- Stateless API replicas.
- Independently scalable worker consumers.
- Queue partitioning by workload and optional organization/protocol key.
- Per-chain/provider concurrency controls.
- Multi-tenant quotas.
- Large audit/event collections designed for retention and archival.
- Adapter boundaries suitable for future indexer and data warehouse integration.

### 11.5 Accessibility

- WCAG 2.2 AA intent for critical flows.
- Complete keyboard operation.
- Visible focus states.
- Screen-reader labels for icon-only controls.
- Semantic status text in addition to color.
- Reduced-motion mode that disables Lenis, GSAP scroll effects, nonessential Three.js animation, and animated counters.
- Drawers/modals trap focus, restore focus, and support Escape safely.

### 11.6 Observability

- Structured logs with request, organization, protocol, operation, job, and execution correlation IDs.
- Metrics for scans, drift, queue lag, provider latency, retries, execution outcomes, verification failures, and notification delivery.
- Distributed tracing hooks.
- Health, readiness, and dependency status endpoints.
- Redaction of secrets, tokens, raw authorization headers, and sensitive payloads.

---

## 12. Data and retention requirements

- Use MongoDB with Mongoose schemas and explicit indexes.
- Use transactions for multi-document consistency where the deployment supports them; local MongoDB must run as a replica set.
- High-volume append-only events may use time-based retention and archival policies.
- Desired-state versions, approvals, operations, and audit attribution must not be destructively edited.
- Store large provider payloads selectively; normalize core fields and redact secrets.
- Hash important manifests, plans, state snapshots, and reports.
- All timestamps stored in UTC and displayed in user timezone.

---

## 13. Edge-case catalogue

Codex must implement, test, or explicitly document handling for every category below. “Show an error toast” is not sufficient where reconciliation or safety is required.

### 13.1 Authentication and tenancy edge cases

- Duplicate email with different case or Unicode normalization.
- Expired, replayed, revoked, or already-accepted invitation.
- User removed while a browser session remains active.
- Role changed while an approval page is open.
- Last owner attempts to leave or delete themselves.
- Cross-tenant object ID enumeration.
- Service account token used after revocation.
- Refresh token reuse or session theft indicators.
- Wallet linked to another account or wrong network.
- Wallet signature nonce replay.
- Approval signed by an address no longer authorized.
- Organization switched in one tab while another tab submits a mutation.

### 13.2 GitHub edge cases

- App not installed, suspended, or uninstalled.
- Repository access revoked after onboarding.
- Installation token expires during a long scan.
- Webhook delivered more than once, late, or out of order.
- Invalid or missing webhook signature.
- Force-push removes a referenced commit.
- Repository renamed, transferred, archived, made private, or deleted.
- Default branch changes.
- Monorepo contains multiple protocols or environments.
- Deployment artifact is stale relative to source code.
- ABI does not match deployed bytecode.
- Malformed YAML, duplicate keys, anchors, huge files, or unsafe tags.
- Pull request merged but desired-state file was not changed.
- Desired-state changed without a matching contract release.
- Fork pull request cannot access required installation context.
- GitHub API rate limit or secondary rate limit.
- Malicious repository content attempts prompt injection.
- GitHub says a change is approved while governance has not authorized execution.

### 13.3 Blockchain and RPC edge cases

- Wrong chain ID returned by an RPC URL.
- RPC is stale, lagging, rate-limited, or inconsistent with another provider.
- Chain reorganization removes or changes an observed event.
- Contract address has no bytecode.
- Address contains a different contract on another chain.
- Proxy implementation changes between read and execution.
- ABI decoding fails or function is overloaded.
- Multicall partially fails.
- Historical state unavailable on non-archive RPC.
- Event logs exceed provider range limits.
- Finality differs by chain.
- Native token balance insufficient for gas.
- Fee-on-transfer, rebasing, or nonstandard token behavior.
- Token decimals are absent, wrong, or changed through a proxy.
- Oracle returns zero, negative, stale, outlier, wrong decimals, or wrong asset pair.
- Contract self-destructed or redeployed where chain semantics permit.
- L2 sequencer outage or delayed finality.
- Timestamp manipulation within chain tolerance.
- ENS or human-readable resolution changes after approval.

### 13.4 Desired-state edge cases

- Desired-state version is internally contradictory.
- Global default conflicts with chain override.
- Human enters `1` intending 1% while contract expects basis points.
- Hex, decimal, bigint, address, bytes, enum, tuple, and array values are confused.
- Duplicate resource names or addresses.
- Two desired-state versions are activated concurrently.
- Desired state references a future undeployed contract.
- Previous desired-state version is restored while the blockchain has irreversible newer state.
- Desired state is stale but onchain change was legitimate.
- Desired state uses an ABI function not present onchain.
- Comments or formatting disappear after form editing.
- Manifest exceeds configured size.
- Hash differs because of noncanonical serialization.

### 13.5 Snapshot and drift edge cases

- Snapshot only partially succeeds.
- Different fields are read at different blocks and create a false inconsistency.
- Drift flaps around a threshold.
- Repeated event and scheduled scan create duplicate drift.
- Expected rollout drift is mistaken for an incident.
- Suppression expires while drift still exists.
- Drift is resolved onchain before investigation completes.
- Desired state changes while drift is open.
- Same root cause affects many contracts and should be grouped.
- A value is semantically equal but represented differently.
- Comparison uses stale cached state.
- Unknown read result is mistakenly treated as desired-state match.
- Severity changes as value at risk changes.

### 13.6 Invariant edge cases

- Division by zero, overflow, precision loss, or unit mismatch.
- Dependency read is missing or stale.
- Invariants depend on values from different blocks.
- Custom expression is too expensive or nonterminating.
- Two invariants conflict.
- A warning invariant becomes blocking during incident mode.
- Solvency calculation includes unsupported assets.
- Oracle comparison sources disagree.
- Evaluation logic changes between plan approval and execution.
- Invariant is renamed or deleted while an operation references it.

### 13.7 AI and investigation edge cases

- Model returns invalid JSON or wrong schema version.
- Model hallucinates a transaction, contract function, or approval.
- Model omits a critical dependency.
- Evidence sources contradict one another.
- Model times out, rate-limits, or is unavailable.
- Prompt or evidence exceeds context limits.
- Repository or contract data contains prompt injection.
- Model proposes a target outside the current tenant.
- Model changes token units or addresses while summarizing.
- Same evidence produces materially different plans.
- Low confidence is hidden by fluent language.
- AI provider logs sensitive data.
- User requests execution through chat that bypasses normal operation UI.

### 13.8 Plan and policy edge cases

- Plan contains a cycle.
- Same write appears twice with different arguments.
- Preconditions can never be satisfied.
- Compensation action is more dangerous than leaving state unchanged.
- Target or code hash changes after approval.
- Policy changes after plan approval.
- Spending limit consumed by another operation before execution.
- Two operations race to modify the same contract.
- Emergency policy and normal policy disagree.
- Canary target is not actually low risk.
- Unknown selector, proxy admin, delegatecall, or payable value.
- Batch operation exceeds gas/block/provider limits.
- Plan requires a signer Aether cannot access.
- A direct execution should be a workflow, or vice versa.
- User edits a plan after one approver has signed.

### 13.9 Approval edge cases

- Approver role revoked after approving but before execution.
- Same person controls two accounts in a separation-of-duties policy.
- Approval expires during simulation.
- State materially changes after final approval.
- Wallet signature is valid but for a different chain, plan hash, or domain.
- Threshold approval is reached with a rejected mandatory role.
- Approver signs stale plan version from another tab.
- Multisig proposal is replaced, rejected, or executed externally.
- Governance timelock is not ready.
- Approval notification delivered after operation cancellation.

### 13.10 KeeperHub edge cases

- Organization key is confused with webhook key.
- Key missing, invalid, expired, or lacks organization/wallet configuration.
- Action schema changed or action unavailable.
- General or direct-execution rate limit reached.
- Simulation body differs from execution body.
- Simulation passes under an organization wallet but real Safe sender semantics differ.
- Idempotency key reused for a different request and returns conflict.
- Duplicate request arrives while first execution is still in progress.
- Idempotency replay window expires before reconciliation.
- HTTP timeout occurs after KeeperHub accepted the request.
- Execution ID is stored but response to caller is lost.
- Polling ignores provider hint and causes throttling.
- Execution reports running indefinitely.
- Workflow partially succeeds.
- Node status is unknown to the current client version.
- Transaction array is empty for read-only or historical execution.
- Transaction hash exists but chain confirmation/reorg changes outcome.
- Node logs are unavailable, redacted, or oversized.
- Workflow edited externally between plan and execution.
- KeeperHub wallet has insufficient funds or spending cap reached.
- Private routing unavailable on selected chain.
- Gas estimate changes materially between simulation and submission.
- Same semantic operation is triggered by webhook and manual action.

### 13.11 Execution and verification edge cases

- Transaction remains pending beyond SLA.
- Replacement transaction or nonce conflict.
- Reverted transaction with undecodable reason.
- Successful receipt but wrong event or storage result.
- Expected event emitted by wrong contract.
- Verification provider disagrees with execution provider.
- Postcondition passes, but an unrelated invariant fails.
- Some batch calls succeed and others fail.
- Operation is cancelled after an irreversible step.
- Browser disconnects during execution.
- Worker crashes after submission but before recording transaction hash.
- Correction plan repeats an already completed effect.
- Required finality unavailable before approval TTL expires.
- External actor independently fixes the issue during execution.
- Execution succeeds but desired-state version has since changed.

### 13.12 Database and queue edge cases

- MongoDB is not running as replica set when transactions/change streams are expected.
- Unique-index race during idempotent creation.
- API commits database state but fails to enqueue work.
- Worker processes same job more than once.
- Worker loses lock during long operation.
- Dead-letter replay duplicates an external write.
- Queue unavailable while webhook arrives.
- Outbox event published but acknowledgement is lost.
- Schema migration encounters legacy documents.
- Large audit payload approaches document size limits.
- Clock skew affects leases or expiry.
- Retention job removes evidence still referenced by an operation.

### 13.13 Realtime and frontend edge cases

- SSE connection drops and reconnects with duplicate events.
- Events arrive out of order.
- User views an operation from another organization after switching tenant.
- Optimistic UI shows approval before server rejection.
- Drawer opens for a resource deleted/archived in another tab.
- Long addresses, hashes, names, and errors overflow layouts.
- Table has zero, one, thousands, or partially loaded rows.
- Slow API causes skeleton-to-empty flicker.
- Reduced-motion preference is ignored.
- WebGL unavailable or low-power device cannot render hero effect.
- Lottie asset fails to load.
- Modal nested inside drawer loses focus.
- Mobile sidebar, tables, and operation graph become unusable.
- User refreshes during a multi-step wizard.
- React Query cache leaks data across organization switch.

### 13.14 Notification and webhook edge cases

- Duplicate notification storm from repeated drift.
- Notification provider rate limit or outage.
- Slack/Discord/Telegram destination removed.
- Outbound webhook endpoint is slow, redirects, resolves to private IP, or changes DNS.
- Signature secret rotates.
- Recipient lacks permission to view linked incident.
- Sensitive calldata or token appears in message.
- Delivery succeeds but provider response is lost.
- Retry occurs after destination already processed event.

### 13.15 Security edge cases

- SSRF through RPC, repository callback, webhook, icon, or metadata URL.
- Prototype pollution or unsafe deserialization.
- NoSQL injection in filters.
- Stored XSS through protocol names, revert reasons, token metadata, or AI output.
- CSV/formula injection in exports.
- Secret appears in exception, tracing span, or frontend source map.
- Malicious ABI causes huge/nested forms.
- Dependency compromise or typosquatted package.
- Unauthorized mainnet enablement.
- Developer accidentally commits `.env` or private key.
- Internal service endpoint exposed publicly.
- Audit record tampering.
- Privileged support/admin impersonation without attribution.

---

## 14. MVP demonstration protocol

Build a small protocol specifically designed to exercise Aether:

- upgradeable vault or lending-like market;
- `FeeController` with basis-point fee;
- `OracleAdapter` or oracle registry;
- role-based access control;
- emergency pause/unpause;
- treasury/executor gas balance;
- v1 and v2 implementations;
- deterministic invariant read functions;
- scripts to create approved changes and unauthorized drift.

Deploy locally and to at least one supported testnet; two testnet deployments are preferred where practical. The critical demo must include one real KeeperHub-executed write and one independent verification cycle.

---

## 15. Success metrics

### Hackathon/product proof

- A new user can run the demo without guessing undocumented steps.
- The full frontend is navigable in mock mode.
- Aether detects deliberate drift within the configured scan/event interval.
- The investigation links the drift to real evidence.
- A valid plan passes deterministic policy and simulation.
- KeeperHub executes a real transaction.
- The UI displays execution ID and transaction link.
- Aether verifies the final state and closes the incident.
- Partial/failure scenario is demonstrated or covered by automated tests.

### Product metrics for later releases

- Mean time to detect drift.
- Mean time to approved remediation.
- Percentage of operations with successful first simulation.
- Percentage of completed operations with verified postconditions.
- Number of prevented unsafe actions.
- Rate of duplicate execution attempts prevented.
- Cross-chain configuration parity.
- Queue/reconciliation backlog and provider error rates.

---

## 16. Acceptance criteria summary

Aether is not complete unless:

1. All listed frontend routes and overlays exist with realistic states.
2. Mock/live provider switching does not require component rewrites.
3. Tenant checks, RBAC, policy evaluation, and approval invalidation are server-enforced.
4. Desired state is versioned, canonicalized, validated, and hashable.
5. Snapshots carry block/provenance metadata and partial reads are explicit.
6. Drift detection is typed and deduplicated.
7. AI outputs are schema-validated and cannot authorize execution.
8. Every write is policy-checked, simulated where supported, idempotent, monitored, and independently verified.
9. Partial execution leads to reconciliation or forward correction rather than blind retries.
10. KeeperHub execution evidence is visible in the product.
11. The complete setup, environment, test, and demo flow is documented.
12. Production builds and required automated tests pass.

---

## 17. Open decisions Codex may ask about

Codex should only interrupt for a genuinely blocking choice. Likely examples:

- exact authentication provider when no preference is supplied;
- final testnet(s) supported by the available KeeperHub organization;
- available KeeperHub action schemas and wallet mode;
- GitHub App credentials and callback domain;
- AI provider/model and data-retention constraints;
- whether Safe execution is required for the demo or only modeled;
- whether the optional Aether onchain attestation registry should be deployed.

Everything else should use conservative defaults, be recorded in `docs/ASSUMPTIONS.md`, and remain replaceable through adapters.
