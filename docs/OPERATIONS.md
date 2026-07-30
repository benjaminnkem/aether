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

Shutdown uses Nest lifecycle hooks to close workers, queues, and Redis. Back up MongoDB
as the canonical operational and audit store; Redis queue data alone is insufficient
for recovery.
