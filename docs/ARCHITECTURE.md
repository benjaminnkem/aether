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
