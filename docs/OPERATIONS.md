# Operations

Start local infrastructure with `docker compose up -d`, then start API and worker with
`pnpm dev`. MongoDB must report replica-set primary health before mutations because
state, audit, and outbox writes share transactions. The API health endpoint is
`GET /v1/health`; Swagger is `/v1/docs`.

The operation lifecycle is: observe → drift evaluation → immutable plan → deterministic
policy → exact simulation → bound approval → KeeperHub submit → reconciliation/finality
→ independent postcondition verification → audit.

Outbox publication runs in the worker once per second. BullMQ uses stable job IDs,
bounded exponential retry, retained failed-job visibility, and concurrency one for
submission. Redis loss delays work but does not lose canonical intent. Restarting the
worker republishes unmarked outbox events safely.

Operational response by state:

- `unknown` or `reconciling`: automatic submit retry is locked. Check KeeperHub using
  the persisted provider correlation and compare independent RPC evidence.
- `partial`: the write confirmed but verification failed. Create/inspect the linked
  forward-correction operation; never describe this as rollback.
- `failed`: no ambiguous write is assumed. Inspect simulation/provider evidence and
  failed BullMQ job history before retry.
- `verified`: independent oracle postcondition and confirmation threshold passed.

Provider health is `healthy`, `degraded`, or `unavailable` with latency, consecutive
failure count, and a rate-limit-until timestamp when applicable. For KeeperHub 429s,
honor `Retry-After`; do not bypass the bounded provider retry. If an uncertain
submission has no external execution ID, keep the submit retry locked and reconcile
manually with the persisted Aether correlation. Never create a second idempotency key
for the same plan.

KeeperHub step logs are untrusted evidence and are schema-validated/redacted before
persistence. Use the independently observed RPC receipt/log/block evidence for
postconditions. OpenAI outages degrade only advisory analysis and never block
deterministic investigation, policy, approval, execution, or verification.

Shutdown uses Nest lifecycle hooks to close workers, queues, and Redis. Back up MongoDB
as the canonical operational and audit store; Redis queue data alone is insufficient
for recovery.

## Local chain lifecycle

Start Anvil without exporting or copying its development keys:

```bash
anvil --chain-id 31337
```

In another shell, select Anvil's public account addresses for the four fixture roles,
then deploy using `forge script ... --unlocked --sender <public-address> --broadcast`.
Set `AETHER_RECORD_DEPLOYMENT=true` only for the deployment transaction so
`deployments/31337.json` is refreshed. Run the scripts in this order:

1. `SeedFreshness.s.sol` as the fixture admin.
2. `CreateUnauthorizedOracleDrift.s.sol` as the drift actor.
3. `SimulateMissingRole.s.sol` without broadcast.
4. `RestoreApprovedOracle.s.sol` as the executor.
5. `CreatePostWriteVerificationFailure.s.sol` as the fixture admin.
6. `ForwardCorrectFreshness.s.sol` as the fixture admin.

The fifth step deliberately makes the corrected oracle stale. The sixth is a new
forward write that restores freshness; it does not undo or claim to roll back the
confirmed oracle-pointer transaction.

Base Sepolia (`84532`) uses the same deployment and lifecycle scripts with an
operator-managed RPC and Foundry keystore or hardware wallet. First run without
`--broadcast`, review the exact transactions, then broadcast from authorized role
accounts. Never use chain ID 1 or record an artifact from a simulation-only run.
