# Aether Production Readiness

## Current verdict

Aether is `LOCAL INTEGRATION READY`, but it is not yet proven as a live testnet product.

The current documents describe:

- a real Next.js → NestJS → MongoDB/Redis/worker architecture;
- durable outbox records, stable queue job IDs, reconciliation locks, deterministic policy checks, and independent RPC verification;
- a tested local Anvil contract lifecycle;
- typed live-provider boundaries.

The runtime mock modes, deterministic product scenarios, seeded identities, and demo
controls have been removed. Remaining blockers are:

- Base Sepolia was not broadcast;
- real KeeperHub execution, GitHub App installation, correct RPC, and OpenAI acceptance were not completed;
- protected live Playwright acceptance did not run; local desktop/mobile smoke passed;
- the contracts are unaudited fixtures and are not suitable for mainnet.

The next target is a **live-testnet release candidate**, not mainnet.

## Release tiers

### Tier 0 — Prototype

Any runtime mock transport, fake state machine, fake provider response, fake identity, fake transaction, or fake drift.

### Tier 1 — Local integration

Real frontend, API, worker, MongoDB replica set, Redis, BullMQ, native authentication, and Anvil contracts. External providers may be unavailable, but the system must fail explicitly rather than fall back to mocks.

### Tier 2 — Live testnet release candidate

All Tier 1 requirements plus:

- Base Sepolia fixture contracts deployed;
- real RPC reads;
- real GitHub provenance;
- real OpenAI structured advisory output;
- real KeeperHub simulation;
- real KeeperHub transaction submission;
- real transaction hash and explorer link;
- independent post-finality verification;
- complete audit correlation;
- full Playwright suite passing;
- restart/recovery and unknown-outcome tests passing;
- no runtime mock packages or mode switches.

### Tier 3 — Mainnet-capable product

Not part of the current task. Requires at minimum:

- independent contract and application security audits;
- hardened wallet/Safe/governance authority integration;
- threat modelling and penetration testing;
- formal operational ownership and incident response;
- staged limits and canary deployment;
- production identity/email infrastructure;
- backups and disaster-recovery exercises;
- monitoring and alerting;
- legal/compliance review where applicable.

## Live-testnet release gates

Aether may be called “live testnet ready” only if every gate passes.

### Runtime gate

- `NEXT_PUBLIC_AETHER_DATA_MODE` no longer exists.
- `AETHER_PROVIDER_MODE` no longer exists.
- `packages/mock-data` is removed from runtime dependencies.
- MSW is test-only.
- Demo controls and scenario endpoints are removed.
- No default data is fabricated for an empty database.
- Missing provider credentials cause a clear unhealthy/not-configured state.

### Authentication gate

- Signup, login, logout, refresh-token rotation, session revocation, and password reset are real.
- Passwords use Argon2id.
- Refresh tokens are hashed at rest and rotated.
- Browser tokens use Secure, HttpOnly, SameSite cookies.
- CSRF protection exists for cookie-authenticated mutations.
- Rate limits exist for authentication endpoints.
- Tenant context comes from authenticated membership, not fixed environment IDs.
- The fixed `org-arcadia` and `arcadia` runtime assumptions are removed.

### Persistence gate

- MongoDB replica-set transactions are used for canonical state/audit/outbox mutation boundaries.
- Redis is transport only.
- Restarting API/worker does not reset product state.
- Outbox recovery and idempotent queue processing are demonstrated.

### Integration gate

- KeeperHub organization key is real and begins with `kh_`.
- KeeperHub wallet is configured and funded with Base Sepolia ETH.
- `GET /api/chains` confirms Base Sepolia is enabled and testnet.
- Exact `setOracle(address)` request is simulated with `simulate: true`.
- The exact same body is submitted once with `Idempotency-Key`.
- The returned execution ID is persisted before further processing.
- Status polling honors KeeperHub’s poll hint.
- Transaction hash and link are persisted.
- Independent RPC verification confirms finality, canonical receipt, desired oracle, and freshness.
- GitHub App installation or other explicitly approved live read-only GitHub credential is used.
- OpenAI structured output is live and advisory-only.
- Provider failures never silently switch to deterministic data.

### Chain gate

- Contracts are deployed to Base Sepolia chain ID `84532`.
- Deployment artifact records the real chain, block, transaction hashes, deployer, contract addresses, and commit.
- Mainnet chain ID `1` is rejected.
- The KeeperHub executor address has only the minimum required role.
- A real out-of-policy oracle drift is produced on the test fixture.
- A real KeeperHub correction transaction resolves it.

### UI gate

- All frontend requests go to the NestJS API.
- No fixture imports exist in application bundles.
- Empty, not-configured, provider-down, and authorization states are honest.
- The UI never displays fake transaction evidence.
- SSE reconnects from durable sequence IDs.
- The complete live flow works after a page reload and worker restart.

### Test gate

- Formatting, lint, strict type checks, unit, integration, contract, security, and production builds pass.
- Playwright browser binaries are installed.
- All Playwright tests pass.
- A live-provider acceptance suite passes against Base Sepolia.
- A transaction link is captured as release evidence.
- No known production dependency vulnerability remains.
