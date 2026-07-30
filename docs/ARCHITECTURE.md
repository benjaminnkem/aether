# Architecture

The reduced MVP now has three deployable processes:

```text
apps/web -> @aether/sdk -> apps/api -> MongoDB replica set
                                  |
                                  +-> transactional outbox
                                         |
                                         v
                                  apps/worker -> BullMQ/Redis
                                         |
                          RPC / simulation / KeeperHub / GitHub adapters
                                         |
                 ArcadiaMarket ERC-1967 proxy + timestamp oracle fixtures
```

`apps/api` is a NestJS HTTP service. It preserves the browser contract, exposes
Swagger at `/v1/docs` and `/v1/openapi.json`, enforces authenticated tenant context
and contextual roles, writes mutation audit/outbox records transactionally, and
serves tenant-safe resumable SSE from durable outbox sequence numbers.

`apps/worker` is a standalone NestJS application context. It owns the seven queues
from the system architecture, publishes unpublished outbox records to BullMQ, and
processes simulation, submit, reconciliation, and verification. Consumers use stable
job IDs and durable execution state. An uncertain submit never throws into automatic
submit retry; it becomes `unknown`, takes the retry lock, and enqueues reconciliation.

`packages/backend` owns server-only provider schemas, queue envelopes, deterministic
execution policy, canonical hashing, redaction, and Mongoose model definitions. The
browser-safe payload source of truth remains `packages/shared`.

MongoDB collections implement the architecture inventory and carry compound tenant
indexes. Execution intent, provider correlation, state transitions, audit evidence,
and outbox events are durable. MongoDB transactions require a replica set. Redis is
transport, not canonical state.

The retained MVP is deliberately one organization and one protocol, but every
protocol-scoped record, query, event, and job retains both tenant identifiers.

`packages/contracts` contains only the chain fixture needed to prove this lifecycle.
`ArcadiaMarket` holds an oracle pointer behind an ERC-1967 proxy, requires
`ORACLE_ADMIN_ROLE` for `setOracle(address)`, rejects non-contract oracle addresses,
and exposes `oracleStatus()` with the source timestamp and freshness result.
`MockOracle` is timestamp-only and has no price, custody, governance, or token logic.

Foundry generates the ABI, selectors, and deployment registry into
`packages/contracts/artifacts/server`. Only the server-side backend package imports
that export. The browser contract remains `packages/shared` and `packages/sdk`, so
mock/API switching still requires no component changes.

Live verification is receipt-aware and block-pinned. It confirms the receipt is
canonical after the configured finality threshold, rereads `oracleStatus()` at a
specific block, and requires the desired address plus freshness. A missing receipt is
an unknown outcome, not permission to resubmit. A confirmed pointer write with a stale
source becomes partial and requires a new forward-correction operation.
