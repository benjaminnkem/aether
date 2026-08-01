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
                   RPC / simulation / KeeperHub / GitHub / optional OpenAI adapters
                                         |
                 ArcadiaMarket ERC-1967 proxy + timestamp oracle fixtures
```

`apps/api` is a NestJS HTTP service. It preserves the browser contract, exposes
Swagger at `/v1/docs` and `/v1/openapi.json`, enforces authenticated tenant context
and contextual roles, writes mutation audit/outbox records transactionally, and
serves tenant-safe resumable SSE from durable outbox sequence numbers.

`apps/worker` is a standalone NestJS application context. It owns the eight queues
from the system architecture, publishes unpublished outbox records to BullMQ, and
processes simulation, submit, reconciliation, and verification. Consumers use stable
job IDs and durable execution state. An uncertain submit never throws into automatic
submit retry; it becomes `unknown`, takes the retry lock, and enqueues reconciliation.
KeeperHub correlation is persisted before submission. Direct execution IDs,
transaction correlations, and redacted step logs are persisted before independent RPC
verification. The shared provider runtime enforces timeouts, bounded retry only for
read/idempotent calls, `Retry-After`, redacted telemetry, and health state.

`packages/backend` owns server-only provider schemas, queue envelopes, deterministic
execution policy, canonical hashing, redaction, and Mongoose model definitions. The
browser-safe payload source of truth remains `packages/shared`.

`packages/shared/src/chains.ts` is the single TypeScript registry for Anvil `31337`
and Ethereum Sepolia `11155111`. It exposes browser-safe labels/explorer metadata;
backend startup and execution policy remain authoritative. Ethereum mainnet `1` and
the historical Base Sepolia target are rejected. Solidity deployment scripts mirror
the supported IDs because Solidity cannot import the TypeScript registry.

MongoDB collections implement the architecture inventory and carry compound tenant
indexes. Execution intent, provider correlation, state transitions, audit evidence,
and outbox events are durable. MongoDB transactions require a replica set. Redis is
transport, not canonical state.

The UI selects one organization and protocol at a time, while every protected query
revalidates persisted membership and every scoped record/job carries both identifiers.

`packages/contracts` contains only the chain fixture needed to prove this lifecycle.
`ArcadiaMarket` holds an oracle pointer behind an ERC-1967 proxy, requires
`ORACLE_ADMIN_ROLE` for `setOracle(address)`, rejects non-contract oracle addresses,
exposes a separate testnet-only `DRIFT_FIXTURE_ROLE` path, and exposes
`oracleStatus()` with the source timestamp and freshness result.
`MockOracle` is timestamp-only and has no price, custody, governance, or token logic.

Foundry generates the ABI, selectors, and deployment registry into
`packages/contracts/artifacts/server`. Only the server-side backend package imports
that export. The browser contract remains `packages/shared` and `packages/sdk`, so
browser bundles never import server artifacts.

Live verification is receipt-aware and block-pinned. It confirms the receipt is
canonical after the configured finality threshold, rereads `oracleStatus()` at a
specific block, and requires the desired address plus freshness. A missing receipt is
an unknown outcome, not permission to resubmit. A confirmed pointer write with a stale
source becomes partial and requires a new forward-correction operation.

GitHub is read-only and validates repository, release, commit, and pull-request
provenance. The OpenAI boundary accepts only evidence and allowlists and returns a
strict schema-validated advisory summary/typed suggestion; deterministic code still
builds calldata, authorizes, approves, executes, and verifies.
