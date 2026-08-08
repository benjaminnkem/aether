# AGENTS.MD — Aether Engineering Rules

This file is mandatory reading for every coding agent, sub-agent, reviewer, and automation working in this repository.

## 1. Read Order Before Editing

Before changing code, read these files completely:

1. `AGENTS.MD`
2. `PRD.MD`
3. `docs/DESIGN.MD`
4. root `README.md`
5. relevant package/app configuration and existing tests

Do not start implementation from memory of the old Aether product.

## 2. What Aether Is Now

Aether is **mission control for autonomous onchain agents**.

It provides recoverable execution semantics above KeeperHub:

> Define → Execute → Observe → Reconcile → Recover → Prove

The central product problem is multi-step missions that partially succeed. Aether checkpoints real effects, treats ambiguous outcomes as `UNKNOWN`, prevents unsafe duplicate writes, uses pre-authorized compensating transactions to restore a safe state, and independently verifies the terminal result.

KeeperHub is the transaction execution provider. Aether must not rebuild KeeperHub.

## 3. Source-of-Truth Rules

- `PRD.MD` is authoritative for product behavior, domain semantics, security boundaries, API expectations, data model intent, state machines, demo behavior, and acceptance criteria.
- `docs/DESIGN.MD` is authoritative for visual design, tokens, typography, layout language, component styling, spacing, responsiveness, and motion.
- If visual behavior appears underspecified in the PRD, follow `docs/DESIGN.MD` rather than inventing a new design system.
- If old code/docs conflict with the PRD, the old code/docs are obsolete.

## 4. Hard Product Boundaries

### 4.1 Remove the old product completely

The old GitHub-backed desired-state/oracle-drift product must not survive as a hidden compatibility layer.

Remove product code, routes, schemas, jobs, tests, copy, config, and dependencies used only for:

- GitHub App/installations;
- desired-state YAML;
- repository provenance/resource mapping;
- oracle drift/freshness;
- protocol alignment/health;
- old correction-operation domain;
- OpenAI provider integration.

Do not leave dead files “for reference.” Git history is the reference.

### 4.2 Documentation hygiene

Inside `docs/`, keep only `docs/DESIGN.MD`.

Delete other existing Markdown docs that describe the old Aether.

The intended root docs are:

- `README.md`
- `PRD.MD`
- `AGENTS.MD`
- `docs/DESIGN.MD`

Do not delete license/security/legal Markdown files merely because they are Markdown.

### 4.3 No OpenAI runtime

Aether uses GroqCloud through the native `groq-sdk`.

Default model: `llama-3.3-70b-versatile`.

Remove `OPENAI_API_KEY`, OpenAI client code, OpenAI-specific health checks, and OpenAI package dependencies if unused elsewhere.

### 4.4 AI has zero financial authority

Groq may summarize/investigate and return a locally schema-validated advisory result.

Groq must never:

- broadcast transactions;
- receive KeeperHub/wallet secrets;
- approve actions;
- modify authority;
- generate unrestricted calldata/recipients/amounts;
- override invariant failures;
- decide that an unknown outcome is safe to replay.

Deterministic code owns all authority decisions.

## 5. Blockchain Safety Rules

These rules are non-negotiable.

1. Launch writes are Ethereum Sepolia only (`11155111`).
2. Every production-path write goes through KeeperHub Direct Execution.
3. Every supported write is simulated before broadcast.
4. Persist the operation/attempt before the potentially broadcasting external call.
5. Bind simulation, policy, approval, and execution to an immutable plan hash.
6. Use a unique KeeperHub `Idempotency-Key` per logical operation generation.
7. Maintain Aether-level idempotency permanently; do not rely only on provider replay windows.
8. Never blindly resubmit an economically meaningful action whose outcome may be unknown.
9. `UNKNOWN` is a valid state and must remain visible.
10. Independently verify effects with RPC evidence before marking steps verified.
11. `COMPLETED` and `RECOVERED` require passing critical terminal invariants.
12. Finalized transactions are never described as rolled back. Use compensating/recovery transactions.
13. Recovery actions must be predeclared or produced by trusted deterministic adapters.
14. If evidence is insufficient, fail closed into `NEEDS_ATTENTION`.
15. Never use JavaScript `number` for token amounts/wei. Use validated strings/`bigint`.

## 6. Retry Classes

Every write step must explicitly declare one of:

- `SEMANTICALLY_IDEMPOTENT`
- `PROVABLE_EFFECT`
- `NON_REPLAYABLE`

A step without retry classification is invalid.

For `NON_REPLAYABLE`, unknown outcome means no automatic resubmission unless independent evidence proves the original did not execute and the policy explicitly permits a new attempt.

## 7. State-Machine Discipline

Mission and step state transitions must be centralized and validated.

Do not scatter direct state assignments through controllers/workers.

Never allow shortcuts such as:

- `EXECUTING -> COMPLETED` without verification;
- `RECONCILING -> EXECUTING` without a reconciliation resolution;
- `RECOVERING -> RECOVERED` without independent verification;
- changing an approved plan in place.

Use optimistic concurrency/CAS/fencing so stale workers cannot overwrite newer reality.

## 8. External-Call Discipline

For KeeperHub, Groq, RPC, email/webhook, or any other provider:

- set explicit timeouts;
- normalize errors;
- redact secrets;
- use bounded retries only when safe;
- honor provider retry/rate-limit hints where available;
- do not make network calls inside database transactions;
- persist enough durable state before calls to recover after crashes.

A network error is not proof of non-execution.

## 9. Data Integrity

Use the existing MongoDB replica-set transaction + durable outbox architecture unless repository inspection identifies a concrete correctness issue.

Critical state mutation plus outbox scheduling must be atomic where required.

Immutable product records should be append-only at the application layer:

- mission versions;
- operation plans;
- simulation records;
- observations;
- approval decisions;
- final receipts;
- audit events.

Audit persistence is part of the execution safety boundary. If the required pre-broadcast audit/state record cannot be committed, do not broadcast.

## 10. Groq Integration Rules

Use native `groq-sdk`.

Use `GROQ_API_KEY` only on the server.

Default `GROQ_MODEL=llama-3.3-70b-versatile`, configurable through an allowlist.

Prefer JSON Object Mode for advisory responses and validate with a strict local schema (e.g. Zod). Never trust model output because it is valid JSON.

Required handling:

- 429 + `Retry-After`;
- timeouts;
- 5xx;
- malformed/schema-invalid output;
- circuit breaker after repeated failure;
- no fabricated fallback analysis.

Groq failure must never prevent deterministic safe recovery when enough non-AI evidence exists.

## 11. UI Rules

Read `docs/DESIGN.MD` before touching UI.

Do not create a new visual system.

Primary routes are centered on:

- Overview
- Missions
- Mission run flight recorder
- Approvals
- Audit
- Settings
- Demo

Do not restore protocol setup, GitHub repository setup, desired-state, drift, oracle health, or alignment UI.

Use plain operational language:

- Mission
- Expected state
- Observed state
- Outcome unknown
- Retry locked
- Recovering
- Recovered
- Needs attention

Do not hide important state in decorative dashboards.

## 12. Demo Rules

`/demo` must use the production mission engine.

Demo fault injection is permitted only to reproduce controlled failure conditions around real Sepolia/KeeperHub execution.

It must never:

- fabricate transaction hashes;
- fabricate receipts;
- bypass persistence;
- bypass policy;
- bypass verification;
- expose arbitrary calldata/addresses;
- allow unbounded public spending.

Support:

1. happy path;
2. partial failure + compensation;
3. lost response / unknown outcome reconciliation.

A replay mode is allowed only if explicitly labeled as a replay of a previously verified Sepolia run.

## 13. Security Rules

- Never commit secrets.
- Never log authorization headers, cookies, API keys, private keys, or unredacted provider credentials.
- All tenant context comes from authenticated server-side identity, not browser-persisted IDs.
- Mutation endpoints require authorization and idempotency.
- Browser cookie mutations require CSRF defense.
- API keys are hashed at rest and shown once.
- Stored integration credentials are encrypted at rest.
- Validate chain ID at every relevant boundary.
- Restrict demo to fixed scenarios/amounts.
- Treat chain metadata/revert strings as untrusted text when sent to AI.
- No arbitrary outbound URL tools in the AI layer.

## 14. Code Quality Rules

- Prefer typed domain objects over dictionaries/`any`.
- No `any` on safety-critical boundaries without an explicit validated narrowing step.
- Centralize canonical hashing/serialization.
- No floating-point token arithmetic.
- Use exhaustive switches for state enums and disposition enums.
- Avoid duplicated business rules across API and workers; put them in domain/application services.
- External adapters implement interfaces; domain logic must be testable without live providers.
- Remove unused dependencies and dead exports.
- Do not leave TODOs/placeholders on required PRD paths.
- Do not keep old code commented out.
- No “temporary legacy fallback.”

## 15. Required Test Mindset

Before declaring a feature done, ask what happens if the process dies at every external-call boundary.

At minimum test:

- duplicate HTTP requests;
- duplicate queue deliveries;
- stale workers;
- provider timeout after possible broadcast;
- provider success but chain postcondition failure;
- chain receipt but provider says failure;
- RPC provider disagreement;
- reorg before confirmation threshold;
- Groq 429/outage/malformed JSON;
- approval expires after simulation;
- state changes after approval;
- recovery itself partially fails;
- application restarts while `SUBMITTING` or `RECONCILING`.

## 16. Live-Transaction Guard

Normal unit/integration/E2E/build commands must never broadcast a transaction.

Live Sepolia tests require an explicit opt-in environment flag and should be clearly named.

If a command can broadcast, its name/help/output must make that obvious.

## 17. Repository Rewrite Workflow

When implementing this pivot:

1. inventory the repository before deleting anything;
2. identify reusable infrastructure vs old domain code;
3. build new mission primitives with tests;
4. port the proven KeeperHub/reconciliation mechanics into the new model;
5. build deterministic recovery;
6. replace OpenAI with Groq;
7. replace old UI routes;
8. build `/demo`;
9. remove old dependencies/config/data migrations/docs;
10. search for legacy terms and dead imports;
11. run every relevant repo quality gate;
12. run opt-in live acceptance only when explicitly configured;
13. report exactly what changed, what was deleted, test results, and any genuine external blockers.

Do not ask to preserve legacy behavior that conflicts with `PRD.MD`.

## 18. Definition of Done for Any PR

A change is done only when:

- behavior matches `PRD.MD`;
- visuals match `docs/DESIGN.MD`;
- tenant/security boundaries are preserved;
- state transitions are valid;
- failure/retry semantics are tested;
- no new secret exposure exists;
- types/lint/tests/build pass for affected packages;
- no obsolete old-Aether code is reintroduced;
- documentation is updated only where allowed;
- no live transaction occurred from ordinary validation commands.

## 19. Final Reminder

The product is not “AI + blockchain automation.”

The product is trustworthy mission semantics around irreversible actions.

When uncertain, choose the implementation that preserves this promise:

> **Aether knows what the agent intended, knows what actually happened, never blindly duplicates an uncertain economic action, and either completes the mission or proves it restored an authorized safe state.**
