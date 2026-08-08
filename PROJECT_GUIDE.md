# Aether, Explained Simply

This guide explains what Aether does, what the records and states mean, and how to test it safely. It is intentionally simpler than `PRD.MD`.

## The one-minute explanation

Imagine a delivery robot has three chores:

1. take a box out of room A;
2. unlock room B;
3. put the box in room B.

If chore 3 fails, the robot cannot pretend chores 1 and 2 never happened. The box is already out of room A and room B may still be unlocked.

Aether is the supervisor holding the checklist. It writes down the intended chores, records each completed chore, checks the real result independently, and follows a pre-approved return plan when the whole job cannot finish.

For blockchain work, the chores are transactions. Final transactions cannot be erased. Aether therefore uses new recovery transactions to reach an approved safe state.

## The six-part loop

| Part      | Plain meaning                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Define    | Freeze the mission, steps, limits, proofs, and recovery rules.                                        |
| Execute   | Simulate and then ask KeeperHub to submit one exact write.                                            |
| Observe   | Read Sepolia through two RPC providers instead of trusting only KeeperHub.                            |
| Reconcile | If a response is lost, find out whether the original write landed before considering another attempt. |
| Recover   | Execute only the recovery actions declared in the frozen mission version.                             |
| Prove     | Produce a final receipt only after critical checks pass.                                              |

## Who does what

### Aether

Aether owns the mission checklist, state transitions, durable records, retry lock, policy checks, approvals, reconciliation, recovery order, independent verification, audit trail, and final receipt.

### KeeperHub

KeeperHub owns transaction simulation and submission. Aether does not manage a wallet or reproduce KeeperHub's transaction service. Every supported production-path write goes through KeeperHub Direct Execution.

### Sepolia RPC providers

The two RPC providers are independent witnesses. Aether checks chain ID, receipts, logs, contract reads, balances, allowances, confirmations, and canonical block evidence. If the providers materially disagree, the result is `UNKNOWN`.

### MongoDB

MongoDB is the notebook that survives browser disconnects and API restarts. It stores checkpoints, immutable evidence, leases, fencing tokens, and the next time a run should continue.

There is no Redis, BullMQ, worker service, or task queue. The API advances runs immediately. A Mongo-backed runner resumes unfinished work.

### Groq

Groq may write an optional incident summary from a small, sanitized evidence set. It receives no wallet, KeeperHub secret, private key, unrestricted transaction data, or execution tool. Its output cannot approve or submit anything. Recovery continues when the summary is unavailable.

## The main records

| Record             | What it means                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Workspace          | One tenant and security boundary. Users, roles, keys, missions, and integrations belong to it. |
| Mission            | The named long-lived job definition.                                                           |
| MissionVersion     | One frozen version of the mission. Existing runs never change when a new version is created.   |
| MissionRun         | One attempt to carry out one exact mission version.                                            |
| MissionStepRun     | The checkpoint for one step inside a run.                                                      |
| OperationPlan      | The exact economic request, expected proof, and hashes for one forward or recovery write.      |
| SimulationRecord   | KeeperHub's evidence about what the exact write would do without broadcasting it.              |
| ExecutionAttempt   | The durable record created before a potentially broadcasting call.                             |
| Observation        | Immutable evidence read independently from Sepolia.                                            |
| ReconciliationCase | The investigation used when Aether cannot initially tell whether a write landed.               |
| RecoveryPlan       | The frozen list of allowed compensating actions and target safe state.                         |
| ApprovalRecord     | A human decision bound to one exact plan hash and expiry time.                                 |
| Investigation      | The optional Groq incident summary or a truthful unavailable record.                           |
| AuditEvent         | An append-only record of an important action or decision.                                      |
| TimelineEvent      | The numbered flight-recorder entry shown to the operator.                                      |
| MissionReceipt     | The final proof bundle for a completed or recovered run.                                       |

## Important identifiers and hashes

| Value                     | Meaning                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `workspaceId`             | Which tenant owns the record. Never accept this from the browser as authority.                      |
| `missionId`               | The stable mission identity.                                                                        |
| `missionVersionId`        | The exact frozen definition used by a run.                                                          |
| `runId`                   | One execution of a mission version.                                                                 |
| `stepRunId`               | One step checkpoint inside a run.                                                                   |
| `planId`                  | One immutable forward or recovery operation plan.                                                   |
| `executionAttemptId`      | One durable provider-call attempt.                                                                  |
| `keeperHubExecutionId`    | KeeperHub's identity for the submitted execution.                                                   |
| `transactionHash`         | The real Sepolia transaction identity.                                                              |
| `requestBodyHash`         | Hash of the canonical KeeperHub economic request.                                                   |
| `planHash`                | Hash binding the mission version, request, proof, and operation context. Approvals bind to this.    |
| `evidenceHash`            | Hash of the exact evidence set supplied for an incident summary.                                    |
| `receiptHash`             | Hash of the final mission receipt.                                                                  |
| `Idempotency-Key`         | Caller-provided mutation identity. Reusing it with different data returns a conflict.               |
| `keeperHubIdempotencyKey` | Unique key for one logical write generation at KeeperHub.                                           |
| `fencingToken`            | Increasing lease generation. An old API process cannot write after a newer process takes ownership. |
| `nextActionAt`            | Persisted time when the run should next poll or continue. It replaces queue delays and long sleeps. |
| `sequence`                | Increasing timeline number used for SSE reconnect and `Last-Event-ID`.                              |

Hashes prove that two pieces of data are the same; they do not hide secrets. Never place a private key or API key inside a plan, evidence record, audit event, or hash input intended for display.

## Mission states

| State                | Plain meaning                                                                       |
| -------------------- | ----------------------------------------------------------------------------------- |
| `DRAFT`              | The mission is still being written.                                                 |
| `READY`              | The frozen mission may be run.                                                      |
| `PREFLIGHT`          | Aether is checking policy, limits, and required configuration.                      |
| `EXECUTING`          | Forward steps are being processed.                                                  |
| `VERIFYING`          | Forward writes finished; final invariants are being checked.                        |
| `RECONCILING`        | Aether is determining what actually happened to an uncertain write.                 |
| `DEGRADED`           | The original objective cannot currently continue as planned.                        |
| `INVESTIGATING`      | The incident evidence is being recorded; Groq may optionally summarize it.          |
| `AWAITING_APPROVAL`  | An exact plan needs a human decision.                                               |
| `RECOVERING`         | Declared compensating actions are being processed.                                  |
| `VERIFYING_RECOVERY` | Recovery writes finished; the safe state is being independently checked.            |
| `PAUSED`             | Progress is safely paused. Read-only reconciliation may still be necessary.         |
| `COMPLETED`          | The original objective and all critical invariants passed.                          |
| `RECOVERED`          | The objective failed, but an authorized safe state was restored and proved.         |
| `NEEDS_ATTENTION`    | Aether cannot safely continue automatically. This is a truthful operational result. |
| `ABORTED_SAFE`       | The run stopped with no irreversible effect, or absence of effects was proved.      |

## Step states

| State                | Plain meaning                                                                         |
| -------------------- | ------------------------------------------------------------------------------------- |
| `PENDING`            | The step has not started.                                                             |
| `PRECONDITION_CHECK` | Aether is checking whether the step is currently allowed and relevant.                |
| `SIMULATING`         | KeeperHub is testing the exact request without broadcasting it.                       |
| `SIMULATION_FAILED`  | The simulated request failed or would revert; nothing was broadcast for this attempt. |
| `AWAITING_APPROVAL`  | The exact plan needs approval.                                                        |
| `READY_TO_SUBMIT`    | Simulation and policy checks passed.                                                  |
| `SUBMITTING`         | The attempt was durably recorded and its one provider call is in progress.            |
| `OUTCOME_UNKNOWN`    | The call may have broadcast, but Aether lacks a reliable acknowledgement.             |
| `RECONCILING`        | Provider and chain evidence are being checked; retry is locked.                       |
| `EXECUTED`           | A transaction was found, but its declared postcondition is not yet verified.          |
| `VERIFYING`          | Aether is checking the receipt and proof specification.                               |
| `VERIFIED`           | Independent evidence proves the forward step.                                         |
| `FAILED_KNOWN`       | Evidence proves a known failure.                                                      |
| `COMPENSATING`       | The declared recovery action for this step is in progress.                            |
| `COMPENSATED`        | Independent evidence proves the recovery action.                                      |
| `NEEDS_ATTENTION`    | This step cannot safely progress automatically.                                       |
| `SKIPPED`            | A declared rule proved that this step was unnecessary.                                |

## Retry classes

Every write must select one class:

- `SEMANTICALLY_IDEMPOTENT`: repeating the exact action cannot create an extra economic effect beyond the declared bounds.
- `PROVABLE_EFFECT`: the action may not be naturally repeat-safe, but a unique event or state proof can show whether it happened.
- `NON_REPLAYABLE`: do not automatically send another write after uncertainty unless absence is independently proved and policy explicitly permits it.

Missing retry class means the mission definition is invalid.

## Proof types

- `RECEIPT`: require a successful canonical receipt and the configured confirmation count.
- `EVENT`: require a matching event address, signature topic, and indexed values.
- `CONTRACT_READ`: call a fixed view function and compare its result using `EQ`, `NEQ`, `GTE`, or `LTE`.
- `ERC20_BALANCE`: compare an account's token balance.
- `ERC20_ALLOWANCE`: compare an owner's allowance for a spender.

KeeperHub saying `completed` is useful evidence, but it is not a proof by itself.

## Invariants

An invariant is a rule that must remain true. Each returns `PASS`, `FAIL`, or `UNKNOWN`.

- `CHAIN_ID`: both providers must report Sepolia chain ID `11155111`.
- `TARGET_ALLOWLIST`: every write target must be approved by the mission policy.
- `FUNCTION_ALLOWLIST`: every called function must be approved.
- `ERC20_BALANCE`: a balance must meet its declared comparison.
- `ERC20_ALLOWANCE`: an allowance must meet its declared comparison.
- `CONTRACT_READ`: a fixed view result must meet its comparison.
- `MAX_WRITES`: confirmed writes must stay within the declared count.
- `DEADLINE`: the run must remain within its declared time.
- `NO_UNKNOWN_ATTEMPTS`: no unresolved potentially broadcast write may remain.

Critical `UNKNOWN` results fail closed. `COMPLETED` and `RECOVERED` require all critical terminal invariants to pass.

## Reconciliation results

- `LANDED`: independent evidence proves the original write occurred. Do not resubmit it.
- `NOT_LANDED_SAFE_TO_RETRY`: the retry class and independent evidence prove a new attempt is permitted.
- `INDETERMINATE`: evidence is insufficient. Keep retry locked and require attention.

## Understanding an investigation record

Example fields:

- `workspaceId`: owner of the record.
- `investigationId`: unique incident-summary record.
- `runId`: run being described.
- `trigger`: why the summary was requested, currently `MISSION_DEGRADED`.
- `model`: configured Groq model ID.
- `promptVersion`: version of Aether's bounded summary request.
- `evidenceIds`: step checkpoints supplied as evidence.
- `evidenceHash`: fingerprint used for deduplication.
- `output.summary`: short operator explanation.
- `output.likelyCauses`: causes, supporting evidence IDs, and a display-only confidence from 0 to 1.
- `output.recommendedDisposition`: only `CONTINUE`, `RECOVER`, or `ESCALATE`. Deterministic code may ignore it.
- `output.operatorNotes`: practical facts for the operator.
- `output.uncertainty`: what the supplied evidence does not prove.
- `status`: `AVAILABLE` means locally validated output was stored; `UNAVAILABLE` means no summary was accepted.
- `failureCode`: safe reason such as `GROQ_OUTPUT_INVALID`, `GROQ_RATE_LIMITED`, `GROQ_TIMEOUT`, or `GROQ_UNAVAILABLE`.
- `providerStatus`: safe HTTP status when one exists.
- `latencyMs`: elapsed provider time in milliseconds.
- `createdAt` and `updatedAt`: UTC timestamps.

`Incident summary unavailable` is not a recovery failure. It means Aether refused to display missing or invalid commentary. The recovery engine still follows the frozen deterministic policy.

## Environment values

Never commit `.env`. Values ending in `_KEY`, `_SECRET`, `_PASSWORD`, or RPC URLs containing credentials are server-only.

| Variable                           | Meaning                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                      | MongoDB replica-set connection string and database.                                             |
| `AETHER_ACCESS_TOKEN_SECRET`       | Signs short browser access tokens.                                                              |
| `AETHER_REFRESH_TOKEN_SECRET`      | Signs refresh-session tokens.                                                                   |
| `AETHER_COOKIE_SECRET`             | Protects cookie-related state.                                                                  |
| `AETHER_CSRF_SECRET`               | Supports browser mutation CSRF defense.                                                         |
| `AETHER_CREDENTIAL_ENCRYPTION_KEY` | AES-GCM key used to encrypt stored integration secrets.                                         |
| `SEPOLIA_RPC_PRIMARY_URL`          | First independent Sepolia reader.                                                               |
| `SEPOLIA_RPC_SECONDARY_URL`        | Second independent Sepolia reader. Use a separate account/provider in production.               |
| `SEPOLIA_RPC_*_LOG_RANGE`          | Maximum configured log query range. Aether additionally enforces provider-safe bounded chunks.  |
| `AETHER_MIN_CONFIRMATIONS`         | Required confirmations before evidence is final enough for verification.                        |
| `KEEPERHUB_BASE_URL`               | KeeperHub API root.                                                                             |
| `KEEPERHUB_API_KEY`                | Server-only KeeperHub credential.                                                               |
| `GROQ_API_KEY`                     | Optional server-only Groq credential.                                                           |
| `GROQ_MODEL`                       | Explicit Groq model ID. No silent model replacement occurs.                                     |
| `GROQ_MODEL_ALLOWLIST`             | Comma-separated model IDs operators permit.                                                     |
| `GROQ_TIMEOUT_MS`                  | Maximum time for one Groq request.                                                              |
| `GROQ_MAX_COMPLETION_TOKENS`       | Maximum summary output budget.                                                                  |
| `DEMO_LIVE_EXECUTION_ENABLED`      | Enables the three fixed live scenarios.                                                         |
| `DEMO_VAULT_ADDRESS`               | Deployed fixed-purpose Sepolia demo vault.                                                      |
| `DEMO_FIXED_AMOUNT`                | Fixed demo accounting amount as a decimal string.                                               |
| `DEMO_MAX_AMOUNT`                  | Hard upper bound for that demo amount.                                                          |
| `DEMO_RUNS_PER_HOUR`               | Per-client public demo limit.                                                                   |
| `DEMO_GLOBAL_RUNS_PER_HOUR`        | Global public demo limit.                                                                       |
| `KEEPERHUB_EXECUTOR_ADDRESS`       | Expected KeeperHub executor permitted by the fixture contract.                                  |
| `LIVE_SEPOLIA_TESTS`               | Explicit guard required by live acceptance commands. Ordinary tests ignore it for broadcasting. |

Only variables intentionally beginning with `NEXT_PUBLIC_` may enter the browser bundle.

## Safe setup checks

These commands read configuration but do not broadcast:

```bash
pnpm env:doctor
pnpm keeperhub:doctor
pnpm chain:doctor
pnpm groq:doctor
```

The Groq doctor currently warns that `llama-3.3-70b-versatile` has an announced shutdown on August 16, 2026. Select and allowlist a supported replacement explicitly before that date; Aether will not silently change models.

## Test the three demos, one by one

Before live testing:

1. Rotate any key that was pasted into chat, logs, or screenshots.
2. Set `LIVE_SEPOLIA_TESTS=false` for normal development.
3. Set `DEMO_LIVE_EXECUTION_ENABLED=true` only when you intend to spend Sepolia gas.
4. Confirm both RPC doctors, KeeperHub doctor, the deployed vault address, executor address, and wallet funding.
5. Start `pnpm dev`, open `http://localhost:3000/demo`, and keep the flight recorder visible.

### Demo 1: happy path

1. Select **Happy path** and start one run.
2. Expect `withdraw`, `authorize`, and `deposit` in dependency order.
3. For every step, verify a plan, successful simulation, exactly one execution attempt, transaction link, independent observation, and `VERIFIED` state.
4. Expect the run to enter `VERIFYING`, then `COMPLETED`.
5. Open the final receipt. Confirm destination balance equals the fixed amount, transit balance is zero, no unknown attempt remains, and every transaction is real on Sepolia.

### Demo 2: partial failure and recovery

1. Select **Partial failure + compensation** and start a new run.
2. Confirm `withdraw` and `authorize` each execute once and become `VERIFIED`.
3. The `blocked` step must fail during simulation. No blocked-step transaction should exist.
4. Expect `DEGRADED`, then `INVESTIGATING`. An optional Groq summary may appear, but recovery must not wait for it.
5. Inspect the immutable recovery plan. It should revoke authorization and restore the source in reverse dependency order.
6. Confirm both recovery writes are simulated, submitted through KeeperHub, and independently verified.
7. Expect `VERIFYING_RECOVERY`, then `RECOVERED`.
8. In the final receipt, confirm source balance is restored, transit is empty, authorization is false, and no unknown attempt remains.

### Demo 3: unknown outcome

1. Select **Unknown outcome** and start a new run.
2. The demo discards the acknowledgement only after the real KeeperHub call returns.
3. Expect `OUTCOME_UNKNOWN`, `resubmissionLocked=true`, and `RECONCILING`.
4. Confirm the timeline never creates a second attempt for the same generation.
5. Wait for both RPC providers to find the unique event and canonical receipt.
6. Expect `LANDED`, “original write landed,” continuation without resubmission, and final completion.
7. Confirm the fixture action counter is `1` and duplicate action count is `0`.

Do not reuse an old failed demo record to judge a new build. Records are evidence and should not be edited into success. Start a fresh run after a runtime fix.

## Test the authenticated product

### 1. Create the workspace

1. Open `/signup` and create a user.
2. Complete `/onboarding` to create a workspace.
3. Confirm `/app/overview` loads using the server-derived session workspace.

### 2. Configure execution and policy

1. Open `/app/settings/integrations`.
2. store and validate a KeeperHub key; confirm the UI never reads it back.
3. Open `/app/settings/policy` and set chain, write-count, value, approval, and emergency-pause limits.
4. Keep Sepolia (`11155111`) as the only allowed write chain.

### 3. Create a mission

1. Open `/app/missions/new`.
2. Define an objective, ordered steps, dependencies, exact actions, retry classes, proof specifications, critical invariants, target/function allowlists, recovery rules, and budgets.
3. Use decimal strings for wei and token amounts, for example `"1000000000000000000"`; never use `1.0`.
4. Save it. Confirm the mission has an immutable active version and content hash.

### 4. Run and observe

1. Open the mission and start a run with a fresh idempotency key.
2. Watch `/app/runs/:runId`. Closing the browser must not cancel the run.
3. Reopen the run and confirm missed timeline entries replay before live SSE entries.
4. Inspect plan hash, simulation, execution attempt, KeeperHub identity, transaction, independent observation, and invariants for every step.

### 5. Test approval binding

1. Disable automatic approval for forward or recovery writes in the mission policy.
2. Start a fresh run and wait for `AWAITING_APPROVAL`.
3. Open `/app/approvals/:approvalId` and compare the exact plan hash and simulation.
4. Approve or deny it. An expired approval or changed plan must not broadcast.

### 6. Test pause and cancellation

1. Pause only at a safe checkpoint.
2. Resume and confirm current state is checked again.
3. Cancel before the first write and expect `ABORTED_SAFE`.
4. Cancellation after a confirmed effect must pursue declared safe recovery rather than pretending the effect disappeared.

### 7. Test an agent API key

1. Open `/app/settings/api-keys` as workspace owner.
2. Create a key with only the required scopes: `missions:read`, `missions:create`, `runs:create`, `runs:read`, and/or `receipts:read`.
3. Copy the `aeth_` plaintext once. Only its prefix and Argon2id hash remain stored.
4. Call the API with `Authorization: Bearer aeth_...` and a fresh `Idempotency-Key` for every mutation.
5. Reuse the same key with the same payload and confirm the same result returns. Reuse it with different data and expect `409 IDEMPOTENCY_CONFLICT`.
6. Revoke the API key and confirm later requests fail.

Example run request:

```bash
curl -N \
  -X POST "http://localhost:4000/v1/missions/MISSION_ID/runs" \
  -H "Authorization: Bearer aeth_REPLACE_ME" \
  -H "Idempotency-Key: run-$(date +%s)" \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  --data '{"input":{}}'
```

Reconnect after a disconnect:

```bash
curl -N \
  "http://localhost:4000/v1/runs/RUN_ID/stream?after=LAST_SEQUENCE" \
  -H "Authorization: Bearer aeth_REPLACE_ME" \
  -H "Last-Event-ID: LAST_SEQUENCE"
```

### 8. Inspect proof and audit

1. Open `/app/audit` and confirm every important mutation is workspace-bound and secret-redacted.
2. Fetch `/v1/runs/:runId/timeline` and confirm sequence numbers are continuous.
3. Fetch `/v1/runs/:runId/receipt` only after `COMPLETED` or `RECOVERED`.
4. Compare transaction hashes with Sepolia and check the receipt hash is stable.

## Automated checks

Normal checks cannot broadcast:

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm test:integration
pnpm test:security
pnpm --filter @aether/contracts test
pnpm test:accessibility
pnpm test:visual
pnpm test:e2e
pnpm build
pnpm audit --prod
```

The explicitly named live acceptance command may broadcast when correctly configured:

```bash
LIVE_SEPOLIA_TESTS=true pnpm test:live:sepolia
```

## Should we build a separate agent to exercise Aether?

Yes. It is the best way to prove that Aether is usable as infrastructure rather than only through its own UI.

Build a small **Sepolia treasury balancer** as a separate example package or repository. It should be independent of Aether's internal code and use only the public agent API and SSE stream.

Suggested behavior:

1. Read two fixed test vault balances.
2. When one falls below a fixed threshold, choose a pre-created, allowlisted mission template.
3. Ask Aether to create a run using an `aeth_` key with minimal scopes.
4. Stream the run timeline.
5. Stop on approval, `NEEDS_ATTENTION`, or an unresolved unknown outcome.
6. Read the final receipt and report the proved terminal state.

The separate agent must not hold the KeeperHub key, private key, or arbitrary calldata. It should not write directly to Sepolia. That separation proves the intended contract: the caller chooses an approved mission, Aether enforces durable mission safety, and KeeperHub submits the writes.

Test the external agent against four cases:

- normal completion;
- partial failure followed by recovery;
- lost acknowledgement with no duplicate write;
- expired or insufficient agent scope.

Keep this as an acceptance client, not another execution system. If it starts managing wallets, retrying transactions, or deciding recovery outside Aether, it is testing the wrong boundary.

## Final safety checklist

- Never paste or commit a private key.
- Rotate any credential exposed in chat or terminal history.
- Use two genuinely independent RPC providers in production.
- Keep demo addresses, amounts, scenarios, and hourly caps server-controlled.
- Keep `LIVE_SEPOLIA_TESTS=false` except during an intentional live command.
- A provider timeout is not proof that no transaction exists.
- Never manually clear an unknown-outcome retry lock without independent evidence.
- Never call a run completed because KeeperHub returned success.
- Never describe compensation as erasing or rolling back a finalized transaction.
