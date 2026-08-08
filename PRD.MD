# Aether — Product Requirements Document

**Status:** Implementation specification  
**Product:** Aether  
**Positioning:** Mission control for autonomous onchain agents  
**Core promise:** Make multi-step onchain agent missions recoverable, not merely executable.  
**Primary launch network:** Ethereum Sepolia (`11155111`)  
**Execution provider:** KeeperHub Direct Execution API  
**AI provider:** GroqCloud via the native `groq-sdk`  
**Default advisory model:** `llama-3.3-70b-versatile`  
**Data plane:** Existing MongoDB replica set + outbox + worker architecture unless repository inspection proves a production blocker  
**Queue/cache:** Existing Redis/BullMQ architecture unless repository inspection proves a production blocker  
**UI source of truth:** `docs/DESIGN.MD`  
**Behavioral source of truth:** this document  

---

## 1. Executive Summary

Aether is a control plane for **recoverable autonomous onchain execution**.

KeeperHub is the execution and reliability layer beneath Aether. KeeperHub handles transaction-level concerns such as simulation, broadcast, idempotency, gas, nonce ordering, retries, and execution records. Aether must not duplicate that product. Aether operates one abstraction level above it: it tracks the **business mission** an agent is trying to complete across multiple irreversible transactions.

The problem Aether solves is simple to describe and difficult to solve safely:

> A transaction can succeed while the mission fails.

A mission may require several onchain writes. For example:

1. withdraw an asset from a source position;
2. approve a destination contract;
3. deposit into a destination position;
4. verify the destination position.

If steps 1 and 2 finalize but step 3 becomes impossible, there is no blockchain rollback. The system may now contain idle capital, a stranded approval, an incomplete business objective, and an agent that does not know whether to continue, retry, compensate, or stop.

Aether provides the missing mission semantics:

- immutable, versioned mission intent;
- explicit invariants and authorized safe states;
- exact step checkpoints;
- simulation-before-broadcast discipline;
- durable idempotency beyond provider retry windows;
- independent RPC observation;
- explicit handling of **unknown** execution outcomes;
- deterministic continuation and compensation planning;
- contextual human approval when authority is insufficient;
- KeeperHub Direct Execution for all real writes;
- independent postcondition verification;
- append-only audit evidence;
- optional advisory AI investigation through Groq, with **zero execution authority**.

Aether must never claim to “roll back” finalized blockchain transactions. Recovery is performed with new **compensating transactions** that return the system to an authorized safe state.

The hackathon/demo experience and production product must use the same runtime. The dedicated `/demo` page may enable controlled fault injection, but it must not bypass the mission engine, policy engine, KeeperHub adapter, independent verification, persistence, or audit system.

---

## 2. Product Thesis

### 2.1 The product category

Aether is a **recoverable execution runtime / transaction coordinator for onchain agents**.

Aether should be explainable in one sentence:

> **Aether checkpoints every onchain effect in an agent’s mission, reconciles uncertain outcomes, and uses KeeperHub to restore an authorized safe state when the mission fails halfway.**

### 2.2 The central distinction

KeeperHub answers:

> “Can this transaction be executed reliably?”

Aether answers:

> “Did the agent’s whole mission finish safely, and if not, what is the safest authorized next state?”

### 2.3 The mental model

The entire product should reduce to four concepts:

1. **Mission** — what outcome the agent wants.
2. **Checkpoint** — what durable effects have actually occurred.
3. **Reality** — what independent chain observation proves now.
4. **Recovery** — how to reach an authorized safe state when reality diverges.

Anything that does not strengthen those four concepts should be challenged before it remains in the product.

---

## 3. Product Principles

These are non-negotiable design and engineering principles.

### 3.1 Reality over provider response

Provider responses are evidence, not reality. Aether considers chain state and canonical transaction evidence authoritative for onchain postconditions.

### 3.2 Unknown is a first-class state

A lost response is not automatically a failure. A failed API request is not proof that no transaction landed. Aether must represent uncertainty explicitly and reconcile before any economically duplicative resubmission.

### 3.3 Never blindly retry an economic effect

Aether may retry a provider request only when the retry semantics are proven safe by the step’s retry classification, provider idempotency, or independent reconciliation.

### 3.4 AI advises; deterministic software authorizes

Groq may summarize evidence, rank likely causes, and recommend one of a small set of actions. It may never create unrestricted calldata, change a mission’s authority, bypass a guardrail, approve a plan, broadcast a transaction, or decide that an unknown outcome is safe to retry.

### 3.5 Compensation, never fictional rollback

Finalized transactions remain part of history. Aether restores safe state with new transactions and records both the original effect and the compensation.

### 3.6 Every write is attributable

Every planned write must be associated with a workspace, mission version, mission run, step, plan hash, simulation record, approval policy result, KeeperHub idempotency key, execution attempt, and verification result.

### 3.7 Fail closed on material uncertainty

If Aether cannot prove the safety of continuing, retrying, or compensating, it enters `NEEDS_ATTENTION`. It does not invent certainty.

### 3.8 Production and demo use the same core

The demo can inject controlled failures. It cannot use fake success records, mock chain receipts, bypassed approvals, hard-coded final states, or a separate toy execution engine.

### 3.9 No legacy product surface

The old GitHub-backed desired-state/oracle-drift product is removed, not hidden. There are no compatibility routes, old navigation entries, dead schemas, deprecated environment variables, or “legacy mode” branches left in production code.

### 3.10 `docs/DESIGN.MD` remains authoritative for visual design

This PRD specifies flows, information architecture, states, components, content requirements, and accessibility expectations. It must not replace the existing visual design system. All pages must use the tokens, component language, spacing, typography, responsiveness, and interaction patterns defined in `docs/DESIGN.MD`.

---

## 4. Goals and Success Criteria

### 4.1 Product goals

Aether v1 must:

- accept a structured multi-step mission from a human or an authenticated agent API client;
- persist an immutable mission version before execution;
- preflight each economic write before broadcast;
- execute every real write through KeeperHub Direct Execution;
- independently verify onchain effects;
- detect known step failure and mission divergence;
- represent ambiguous provider outcomes as `UNKNOWN` and lock unsafe resubmission;
- reconcile unknown outcomes from independent evidence;
- deterministically choose safe continuation, compensation, or escalation from pre-authorized rules;
- execute compensating writes through KeeperHub;
- independently prove the final state of `COMPLETED` or `RECOVERED` missions;
- produce a complete audit/flight-recorder timeline;
- remain functionally safe when Groq is unavailable, rate limited, malformed, or slow;
- provide a polished `/demo` route that runs a real Sepolia mission end-to-end.

### 4.2 Demo goals

A judge should understand the value in under 30 seconds without learning the internal data model.

The demo must prove three scenarios:

1. **Happy path:** a mission completes and is independently verified.
2. **Partial mission failure:** earlier writes are confirmed, a later step cannot proceed, and Aether compensates back to a safe state.
3. **Unknown outcome:** a real KeeperHub write occurs, the orchestration layer intentionally loses the provider response, Aether locks resubmission, independently reconciles the chain, discovers reality, and proceeds without duplicating the write.

### 4.3 Production success metrics

The system should expose and track at least:

- mission completion rate;
- mission recovery rate;
- `NEEDS_ATTENTION` rate;
- unknown-outcome incidence;
- unknown-outcome resolution rate;
- duplicate economic-write incidents caused by Aether (**target: zero**);
- percentage of terminal missions with complete independent verification (**target: 100% for `COMPLETED` and `RECOVERED`**);
- percentage of writes with simulation evidence (**target: 100% for supported v1 writes**);
- worker/outbox lag;
- KeeperHub API latency/error rate;
- RPC latency/disagreement rate;
- Groq latency/error/rate-limit rate;
- median and P95 time to detect a known divergence;
- median and P95 time to begin an authorized recovery.

---

## 5. Non-Goals for v1

Do not build these in this rewrite:

- Ethereum mainnet execution;
- cross-chain recovery;
- arbitrary bridging;
- autonomous token selection or yield optimization;
- a trading strategy;
- a generalized DeFi portfolio manager;
- arbitrary LLM-authored transactions;
- AI-controlled approvals;
- a token;
- governance;
- insurance underwriting;
- a marketplace;
- x402 monetization;
- GitHub-driven configuration;
- oracle monitoring;
- protocol “alignment percentage” or health scoring;
- a visual workflow builder competing with KeeperHub;
- generic no-code automation;
- support for every possible EVM call before the mission semantics are correct;
- false claims of exactly-once blockchain execution;
- fake rollback language.

The architecture should permit future chains/protocols, but v1 should be intentionally narrow and extremely reliable.

---

## 6. Users and Jobs to Be Done

### 6.1 Agent developer

Wants to give an autonomous agent a safe way to perform a multi-step onchain mission without writing custom retry/reconciliation/recovery infrastructure.

Needs:

- API key creation;
- documented mission schema;
- idempotent mission creation;
- run status API;
- webhooks;
- machine-readable terminal receipts;
- clear error taxonomy.

### 6.2 Operator / reviewer

Wants to understand what an agent intended, what actually happened, why the mission is paused/recovering, and what Aether plans to do next.

Needs:

- live mission timeline;
- readable plan and evidence;
- approval screen for out-of-policy recovery;
- transaction links;
- clear `UNKNOWN` vs `FAILED` distinction;
- ability to pause and safely escalate.

### 6.3 Workspace owner

Wants to configure KeeperHub credentials, roles, spending/recovery limits, API keys, and chain policy.

### 6.4 Judge / demo viewer

Wants a one-page experience proving the problem and solution with real chain evidence.

---

## 7. Launch Scope and Environment Policy

### 7.1 Network policy

For v1:

- only Ethereum Sepolia chain ID `11155111` is enabled for writes;
- the code must use a chain allowlist, not a scattered `if (chainId === ...)` approach;
- mainnet execution is disabled by default and must not be exposed in the UI;
- a future mainnet feature flag must require explicit configuration, a separate security review, and separate production secrets;
- all tests and demo transactions use Sepolia.

### 7.2 External services

Required:

- KeeperHub Direct Execution API;
- at least two independently configurable Sepolia RPC providers for reconciliation/verification when available;
- MongoDB replica set;
- Redis/BullMQ;
- GroqCloud for optional advisory investigation;
- existing authentication/session stack if it remains secure after repository review.

### 7.3 Service ownership

Aether owns:

- mission state;
- step state;
- policy state;
- reconciliation state;
- recovery planning;
- application-level idempotency;
- audit state;
- verification state.

KeeperHub owns:

- simulation endpoint behavior;
- transaction broadcast;
- KeeperHub idempotency inside its documented window;
- wallet/executor infrastructure;
- execution status records.

RPC providers provide independent observations but are not independently trusted one-by-one.

Groq provides advisory analysis only.

---

## 8. Information Architecture

The primary application navigation should be reduced to:

- **Overview**
- **Missions**
- **Approvals**
- **Audit**
- **Settings**

Settings contains:

- Integrations
- Agent API Keys
- Members / Roles (if already supported)
- Workspace policy

A persistent **Demo** entry may appear outside authenticated app navigation or in a clearly separate “Demo” surface.

### Routes

Minimum route set:

- `/`
- `/login`
- `/app/overview`
- `/app/missions`
- `/app/missions/new`
- `/app/missions/:missionId`
- `/app/runs/:runId`
- `/app/approvals`
- `/app/approvals/:approvalId`
- `/app/audit`
- `/app/settings/integrations`
- `/app/settings/api-keys`
- `/app/settings/policy`
- `/demo`

Remove old routes relating to protocol setup, GitHub desired state, resources, drift findings, oracle state, alignment, or correction operations unless they have been explicitly repurposed into the new concepts and renamed everywhere.

---

## 9. Core Domain Model

### 9.1 Workspace

The tenant/security boundary.

Fields:

- `id`
- `name`
- `slug`
- `createdAt`
- `updatedAt`
- `status`
- `defaultChainId`
- `policyId`

### 9.2 Mission

A stable logical object that may have immutable versions.

Fields:

- `id`
- `workspaceId`
- `name`
- `description`
- `activeVersionId`
- `createdBy`
- `createdAt`
- `archivedAt?`

### 9.3 MissionVersion

Immutable after creation.

Fields:

- `id`
- `missionId`
- `workspaceId`
- `versionNumber`
- `schemaVersion`
- `objective`
- `inputsSchema`
- `steps[]`
- `invariants[]`
- `recoveryPolicy`
- `authorityPolicy`
- `hash`
- `createdBy`
- `createdAt`

No update mutation is allowed after persistence. Editing a mission creates a new version.

### 9.4 MissionRun

One execution of one immutable mission version.

Fields:

- `id`
- `workspaceId`
- `missionId`
- `missionVersionId`
- `requestId`
- `externalId?`
- `input`
- `inputHash`
- `state`
- `stateReason`
- `currentStepId?`
- `startedAt?`
- `completedAt?`
- `terminalAt?`
- `recoveryStartedAt?`
- `finalReceiptId?`
- `createdByActor`
- `createdAt`
- optimistic concurrency version

### 9.5 MissionStepRun

Tracks each step for a run.

Fields:

- `id`
- `runId`
- `stepId`
- `attemptGeneration`
- `state`
- `resolvedAction`
- `resolvedActionHash`
- `preflightObservationIds[]`
- `simulationRecordId?`
- `planId?`
- `approvalId?`
- `executionAttemptIds[]`
- `verificationObservationIds[]`
- `startedAt?`
- `terminalAt?`

### 9.6 OperationPlan

An immutable canonical plan to execute one write or one compensation.

Fields:

- `id`
- `workspaceId`
- `runId`
- `stepRunId`
- `kind`: `FORWARD | COMPENSATION`
- canonical KeeperHub request body excluding `simulate`
- `requestBodyHash`
- `expectedPostconditions`
- `riskSummary`
- `policyEvaluationId`
- `planHash`
- `createdAt`

### 9.7 SimulationRecord

Stores the exact simulation request and response.

Fields:

- `id`
- `planId`
- `provider`: `KEEPERHUB`
- `requestHash`
- `requestBody`
- sanitized response
- `success`
- `wouldRevert`
- `gasEstimate?`
- `createdAt`
- `expiresAt?`

Do not rely on a provider simulation ID unless the provider actually returns one. Aether owns its own simulation record ID.

### 9.8 ExecutionAttempt

Fields:

- `id`
- `planId`
- `runId`
- `stepRunId`
- `keeperHubIdempotencyKey`
- `requestHash`
- `status`: `CREATED | SUBMITTING | ACKNOWLEDGED | UNKNOWN | CONFIRMED | FAILED | RECONCILING`
- `keeperHubExecutionId?`
- `transactionHash?`
- `providerStatus?`
- sanitized provider error
- timestamps for submit/ack/unknown/terminal
- `resubmissionLocked`

### 9.9 Observation

Immutable evidence from an independent provider.

Fields:

- `id`
- `workspaceId`
- `runId?`
- `stepRunId?`
- `chainId`
- `blockNumber`
- `blockHash`
- `providerId`
- `kind`
- `query`
- normalized value/evidence
- `evidenceHash`
- `confirmationCount`
- `canonicalityStatus`
- `createdAt`

### 9.10 ReconciliationCase

Created whenever execution reality is uncertain.

Fields:

- `id`
- `executionAttemptId`
- `reason`
- `strategy`
- `state`
- `startedAt`
- `resolvedAt?`
- `resolution`: `LANDED | NOT_LANDED_SAFE_TO_RETRY | INDETERMINATE`
- evidence references
- decision rationale

### 9.11 RecoveryPlan

Immutable once approved.

Fields:

- `id`
- `runId`
- `trigger`
- `targetSafeState`
- `actions[]`
- `preconditions[]`
- `expectedPostconditions[]`
- `estimatedRecoverySpend`
- `authorityEvaluation`
- `planHash`
- `status`
- timestamps

### 9.12 ApprovalRecord

Fields:

- `id`
- `workspaceId`
- `runId`
- `planHash`
- `scope`
- `requiredRole`
- `status`
- `requestedAt`
- `expiresAt`
- `decidedAt?`
- `decidedBy?`
- `decisionReason?`

Approvals bind to an exact plan hash. Any plan mutation invalidates the approval.

### 9.13 Investigation

Groq advisory result.

Fields:

- `id`
- `runId`
- `trigger`
- `model`
- `promptVersion`
- sanitized evidence references
- structured output
- `status`: `PENDING | RUNNING | COMPLETED | FAILED | RATE_LIMITED`
- latency/token metadata where available
- timestamps

### 9.14 AuditEvent

Append-only event record.

Fields:

- `id`
- `workspaceId`
- `runId?`
- `actorType`
- `actorId`
- `eventType`
- `subjectType`
- `subjectId`
- normalized metadata
- `correlationId`
- `previousEventHash?`
- `eventHash`
- `createdAt`

No public update/delete endpoint exists for audit events.

---

## 10. Mission Definition Schema

The runtime must use a versioned schema with strong runtime validation (for example Zod on TypeScript boundaries).

Illustrative structure:

```yaml
schemaVersion: 1
name: "Move USDC from source vault to destination vault"
objective:
  type: asset_position
  chainId: 11155111
  asset: "0x..."
  amountInput: "amount"
  source:
    kind: contract
    address: "0x..."
  destination:
    kind: contract
    address: "0x..."

inputs:
  amount:
    type: uint256-string
    required: true

invariants:
  - id: capital-floor
    kind: erc20-min-accounted
    severity: critical
    token: "0x..."
    minimumExpression: "input.amount"
    locations:
      - wallet
      - source
      - destination
  - id: allowance-cap
    kind: erc20-allowance-max
    severity: critical
    token: "0x..."
    owner: keeperhub-wallet
    spender: "0x...destination"
    maximumExpression: "input.amount"
  - id: allowed-targets
    kind: target-allowlist
    severity: critical
    addresses:
      - "0x...source"
      - "0x...destination"

steps:
  - id: withdraw
    type: contract-call
    dependsOn: []
    action: {...}
    retryClass: PROVABLE_EFFECT
    proof: {...}
    compensation:
      id: resupply-source
      action: {...}
      proof: {...}

  - id: approve-destination
    type: contract-call
    dependsOn: [withdraw]
    action: {...}
    retryClass: SEMANTICALLY_IDEMPOTENT
    proof: {...}
    compensation:
      id: revoke-destination
      action: {...}
      proof: {...}

  - id: deposit-destination
    type: contract-call
    dependsOn: [approve-destination]
    action: {...}
    retryClass: PROVABLE_EFFECT
    proof: {...}

recoveryPolicy:
  strategy: PREDECLARED
  terminalSafeStates:
    - ORIGINAL_POSITION_RESTORED
  maxRecoverySpendWei: "..."
  onKnownFailure: COMPENSATE
  onUnknownOutcome: RECONCILE
  onIndeterminateOutcome: ESCALATE
```

### 10.1 Schema rules

- All onchain integer values are decimal strings or hex strings validated into `bigint`; never JavaScript floating point.
- Addresses are checksummed/normalized at boundaries.
- Every write step must declare a retry class.
- Every write step must declare a verification/proof specification.
- Any step with an economically meaningful reversible effect should declare a compensation action when possible.
- Compensation actions must themselves have proof specifications.
- Mission definitions cannot contain arbitrary JavaScript, shell code, URLs, or executable snippets.
- v1 supports a constrained action/assertion DSL only.
- Every version has a stable content hash.

---

## 11. Mission State Machine

### 11.1 States

Use explicit states; do not overload “failed”.

- `DRAFT`
- `READY`
- `PREFLIGHT`
- `EXECUTING`
- `VERIFYING`
- `RECONCILING`
- `DEGRADED`
- `INVESTIGATING`
- `AWAITING_APPROVAL`
- `RECOVERING`
- `VERIFYING_RECOVERY`
- `PAUSED`
- `COMPLETED`
- `RECOVERED`
- `NEEDS_ATTENTION`
- `ABORTED_SAFE`

### 11.2 Terminal semantics

**COMPLETED**  
The mission objective and all critical terminal invariants are independently verified.

**RECOVERED**  
The original mission objective was not achieved, but Aether independently verified an authorized safe terminal state after compensating actions.

**NEEDS_ATTENTION**  
Aether cannot safely continue or recover autonomously. This is a truthful terminal/paused operational state, not a hidden generic error.

**ABORTED_SAFE**  
The run ended before any irreversible economic effect, or all provisional actions were proven absent. This state must never be used after confirmed side effects unless the final safe state is independently proven.

### 11.3 Invalid transitions

State transitions must be centrally validated. Workers and API handlers may not directly set arbitrary states.

Examples:

- `EXECUTING -> COMPLETED` is invalid without `VERIFYING`.
- `UNKNOWN/RECONCILING -> retry` is invalid without a reconciliation decision proving retry safety.
- `RECOVERING -> RECOVERED` is invalid without `VERIFYING_RECOVERY` and passing terminal invariants.
- an approved plan cannot be edited; new plan means new approval evaluation.

---

## 12. Step State Machine

Recommended states:

- `PENDING`
- `PRECONDITION_CHECK`
- `SIMULATING`
- `SIMULATION_FAILED`
- `AWAITING_APPROVAL`
- `READY_TO_SUBMIT`
- `SUBMITTING`
- `OUTCOME_UNKNOWN`
- `RECONCILING`
- `EXECUTED`
- `VERIFYING`
- `VERIFIED`
- `FAILED_KNOWN`
- `COMPENSATING`
- `COMPENSATED`
- `NEEDS_ATTENTION`
- `SKIPPED`

No UI or API should collapse `OUTCOME_UNKNOWN` into `FAILED_KNOWN`.

---

## 13. Invariant Engine

The invariant engine determines whether reality remains inside the mission’s authorized envelope.

### 13.1 Result type

Every invariant evaluates to:

- `PASS`
- `FAIL`
- `UNKNOWN`

Each result includes:

- invariant ID;
- expected expression;
- observed value/evidence references;
- block number/hash;
- confidence/canonicality status;
- explanation safe for UI;
- severity.

`UNKNOWN` on a critical invariant is fail-closed for new economic writes unless a specifically authorized risk-reducing recovery action can be proven safe from other evidence.

### 13.2 Required v1 invariant types

At minimum implement:

- exact chain ID;
- target contract allowlist;
- function allowlist;
- ERC-20 balance minimum/maximum;
- ERC-20 allowance maximum/exact;
- account/position balance minimum;
- contract read equals/not-equals/range;
- event existence with indexed argument matching;
- maximum native-token recovery spend;
- maximum number of writes per mission;
- deadline/maximum mission age;
- executor/actor address match where evidence permits;
- no unresolved unknown execution attempts before next conflicting economic write.

### 13.3 Invariant timing

Evaluate:

- at mission preflight;
- before every write;
- after every write;
- before every compensation;
- after every compensation;
- before terminal state.

---

## 14. KeeperHub Execution Contract

### 14.1 Required sequence for every v1 write

1. Resolve typed action parameters.
2. Evaluate step preconditions and mission invariants.
3. Build a canonical KeeperHub request body.
4. Persist `OperationPlan` and its hash.
5. Call KeeperHub with `simulate: true` using the same economic request body.
6. Persist `SimulationRecord`.
7. Stop if simulation reports revert/failure.
8. Evaluate authority policy against the exact plan hash.
9. Obtain approval if required.
10. Create a globally unique Aether operation key and KeeperHub `Idempotency-Key`.
11. Persist `ExecutionAttempt` in `SUBMITTING` before the external call.
12. Send the request exactly once from that attempt.
13. Persist acknowledgement/execution ID/transaction hash when returned.
14. Poll status according to KeeperHub guidance when applicable.
15. Independently verify the chain effect.
16. Only then mark the step `VERIFIED`.

### 14.2 Exact-request binding

The simulated economic payload and broadcast economic payload must be identical except for fields that necessarily differ between simulation and broadcast, such as removing `simulate: true`.

Any semantic change requires:

- a new plan;
- a new simulation;
- a new plan hash;
- a new authority evaluation;
- a new approval if approval is required.

### 14.3 Aether idempotency

KeeperHub documents provider idempotency with a bounded replay window. Aether must maintain **permanent application-level operation identity** and never rely solely on the provider window.

The database must enforce uniqueness for a logical step generation/operation key.

### 14.4 Rate limiting

Implement a KeeperHub client-side limiter below provider limits, per workspace credential. Respect `429` and `Retry-After`/poll hints where provided.

Rate limiting must never translate into “transaction failed”. It is a scheduling state.

---

## 15. Retry Safety Classification

Every write step must be one of:

### 15.1 `SEMANTICALLY_IDEMPOTENT`

Repeating the exact action produces the same intended state and cannot create an additional economic effect beyond the declared bounds.

Example: setting an allowance to an exact value may qualify if target token semantics are known and verified.

### 15.2 `PROVABLE_EFFECT`

The action may not be inherently idempotent, but Aether can uniquely determine from independent chain evidence whether the original action occurred.

The proof specification must be sufficient to distinguish this run/step from unrelated effects.

### 15.3 `NON_REPLAYABLE`

If the outcome becomes unknown and Aether cannot prove non-execution, automatic resubmission is prohibited. The mission escalates unless an alternate safe action is authorized.

### 15.4 Rule

A write step without an explicit retry class is invalid and cannot execute.

---

## 16. Unknown-Outcome Reconciliation

This is a headline product capability.

### 16.1 Triggers

Create a reconciliation case when any of the following occurs after Aether has begun a potentially broadcasting operation:

- network timeout;
- connection reset;
- process crash between request and persistence;
- provider 5xx with ambiguous semantics;
- malformed provider response;
- acknowledgement without retrievable final status;
- execution ID known but status unavailable beyond threshold;
- provider reports failure but independent evidence suggests a transaction landed;
- transaction hash returned but canonical receipt is temporarily unavailable;
- worker restart finds `SUBMITTING` without a proven terminal result.

### 16.2 Immediate behavior

- set `resubmissionLocked = true`;
- transition step/run to reconciliation states;
- emit audit event;
- do not create a second economic attempt;
- enqueue reconciliation with bounded backoff.

### 16.3 Reconciliation evidence order

Use the strongest evidence available:

1. Known transaction hash + canonical receipt.
2. Known KeeperHub execution ID + provider status, followed by independent receipt/postcondition verification.
3. Exact expected event/log match within a bounded block range and known executor/target constraints.
4. Exact storage/balance/economic postcondition that uniquely proves the effect.
5. Cross-provider confirmation where possible.

Provider status alone is not sufficient to mark a mission `COMPLETED`.

### 16.4 Reconciliation resolutions

**LANDED**  
The effect is independently proven. Do not resubmit. Continue from observed state.

**NOT_LANDED_SAFE_TO_RETRY**  
Aether has enough evidence, under the step retry policy, to create a new attempt or safely replay the provider idempotency key.

**INDETERMINATE**  
Aether cannot establish safety. Keep resubmission locked and move to `NEEDS_ATTENTION` or an authorized risk-reducing alternative.

### 16.5 Reorg handling

Verification is provisional until required confirmations are met.

If a previously seen receipt disappears or changes canonical block hash before finalization:

- invalidate provisional evidence;
- transition back to `RECONCILING`;
- never treat the disappeared receipt as confirmed history;
- re-evaluate mission state from current canonical chain.

---

## 17. Independent Verification

### 17.1 Provider independence

Verification must use RPC clients separate from the KeeperHub API response path.

Where feasible, configure two RPC providers and compare critical observations. Provider disagreement yields `UNKNOWN`, not arbitrary majority confidence.

### 17.2 Verification requirements

A step can only become `VERIFIED` if its proof specification passes against canonical chain evidence.

A mission can only become `COMPLETED` or `RECOVERED` when:

- no unresolved execution attempt is `UNKNOWN`;
- all critical terminal invariants pass;
- all required compensations are verified;
- relevant receipts meet confirmation policy;
- the final receipt references evidence IDs and hashes.

### 17.3 Final mission receipt

Generate a machine-readable and human-readable receipt containing:

- mission/run/version IDs;
- mission version hash;
- requested objective;
- final terminal state;
- whether original objective completed;
- whether compensation occurred;
- all KeeperHub execution IDs;
- transaction hashes and chain IDs;
- relevant block numbers/hashes;
- final invariant results;
- unresolved warnings (must be none for critical invariants in `COMPLETED`/`RECOVERED`);
- audit chain head hash;
- timestamps;
- receipt hash.

Optional future enhancement: anchor receipt hash onchain. Not required for v1 unless already easy to implement.

---

## 18. Recovery and Compensation Engine

### 18.1 Recovery goals

When a mission diverges, the engine must choose among:

- continue forward;
- retry a proven-safe step;
- execute one or more predeclared compensations;
- pause for approval;
- escalate because no safe automated action exists.

### 18.2 No arbitrary AI recovery

Recovery actions must come from mission-version templates or trusted built-in adapters. Groq may recommend `CONTINUE`, `RECOVER`, or `ESCALATE`, but cannot author arbitrary target addresses, calldata, asset amounts, or recovery destinations.

### 18.3 Compensation ordering

Default compensation order is reverse dependency order, but a mission may declare explicit ordering.

Before every compensation:

- refresh observations;
- ensure the original effect still exists and compensation remains relevant;
- recalculate amount from current verified reality, subject to mission bounds;
- re-evaluate all policy constraints;
- simulate through KeeperHub;
- bind approval to the exact compensation plan;
- execute through KeeperHub;
- independently verify.

### 18.4 Recovery budget

Each mission version declares a maximum autonomous recovery budget.

Recovery spending above the budget requires human approval or escalates.

### 18.5 Safe terminal state

A compensation plan must identify its intended safe state. “We ran the recovery transaction” is not enough. The state must be independently verified.

### 18.6 Compensation failure

If compensation itself fails:

- do not recursively generate unbounded compensations;
- create a new verified state snapshot;
- attempt only explicitly declared alternate compensation if policy permits;
- otherwise enter `NEEDS_ATTENTION`;
- preserve all prior evidence.

### 18.7 Approval expiration

If an approval expires before broadcast, discard it and re-simulate/re-plan. Never broadcast against stale approval.

---

## 19. Groq Advisory Investigation

### 19.1 Provider and SDK

Use GroqCloud through the native TypeScript package (`groq-sdk`). Remove the OpenAI SDK/provider integration from the Aether product.

Default model:

`llama-3.3-70b-versatile`

The model ID must be configurable through `GROQ_MODEL`, but production configuration must use an allowlisted Groq production model. Preview models must not silently become production defaults.

### 19.2 AI responsibilities

Groq may:

- summarize what changed;
- identify likely causes from supplied evidence;
- explain why the mission is degraded;
- recommend one of a constrained action enum;
- explain a deterministic recovery plan after it has been generated;
- produce operator-friendly incident summaries.

Groq may not:

- invoke KeeperHub;
- possess KeeperHub credentials;
- possess wallet keys;
- call arbitrary tools;
- fetch arbitrary URLs;
- modify mission definitions;
- increase budgets;
- approve plans;
- write calldata;
- choose arbitrary recipients;
- override invariant failures;
- convert `UNKNOWN` to success/failure based on speculation.

### 19.3 Structured output

Use JSON Object Mode where supported and validate with a strict local schema.

Suggested result:

```ts
type InvestigationResult = {
  summary: string;
  likelyCauses: Array<{
    cause: string;
    evidenceIds: string[];
    confidence: number; // 0..1 display aid only
  }>;
  recommendedDisposition: "CONTINUE" | "RECOVER" | "ESCALATE";
  operatorNotes: string[];
  uncertainty: string[];
};
```

The system must reject unexpected properties or invalid enums at the local validation boundary.

### 19.4 Evidence hygiene

Pass only bounded, relevant, sanitized facts:

- mission objective summary;
- step states;
- transaction/receipt metadata;
- decoded revert reason;
- invariant results;
- chain observations;
- non-secret contract metadata.

Never send:

- API keys;
- cookies;
- auth headers;
- private keys;
- unredacted secrets;
- entire database documents;
- arbitrary user-provided HTML or remote content.

Treat revert strings/token metadata/contract text as **untrusted data**, not instructions.

### 19.5 Failure behavior

Groq failure must not block safe deterministic behavior.

On `429`, timeout, 5xx, schema failure, or provider outage:

- persist a sanitized failed investigation record;
- use bounded exponential backoff with jitter where retry is appropriate;
- honor `Retry-After` where supplied;
- trip a circuit breaker after repeated provider failure;
- show “Advisory analysis unavailable” in the UI;
- continue deterministic recovery if the recovery policy and evidence independently authorize it;
- never fabricate an AI response.

### 19.6 Cost/rate controls

- per-workspace and global concurrency limits;
- deduplicate identical investigation requests by evidence hash;
- cache completed analysis for the immutable evidence set;
- token caps;
- no background conversational history unless required;
- record usage metadata without raw secrets;
- free-tier-compatible defaults for demo/dev, but production capacity must not assume free-tier SLA.

---

## 20. Authority and Approval Engine

### 20.1 Roles

At minimum:

- `OWNER`
- `OPERATOR`
- `VIEWER`
- `AGENT`

### 20.2 Agent authority

Agent API keys may create/run only missions permitted by their scopes and workspace policy. They cannot change KeeperHub credentials, workspace spending limits, roles, or recovery authority.

### 20.3 Approval policy inputs

Evaluate:

- mission version;
- plan hash;
- action target/function;
- token and amount;
- predicted gas/value;
- recovery vs forward action;
- current invariant state;
- recovery budget remaining;
- workspace policy;
- actor role;
- approval expiry.

### 20.4 Approval result

- `AUTO_APPROVED`
- `HUMAN_REQUIRED`
- `DENIED`

Every result is deterministic and persisted.

### 20.5 Contextual approval UI

Approval page must show:

- why approval is required;
- exact action and amount;
- target contract;
- chain;
- plan hash;
- simulation status;
- relevant current state;
- expected postconditions;
- what happens if denied/expired.

No vague “Approve AI action” button.

---

## 21. Agent API

Aether should be usable without its UI.

### 21.1 Authentication

Use hashed, revocable workspace API keys with scopes. Show plaintext only once at creation.

Suggested scopes:

- `missions:read`
- `missions:create`
- `runs:create`
- `runs:read`
- `receipts:read`

### 21.2 Mutation idempotency

All externally callable mutation endpoints must accept an `Idempotency-Key` and persist dedupe records at the Aether boundary.

### 21.3 Suggested API surface

#### Missions

- `POST /v1/missions`
- `GET /v1/missions`
- `GET /v1/missions/:missionId`
- `POST /v1/missions/:missionId/versions`
- `POST /v1/missions/:missionId/archive`

#### Runs

- `POST /v1/missions/:missionId/runs`
- `GET /v1/runs/:runId`
- `GET /v1/runs/:runId/timeline`
- `GET /v1/runs/:runId/receipt`
- `POST /v1/runs/:runId/pause`
- `POST /v1/runs/:runId/resume`
- `POST /v1/runs/:runId/cancel`

Cancellation semantics must be state-aware; after irreversible effects it may initiate safe recovery rather than simply mark a run cancelled.

#### Approvals

- `GET /v1/approvals`
- `GET /v1/approvals/:id`
- `POST /v1/approvals/:id/approve`
- `POST /v1/approvals/:id/deny`

#### Integrations

- `GET /v1/integrations/keeperhub`
- `PUT /v1/integrations/keeperhub`
- `POST /v1/integrations/keeperhub/validate`
- `DELETE /v1/integrations/keeperhub`

Responses never include credential plaintext.

#### Audit

- `GET /v1/audit`
- `GET /v1/audit/:eventId`

### 21.4 Webhooks

Optional but strongly preferred for production:

- `mission.run.started`
- `mission.run.degraded`
- `mission.run.reconciling`
- `mission.run.awaiting_approval`
- `mission.run.completed`
- `mission.run.recovered`
- `mission.run.needs_attention`

Webhook deliveries must be signed, retryable, idempotent, and have a dead-letter path.

---

## 22. Worker and Outbox Architecture

Retain the existing proven outbox/worker pattern if it remains sound.

### 22.1 Rules

- state change and outbox enqueue occur atomically in the MongoDB transaction where supported;
- workers are restart-safe;
- workers may run concurrently without duplicating economic operations;
- every job handler is idempotent;
- BullMQ job IDs are not reused for intentional distinct operations;
- retrying an HTTP request and retrying a logical operation are distinct concepts;
- state-transition compare-and-set protects against stale workers;
- leases/locks have expirations and fencing tokens or equivalent stale-worker protection;
- no transaction is broadcast from a fire-and-forget request handler without durable pre-persistence.

### 22.2 Required worker jobs

- `mission.start`
- `mission.advance`
- `step.preflight`
- `step.simulate`
- `step.execute`
- `step.poll`
- `step.verify`
- `execution.reconcile`
- `mission.investigate`
- `recovery.plan`
- `recovery.execute`
- `mission.verify-terminal`
- `webhook.deliver`
- periodic stale-run sweeper
- periodic unknown-execution sweeper

### 22.3 Crash windows to explicitly handle

Test and design for crashes:

- before external request;
- after external request begins but before response;
- after provider response but before database commit;
- after database commit but before queue ack;
- during verification;
- during compensation;
- after final verification but before receipt persistence.

---

## 23. Dedicated Demo Product Surface

### 23.1 Route

`/demo`

The page is deliberately optimized for storytelling while still using production services.

### 23.2 Demo headline

Recommended:

> **A successful transaction does not mean a successful mission.**

Subheadline:

> Watch Aether recover a multi-step onchain mission when execution breaks halfway.

### 23.3 Demo scenarios

Provide three selectable cards:

#### Scenario A — Happy path

All mission steps execute through KeeperHub and verify independently.

#### Scenario B — Partial failure + compensation

At least two real Sepolia effects complete. A later step becomes unable to proceed (preferably detected by real KeeperHub simulation or a deterministic demo guard). Aether enters `DEGRADED`, plans compensation, executes compensation through KeeperHub, and verifies the safe terminal state.

#### Scenario C — Lost response / unknown outcome

A real KeeperHub write is submitted. After the provider call, a **demo-only fault injector** intentionally discards the acknowledgement before normal application persistence, reproducing a transport/process ambiguity. Aether must:

- show `OUTCOME UNKNOWN`;
- set `resubmissionLocked`;
- start reconciliation;
- find the real effect independently;
- prove it landed;
- avoid duplicate broadcast;
- continue the mission.

This is controlled fault injection around a real execution, not a mocked receipt.

### 23.4 Demo fixtures

Use audited/simple demo contracts deployed on Sepolia to make the scenario deterministic. They should:

- use a standard ERC-20 test asset or clearly identified demo asset;
- emit events containing enough identifiers to support exact reconciliation;
- expose source/destination position semantics;
- allow deterministic setup/reset for a new demo run;
- allow a failure condition that can be enabled without giving the UI arbitrary contract-call capability;
- be verified on the block explorer if practical;
- live under a clearly named `contracts/demo` or equivalent path;
- never be used as hidden mocks in production mission adapters.

The demo contracts are **fixtures**. The Aether runtime around them is production code.

### 23.5 Demo execution security

Do not allow an unbounded public endpoint to spend a funded KeeperHub wallet.

Use one of:

- authenticated judge/demo session;
- single-use signed demo tokens;
- severe server-side per-IP/session rate limits plus global daily run caps;
- environment flag `DEMO_LIVE_EXECUTION_ENABLED`.

Demo requests may choose only a predefined scenario and bounded amount. They cannot supply arbitrary addresses, calldata, token values, or chain IDs.

### 23.6 Demo replay mode

When live execution is disabled or the wallet lacks funds, `/demo` may replay a previously recorded real run for presentation, but it must be visibly labeled **Replay of verified Sepolia run** and must not masquerade as a new live transaction.

### 23.7 Demo layout

The page should have:

- scenario selector;
- mission objective;
- animated mission graph/timeline;
- live state badge (`EXECUTING`, `RECONCILING`, `RECOVERING`, etc.);
- expected vs observed state;
- KeeperHub execution rows;
- independent verification rows;
- recovery plan;
- transaction links;
- invariant checklist;
- final receipt summary;
- reset/new demo action when safe.

Follow `docs/DESIGN.MD` exactly for visual language.

---

## 24. Product UX Requirements

### 24.1 Overview

Show meaningful operational information only:

- active missions;
- recovering/reconciling missions;
- awaiting approvals;
- completed/recovered counts;
- recent mission timeline;
- integration health;
- no invented “protocol health” percentages.

### 24.2 Missions list

Columns/cards should emphasize:

- mission name;
- active version;
- last run state;
- last run time;
- recovery capability;
- creator/source (`Human` or `Agent API`).

### 24.3 Mission detail

Tabs or sections:

- Definition
- Versions
- Runs
- Guardrails / Recovery

### 24.4 Run detail — the flight recorder

This is the flagship authenticated page.

Show:

- mission objective;
- state and reason;
- current step;
- step timeline;
- plan/simulation/execution/verification phases;
- exact transaction links;
- expected vs observed state;
- invariant results;
- unknown-outcome lock when active;
- AI advisory investigation clearly labeled as advisory;
- recovery plan and authority status;
- final receipt.

Never make users open five drawers just to understand what happened.

### 24.5 Terminology

Use plain language in the primary UI:

- “Mission” not “protocol resource”.
- “Expected state” / “Observed state” not “desired alignment”.
- “Recovering” not “forward correction required”.
- “Unknown outcome — retry locked” not generic “error”.
- “Compensating action” in technical detail; “Recovery action” in primary UI.

### 24.6 Accessibility and responsiveness

- meet WCAG AA for contrast and keyboard interaction where applicable;
- visible focus states;
- semantic status announcements for live updates;
- no status indicated by color alone;
- desktop and mobile responsive behavior per `docs/DESIGN.MD`;
- Playwright accessibility checks on all primary routes;
- reduced-motion support for demo animations.

---

## 25. Integration Configuration

### 25.1 KeeperHub

Configuration includes:

- API base URL;
- API key secret;
- expected organization/wallet identity where discoverable;
- allowed chain IDs;
- health status;
- last validated timestamp.

Validation must:

- never display the raw key;
- confirm authentication;
- confirm Sepolia execution support;
- confirm a wallet is configured;
- optionally confirm a minimum testnet ETH balance;
- fail closed if identity unexpectedly changes.

### 25.2 RPC

Production should support at least two named providers via server-only configuration.

Each provider gets:

- ID/name;
- URL secret;
- chain ID;
- request timeout;
- log-range capability settings;
- health status.

Provider reads must honor per-provider log limits and use bounded chunking.

### 25.3 Groq

Server-only:

- `GROQ_API_KEY`
- `GROQ_MODEL=llama-3.3-70b-versatile`
- timeout;
- max retries;
- max completion tokens;
- concurrency limit.

No Groq key may reach the browser.

---

## 26. Security Requirements

### 26.1 Secret handling

- no secret values in source control;
- no secret values in browser bundles;
- no secret values in logs/audit events;
- environment-specific keys;
- encrypted-at-rest integration credentials using a documented envelope-encryption approach or production secret store;
- support key rotation without database surgery;
- redact authorization headers and provider payload fields that can carry secrets.

### 26.2 Authentication/session

Retain existing auth only if security review passes.

Requirements:

- secure, HTTP-only, same-site cookies where session cookies are used;
- CSRF protection for cookie-authenticated mutations;
- server-side tenant resolution from session, never trusted client tenant IDs;
- session invalidation on logout;
- role checks on every tenant-scoped route;
- return-to redirect must be allowlisted/local.

### 26.3 API keys

- cryptographically random;
- store only hash/prefix metadata;
- show plaintext once;
- scoped;
- revocable;
- last-used timestamp;
- rate limited.

### 26.4 Authorization

Every query must be workspace-bound server-side. Never take `workspaceId` as authority simply because the browser supplied it.

### 26.5 SSRF and arbitrary network access

Mission definitions cannot contain arbitrary fetch URLs. RPC endpoints are admin configuration, validated, and not dynamically selected by AI/user mission input.

### 26.6 Input limits

Define maximum:

- mission size;
- number of steps;
- number of invariants;
- ABI size;
- string lengths;
- JSON body size;
- pagination size.

### 26.7 AI prompt-injection resistance

- chain text is untrusted evidence;
- quote/delimit evidence;
- no AI tool access;
- no secrets in prompt;
- schema-validate output;
- deterministic engine ignores free-form directives in AI output.

### 26.8 Transaction safety

- Sepolia-only launch allowlist;
- exact contract/function allowlists in demo templates;
- no arbitrary destination in `/demo`;
- plan hash/approval binding;
- mandatory simulation;
- independent verification;
- unknown-outcome retry lock;
- global emergency pause that prevents *new* writes but does not erase state or corrupt reconciliation.

### 26.9 Audit integrity

Audit chain hashing should make silent application-level alteration detectable. If hash chaining already exists, preserve and strengthen it. If not, implement deterministic canonical event hashing.

---

## 27. Observability and Operations

### 27.1 Structured logs

Every log line for mission work should include:

- `correlationId`
- `workspaceId`
- `runId`
- `stepRunId?`
- `operationPlanId?`
- `executionAttemptId?`
- job ID
- service component

Never log secret values.

### 27.2 Metrics

Expose or collect:

- API request latency/error counts;
- queue depth and age;
- outbox backlog;
- worker job retries/failures;
- mission state counts;
- reconciliation durations/results;
- recovery durations/results;
- KeeperHub 2xx/4xx/5xx/429;
- Groq 2xx/429/5xx/schema failures;
- RPC error/disagreement/reorg events;
- webhook delivery failures;
- database transaction failures.

### 27.3 Tracing

Prefer OpenTelemetry-compatible tracing if current stack can support it without destabilization. Trace external calls and job continuations using propagated correlation IDs.

### 27.4 Health endpoints

- liveness: process is running;
- readiness: required database/queue dependencies reachable;
- provider health details only for authenticated/admin surfaces;
- health payloads must not expose URLs with credentials or configuration secrets.

### 27.5 SLO targets

Initial targets:

- authenticated API availability: 99.9% target excluding third-party outage windows;
- Aether-caused duplicate economic broadcast: zero tolerated;
- verified terminal receipt coverage: 100% of `COMPLETED`/`RECOVERED`;
- critical audit-event persistence: 100%; if audit persistence fails, economic write does not proceed;
- stale `SUBMITTING` attempts are automatically discovered by sweeper after bounded threshold;
- known divergence enters recovery planning within 15 seconds under healthy dependencies, excluding configured approval wait.

---

## 28. Error Taxonomy

Use typed errors. Do not expose raw provider exceptions directly to UI.

Suggested categories:

- `VALIDATION_ERROR`
- `AUTHENTICATION_REQUIRED`
- `FORBIDDEN`
- `TENANT_CONTEXT_INVALID`
- `INTEGRATION_NOT_CONFIGURED`
- `CHAIN_NOT_ALLOWED`
- `MISSION_SCHEMA_INVALID`
- `INVARIANT_FAILED`
- `INVARIANT_UNKNOWN`
- `SIMULATION_REVERTED`
- `APPROVAL_REQUIRED`
- `APPROVAL_EXPIRED`
- `PLAN_CHANGED`
- `KEEPERHUB_RATE_LIMITED`
- `KEEPERHUB_REJECTED`
- `EXECUTION_OUTCOME_UNKNOWN`
- `RECONCILIATION_INDETERMINATE`
- `VERIFICATION_FAILED`
- `RPC_DISAGREEMENT`
- `RECOVERY_NOT_AUTHORIZED`
- `RECOVERY_FAILED`
- `GROQ_UNAVAILABLE`
- `GROQ_OUTPUT_INVALID`
- `WORKER_STALE_WRITE`
- `IDEMPOTENCY_CONFLICT`

User-facing messages should include a safe next action, not internal stack traces.

---

## 29. Edge-Case Matrix

This section is mandatory implementation scope.

### 29.1 API/client idempotency

**Case:** user double-clicks “Run mission”.  
**Behavior:** same client idempotency key returns same run; no duplicate run.

**Case:** same idempotency key with different payload.  
**Behavior:** `409 IDEMPOTENCY_CONFLICT`.

### 29.2 KeeperHub request ambiguity

**Case:** timeout before TCP/TLS request is known to leave process.  
**Behavior:** if provably no external request occurred, safe internal retry; otherwise treat as unknown.

**Case:** timeout after request may have reached KeeperHub.  
**Behavior:** lock resubmission, reconcile.

**Case:** KeeperHub returns execution ID but status polling fails.  
**Behavior:** keep ID, reconcile/poll with backoff; no new economic attempt.

**Case:** KeeperHub says failed but tx hash has successful canonical receipt.  
**Behavior:** chain reality wins; record provider disagreement; verify postcondition.

**Case:** KeeperHub says completed but independent postcondition fails.  
**Behavior:** step is not verified; mission degrades or reconciles.

**Case:** KeeperHub idempotency window expires while Aether is uncertain.  
**Behavior:** do not reuse provider retry as proof of safety. Application-level attempt remains locked until reconciliation.

### 29.3 Worker concurrency

**Case:** two workers receive same `step.execute`.  
**Behavior:** atomic lease/CAS permits one submitter; second exits idempotently.

**Case:** stale worker resumes after lock expiry.  
**Behavior:** fencing/version check prevents stale state mutation/broadcast.

### 29.4 Process crashes

**Case:** crash after persisting `SUBMITTING`, before network call.  
**Behavior:** recovery job assesses whether network call began using durable dispatch markers; if uncertain, reconciliation path.

**Case:** crash after KeeperHub accepted request but before response persisted.  
**Behavior:** reconciliation, not blind resend.

**Case:** crash after final verification but before mission receipt.  
**Behavior:** terminal verifier is idempotent and reconstructs receipt from immutable evidence.

### 29.5 Chain/RPC

**Case:** RPC provider returns wrong chain ID.  
**Behavior:** provider unhealthy; never use evidence.

**Case:** two RPC providers disagree.  
**Behavior:** critical evidence becomes unknown; retry/read a later block; if unresolved, escalate.

**Case:** `eth_getLogs` provider range limit.  
**Behavior:** chunk bounded ranges using provider-specific configuration.

**Case:** receipt seen with insufficient confirmations.  
**Behavior:** provisional only.

**Case:** reorg removes provisional receipt.  
**Behavior:** invalidate observation and reconcile canonical reality.

**Case:** token has non-standard ERC-20 return behavior.  
**Behavior:** adapter must verify effect by balance/allowance, not trust return value alone.

**Case:** fee-on-transfer/rebasing token.  
**Behavior:** unsupported by generic exact-amount assumptions unless mission adapter explicitly defines accounting semantics; reject otherwise.

### 29.6 Numeric correctness

**Case:** amount exceeds JS safe integer.  
**Behavior:** values remain string/`bigint`; never `number`.

**Case:** token decimals differ.  
**Behavior:** read/cache verified decimals and format only at presentation boundary.

**Case:** rounding would violate capital floor.  
**Behavior:** fail preflight or require explicit bounded tolerance.

### 29.7 Mission changes

**Case:** user edits mission while a run exists.  
**Behavior:** new immutable version; existing run stays bound to prior version.

**Case:** compensation definition changes after run begins.  
**Behavior:** current run uses frozen mission version; no retroactive change.

### 29.8 Approvals

**Case:** approver approves then state changes before execution.  
**Behavior:** re-evaluate freshness/invariants; if material plan inputs differ, invalidate approval and regenerate plan.

**Case:** two humans make conflicting decisions.  
**Behavior:** first valid atomic transition wins; later request receives current state.

### 29.9 Recovery

**Case:** compensation no longer needed because state changed externally.  
**Behavior:** precondition check skips/adjusts only within declared deterministic rules; never execute stale compensation.

**Case:** compensation simulation fails.  
**Behavior:** no broadcast; consider declared alternate or `NEEDS_ATTENTION`.

**Case:** recovery partially succeeds.  
**Behavior:** checkpoint each recovery effect exactly like forward steps; recalculate reality; continue allowed remaining compensations or escalate.

**Case:** recovery would exceed spend budget.  
**Behavior:** human approval required or escalate.

### 29.10 Cancellation/pause

**Case:** cancel before first write.  
**Behavior:** `ABORTED_SAFE`.

**Case:** cancel after confirmed side effect.  
**Behavior:** cancellation is interpreted as “stop pursuing objective and move toward authorized safe state”; initiate recovery if available.

**Case:** global emergency pause during unknown outcome.  
**Behavior:** prevent new writes but continue read-only reconciliation so reality can be established.

### 29.11 Groq

**Case:** Groq 429.  
**Behavior:** bounded backoff; advisory unavailable state; deterministic runtime continues.

**Case:** Groq returns malformed JSON.  
**Behavior:** local validation fails; at most one constrained repair retry; never use malformed recommendation.

**Case:** model recommends forbidden action.  
**Behavior:** ignored/reported; deterministic planner only uses allowed enums/templates.

**Case:** prompt injection appears in revert reason/token metadata.  
**Behavior:** treated as quoted evidence; model has no tools/authority; output still schema/policy constrained.

### 29.12 Demo

**Case:** demo wallet low on gas.  
**Behavior:** preflight blocks live run and offers replay of last verified run.

**Case:** multiple visitors spam live demo.  
**Behavior:** global and per-session rate caps; fixed small amounts; queue or reject politely.

**Case:** demo fault injection accidentally enabled in production application routes.  
**Behavior:** impossible by compile/config boundary: injection endpoints exist only when dedicated demo flag/environment is enabled and accept only predefined scenario IDs.

---

## 30. Data Integrity and Database Requirements

### 30.1 MongoDB transactions

Use replica-set transactions for state + outbox changes that must be atomic.

### 30.2 Required indexes

At minimum:

- unique workspace slug where applicable;
- unique `(missionId, versionNumber)`;
- unique mission version hash within mission;
- unique Aether idempotency records by `(workspaceId, key, routeScope)`;
- unique execution operation key;
- unique active lease/fencing indexes as architecture requires;
- indexes on run state + updated timestamp for sweepers;
- indexes on `runId`, `stepRunId`, `executionAttemptId` across evidence/audit;
- audit pagination by `(workspaceId, createdAt, id)`;
- approval status + expiry.

### 30.3 Immutability

Mission versions, plans, simulation records, observations, approvals after decision, final receipts, and audit events are append-only/immutable at the application layer.

### 30.4 Retention

Do not silently delete execution/audit evidence. Define retention explicitly before any production cleanup job. Demo sessions may have separate UI/session retention but verified transaction evidence should remain addressable.

---

## 31. Teardown of the Old Product

This is a rewrite, not a coexistence release.

### 31.1 Remove from product

Delete code, routes, schemas, tests, UI, navigation, jobs, environment variables, provider clients, and copy that exist only for:

- GitHub App/installations;
- repository/branch/path desired-state provenance;
- desired-state YAML ingestion;
- repository resource mapping;
- oracle drift;
- oracle freshness;
- protocol resource alignment;
- protocol health percentage;
- old correction workflow naming;
- old “desired version” product model;
- OpenAI provider/client integration.

### 31.2 GitHub dependency removal

If Octokit/GitHub packages are not used by anything outside the removed product, remove them from dependencies and lockfile.

Remove obsolete:

- GitHub webhook routes;
- installation token minting;
- GitHub doctor checks;
- GitHub environment variables;
- GitHub settings UI;
- GitHub tests/fixtures.

### 31.3 OpenAI removal

Remove:

- `OPENAI_API_KEY`;
- OpenAI-specific service classes;
- OpenAI SDK dependency if no longer used elsewhere;
- provider docs/health checks;
- OpenAI-named UI text;
- old test mocks.

Replace with Groq-native implementation and `GROQ_*` configuration.

### 31.4 Old database data

Create an explicit migration command with:

- dry-run mode;
- backup/export guard for any non-test data;
- clear list of collections/fields to drop or transform;
- idempotent rerun behavior;
- production confirmation guard.

For this pivot, do not retain old domain collections simply “just in case.” Export if necessary, then remove from active schema/code.

### 31.5 No compatibility aliases

Do not leave endpoints such as `/drifts` returning mission data under a renamed wrapper. Delete old contracts and update all clients/tests.

### 31.6 Documentation cleanup

Inside `docs/`, keep **only** `docs/DESIGN.MD`. Delete all other existing Markdown files because they describe the old product.

The new root documentation set should be:

- `README.md` — rewritten for new Aether;
- `PRD.MD` — this specification;
- `AGENTS.MD` — implementation rules;
- `docs/DESIGN.MD` — existing visual design source of truth.

Do not delete license/security/legal files merely because they are Markdown if they are not old product docs.

---

## 32. Migration Strategy

### Phase 0 — Repository inventory

Before editing:

- map packages/apps;
- identify old-domain dependencies;
- identify reusable auth/session, database, queue, SDK, KeeperHub, RPC, audit, UI shell, realtime infrastructure;
- identify existing tests and scripts;
- read `docs/DESIGN.MD` fully.

### Phase 1 — Domain replacement

Implement new domain models and state-machine primitives first, with tests.

### Phase 2 — Execution/reconciliation reuse

Port/refactor the existing proven KeeperHub execution, unknown-outcome lock, RPC verification, and outbox/worker behavior under the new mission model.

Do not wrap old “correction operation” objects and call them missions. Replace the model cleanly.

### Phase 3 — Recovery engine

Implement compensation definitions, deterministic planning, approval, execution, verification.

### Phase 4 — Groq migration

Remove OpenAI and implement advisory Groq service.

### Phase 5 — UI replacement

Delete old product routes/components and implement the new information architecture using `docs/DESIGN.MD`.

### Phase 6 — Demo fixtures/page

Deploy demo contracts to Sepolia, configure fixed scenario, implement live fault injection and replay fallback.

### Phase 7 — cleanup

Search source, tests, environment templates, docs, assets, and route manifests for legacy concepts. Remove dead code/dependencies.

### Phase 8 — release gates

Run all automated quality/security/live-test gates described below.

---

## 33. Testing Strategy

### 33.1 Unit tests

Cover:

- mission schema validation;
- content hashing/canonicalization;
- state transitions;
- invariant evaluators;
- policy engine;
- plan hashing;
- approval binding;
- retry classification;
- reconciliation decisions;
- compensation ordering;
- amount resolution with `bigint`;
- error normalization;
- Groq output validation;
- secret redaction.

### 33.2 Property/fuzz tests

Use property-based tests and/or Foundry fuzz/invariant tests where appropriate for:

- no invalid state transition can bypass verification;
- approval never applies to a different plan hash;
- no `UNKNOWN` non-replayable step can auto-resubmit;
- recovery never exceeds declared amount/budget;
- final `COMPLETED`/`RECOVERED` implies all critical invariants pass;
- canonical hashing is stable;
- compensation sequence does not execute a step twice under job replay.

### 33.3 Integration tests

Against isolated Mongo replica set + Redis:

- transaction/outbox atomicity;
- worker crash recovery;
- duplicate BullMQ delivery;
- stale lease/fencing behavior;
- API idempotency;
- session tenant binding;
- approval races;
- terminal receipt reconstruction.

### 33.4 KeeperHub adapter contract tests

Mock only the external HTTP boundary for deterministic CI; test:

- successful simulation;
- simulation revert;
- 401/403;
- 409 idempotency conflict/in-progress;
- 429 with retry headers;
- timeout before/after dispatch classification;
- malformed response;
- execution ID/status polling;
- provider says complete but verification fails.

### 33.5 RPC tests

- provider range limits;
- receipt confirmations;
- event matching;
- wrong-chain provider;
- provider disagreement;
- simulated reorg;
- stale head;
- non-standard token behaviors where supported.

### 33.6 Groq tests

- normal JSON object output;
- invalid JSON/schema;
- 429;
- timeout;
- 5xx;
- prompt-injection text in evidence;
- model recommends forbidden disposition/value;
- circuit breaker and recovery.

No test should require Groq availability unless explicitly marked live.

### 33.7 Playwright/E2E

Required paths:

- anonymous landing;
- login/logout/return-to;
- overview;
- mission create/edit-version;
- mission run happy path using test adapter;
- degraded/recovering UI;
- approval flow;
- unknown outcome UI;
- audit filtering/details;
- settings/integration validation;
- `/demo` replay;
- `/demo` live run as opt-in.

Run desktop and at least one mobile viewport. Include accessibility checks and visual baselines consistent with `docs/DESIGN.MD`.

### 33.8 Live Sepolia acceptance suite

Opt-in only, never run during ordinary CI.

It must prove:

- KeeperHub validation;
- real simulation;
- real forward transaction;
- independent canonical receipt;
- real partial-failure recovery;
- real compensating transaction(s);
- unknown-outcome fault injection around a real KeeperHub call;
- successful independent reconciliation;
- no duplicate economic effect;
- final receipt.

The suite should write a machine-readable run artifact and a concise human acceptance journal, but **do not recreate many obsolete docs files**. Store generated test artifacts outside `docs/` or in CI artifacts.

---

## 34. Quality Gates / Definition of Done

Aether is not done because the UI renders.

All applicable repository scripts must pass:

- formatting;
- lint;
- TypeScript/build-time type checks;
- unit tests;
- integration tests;
- worker recovery tests;
- Foundry tests for contracts;
- security/static checks already present;
- accessibility tests;
- visual regression tests;
- non-live E2E;
- production build;
- dependency vulnerability audit according to existing project policy.

Additionally:

- no old GitHub/oracle/desired-state product route is reachable;
- no old OpenAI runtime dependency remains;
- no obsolete environment variable is required;
- no legacy schema is imported by production code;
- no TODO, placeholder implementation, mock success, or “temporary bypass” exists on critical execution/recovery paths;
- `/demo` successfully demonstrates all three scenarios or clearly falls back to a labeled verified replay when live execution is disabled;
- every live write visible in demo links to real Sepolia evidence;
- no test or quality command broadcasts a transaction unless explicitly run with the live-test flag.

---

## 35. Demo Acceptance Script

This is the target presentation flow.

### 35.1 Opening

Show `/demo`.

Text:

> A successful transaction does not mean a successful mission.

Mission card:

> Move 10 test USDC from Safe Position A to Strategy B.

Guardrails:

- account for all 10 USDC;
- no unused destination allowance after failure;
- only approved contracts;
- never duplicate an uncertain write.

### 35.2 Start partial-failure scenario

Aether shows:

1. source withdrawal → simulated → KeeperHub executed → independently verified;
2. destination approval → simulated → KeeperHub executed → independently verified;
3. destination step cannot proceed → mission `DEGRADED`.

Observed state visibly shows capital/allowance divergence.

### 35.3 Investigate

Groq advisory appears if available. If Groq is unavailable, the demo explicitly shows advisory unavailable and continues.

### 35.4 Recover

Aether generates deterministic recovery:

1. revoke stranded approval;
2. restore source safe position.

Each write:

- simulation;
- policy;
- KeeperHub execution;
- independent verification.

Final state: `RECOVERED`.

### 35.5 Unknown-outcome scenario

Run a second scenario where the demo fault injector discards the response after a real KeeperHub execution call.

UI must visibly show:

- `OUTCOME UNKNOWN`;
- `RETRY LOCKED`;
- independent reconciliation progress;
- transaction/effect discovered;
- “original write landed — no resubmission”;
- mission continuation;
- zero duplicate actions.

### 35.6 Final receipt

Show:

- expected capital;
- accounted capital;
- open allowance;
- unresolved unknown executions;
- KeeperHub executions;
- verified transaction hashes;
- terminal state;
- receipt hash.

---

## 36. README Requirements

Rewrite root `README.md` to contain:

1. product one-liner;
2. architecture diagram;
3. why mission-level recovery is needed;
4. features;
5. local development prerequisites;
6. environment setup with safe placeholders;
7. how to run services;
8. how to run tests;
9. how to run the opt-in live Sepolia demo;
10. security model;
11. link/reference to `PRD.MD` and `docs/DESIGN.MD`;
12. explicit note that AI is advisory and all writes use KeeperHub;
13. explicit note that launch execution is Sepolia-only.

Do not restore deleted old documentation as README sections.

---

## 37. Configuration / Environment Contract

Names may be adapted to existing conventions, but the final project should converge on a small documented set similar to:

```bash
# Core
NODE_ENV=
APP_BASE_URL=
SESSION_SECRET=

# Data
MONGODB_URI=
REDIS_URL=

# KeeperHub
KEEPERHUB_BASE_URL=https://app.keeperhub.com
KEEPERHUB_API_KEY=

# Chain policy
AETHER_ALLOWED_CHAIN_IDS=11155111
AETHER_MIN_CONFIRMATIONS=3
SEPOLIA_RPC_PRIMARY_URL=
SEPOLIA_RPC_SECONDARY_URL=

# Groq
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_TIMEOUT_MS=
GROQ_MAX_RETRIES=
GROQ_MAX_COMPLETION_TOKENS=

# Secrets/encryption
AETHER_CREDENTIAL_ENCRYPTION_KEY=

# Demo
DEMO_LIVE_EXECUTION_ENABLED=false
DEMO_MAX_LIVE_RUNS_PER_HOUR=
DEMO_FIXED_AMOUNT=
DEMO_SOURCE_CONTRACT=
DEMO_DESTINATION_CONTRACT=
DEMO_TOKEN_ADDRESS=

# Live tests
LIVE_SEPOLIA_TESTS=false
```

Remove old GitHub/OpenAI/oracle-specific environment settings from `.env.example`, validators, deployment config, CI, and docs.

---

## 38. API and UI Security Headers / Platform Hardening

Where compatible with the existing framework:

- Content Security Policy;
- HSTS in production;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy`;
- frame restrictions unless intentional embedding exists;
- secure cookies;
- explicit CORS allowlist for API clients;
- API request rate limiting;
- mutation CSRF defense for browser cookie auth;
- payload size limits;
- dependency audit;
- no source maps containing secrets;
- no internal error stacks in production responses.

---

## 39. Performance Requirements

- overview/list APIs paginate;
- audit uses cursor pagination;
- no unbounded `eth_getLogs` query;
- cache static contract metadata/decimals safely;
- do not cache mutable evidence across block contexts without block key;
- SSE/WebSocket realtime may reuse existing infrastructure, but the database remains source of truth;
- UI reconnects by refetching canonical current state rather than trusting missed realtime messages;
- Groq requests are asynchronous/advisory and do not hold critical database transactions open;
- external HTTP calls do not occur inside MongoDB transactions.

---

## 40. Production Failure Philosophy

Aether should always prefer a truthful incomplete state over a polished false success.

If a provider is down:

- persist what is known;
- stop at the correct boundary;
- reconcile later;
- show the operator exactly why progression is blocked.

If chain reality cannot be determined:

- say `UNKNOWN`;
- lock unsafe writes;
- never convert uncertainty into “failed” just to make the state machine simpler.

If AI is down:

- deterministic engine continues if safe;
- UI loses explanation quality, not financial safety.

If the UI is down:

- workers continue based on durable state and policy;
- operator can recover via API after UI returns.

If Redis is temporarily unavailable:

- durable outbox preserves work;
- no economic operation is considered complete merely because a queue publish succeeded.

If MongoDB cannot commit the pre-broadcast execution record/audit/outbox state:

- do not broadcast.

---

## 41. Future Extensions — Explicitly Not v1

Potential later work:

- Base/Arbitrum and chain-specific confirmation policies;
- cross-chain mission graphs;
- standardized mission/compensation SDK;
- KeeperHub MCP/marketplace integration;
- recoverability score for third-party agent actions;
- prebuilt adapters for Aave/Uniswap/vaults;
- mission receipt onchain anchoring;
- delegated recovery budgets;
- policy templates for DAOs/treasuries;
- external incident webhooks/PagerDuty-style integrations;
- x402 recovery-as-a-service;
- formal verification of mission state machines.

These must not delay the v1 core.

---

## 42. Final Product Acceptance Criteria

A production-ready v1 is accepted only if all of the following are true:

1. A human can create a versioned multi-step mission from the UI.
2. An authenticated agent can create/run a mission through an idempotent API.
3. Every real write is simulated first and executed through KeeperHub.
4. The simulated and broadcast economic request is cryptographically bound through Aether’s plan hash.
5. Every real write has an independent proof specification and verification result.
6. A known later-step failure after earlier confirmed effects causes mission degradation, not generic failure.
7. Aether can execute predeclared compensating transactions and independently prove a safe terminal state.
8. A deliberately lost provider response around a real Sepolia KeeperHub execution causes `OUTCOME_UNKNOWN`, locks resubmission, reconciles independently, and avoids duplicate execution.
9. No `COMPLETED` or `RECOVERED` mission exists with an unresolved critical invariant or unknown attempt.
10. Groq can explain an incident but cannot authorize or execute anything.
11. Groq outage/rate limiting does not corrupt or block deterministic safety logic.
12. Old GitHub desired-state/oracle product code and OpenAI integration are removed from active application code.
13. `docs/` contains only the existing `DESIGN.MD` after cleanup.
14. Root `README.md`, `PRD.MD`, and `AGENTS.MD` describe only the new Aether.
15. `/demo` supports happy path, partial-failure recovery, and unknown-outcome reconciliation using the production runtime.
16. Live demo writes are real Sepolia transactions with visible transaction evidence.
17. No live transaction can be broadcast by ordinary test/build commands.
18. All relevant quality, security, accessibility, integration, worker-recovery, contract, and production-build gates pass.

---

# Product Summary

**Aether is not a protocol drift monitor.**  
**Aether is not GitOps for smart contracts.**  
**Aether is not an AI that improvises with a wallet.**

Aether is the **mission-level reliability layer above KeeperHub**.

It gives autonomous onchain agents a durable answer to the hardest question in multi-step execution:

> **When reality diverges halfway through, what actually happened, and how do we get safely home without doing the same economic action twice?**

The product loop is:

> **Define → Execute → Observe → Reconcile → Recover → Prove**

That loop — not any individual protocol integration — is the product.
