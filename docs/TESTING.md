# Testing

## Principle

No runtime mocks are allowed. Test doubles remain valid inside isolated tests.

## Required gates

Start Docker Desktop, then use the consolidated no-broadcast command:

```bash
pnpm --filter @aether/web exec playwright install chromium
docker compose up -d
pnpm test:all
```

`test:all` runs provider doctors first, followed by formatting, lint, types, unit,
isolated Mongo replica-set integration, security, accessibility, visual, browser,
build, and production dependency audit gates. It deliberately stops on the first
failure and never enables `LIVE_TESTNET_ACCEPTANCE`.

The individual commands are:

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm test:integration
pnpm test:security
pnpm test:e2e
pnpm test:accessibility
pnpm test:visual
pnpm build
pnpm audit --prod
```

## Contract gates

```bash
pnpm --filter @aether/contracts format:check
pnpm --filter @aether/contracts lint
pnpm --filter @aether/contracts test
pnpm --filter @aether/contracts test:gas
pnpm --filter @aether/contracts snapshot:check
```

## Required test layers

### Unit

- canonical hashing;
- deterministic authorization;
- exact calldata encoding;
- plan/simulation/approval binding;
- tenant authorization;
- refresh-token rotation;
- CSRF;
- redaction;
- provider schemas;
- durable domain transitions;
- unknown-outcome locks.
- Ethereum Sepolia accepted while Base Sepolia and mainnet are rejected;
- chain/address changes invalidate old simulations and approvals;
- KeeperHub Sepolia request/explorer binding and RPC mismatch rejection;
- KeeperHub balance/role readiness and testnet-only drift-role separation.

### Integration

- real NestJS application;
- MongoDB replica-set transactions;
- Redis/BullMQ;
- transactional outbox;
- worker restart;
- SSE resumption;
- authentication lifecycle;
- onboarding and desired-state persistence;
- scan and drift persistence;
- approval threshold and expiry;
- audit immutability.

### Local-chain

Using Anvil and test-scope adapters only:

- deploy;
- observe healthy state;
- create real drift;
- detect drift;
- create advisory investigation;
- generate deterministic plan;
- simulate exact call;
- approve;
- submit using a local execution adapter only for local integration;
- verify finality/postcondition;
- create post-write verification failure;
- create forward correction.

### KeeperHub contract tests

Provider contract tests must validate current real response envelopes and headers for:

- authentication failure;
- chain listing;
- dry-run simulation;
- idempotent direct execution;
- idempotency conflict;
- idempotency in progress;
- status lookup;
- rate limiting;
- wallet not configured;
- spending cap failure;
- timeout after submit.

Recorded fixtures may be used only in tests and must be periodically refreshed from official live responses with secrets removed.

### Playwright

Install the browser and pass the full matrix:

- signup;
- login;
- onboarding;
- GitHub connection;
- KeeperHub connection health;
- protocol setup;
- desired-state save;
- initial scan;
- real drift appearance;
- evidence drawer;
- AI investigation;
- plan generation;
- safety checks;
- approval;
- simulation;
- execution progress;
- transaction link;
- verification;
- audit correlation;
- refresh/reconnect;
- mobile;
- reduced motion;
- keyboard operation;
- provider-down states;
- unauthorized role.

Visual baselines cover the landing, authentication, Overview, every retained product
route, desktop Chrome, Pixel 7, reduced motion, and stable test-only provider data.
Accessibility coverage combines axe checks with keyboard navigation, focus return,
live-region, status text/icon, touch-target, responsive-table/card, graph fallback,
and 320px viewport assertions. Update approved baselines with
`pnpm test:visual:update`; normal verification uses `pnpm test:visual`.

Production-mock verification searches for runtime mode switches, scenario controls,
fake hashes, seeded tenants, and direct fixtures; builds the production frontend; and
confirms an empty database remains empty and unavailable providers fail explicitly.
MSW or HTTP interception is permitted only from test files and must not enter the
production dependency graph.

### Live-provider acceptance

This is a separate opt-in suite that requires real credentials and Ethereum Sepolia funds.

It must:

1. validate providers;
2. use the real deployed fixture;
3. create or detect real drift;
4. invoke real OpenAI investigation;
5. simulate with KeeperHub;
6. submit with KeeperHub;
7. capture execution ID and transaction hash;
8. verify through independent RPC;
9. check audit correlation;
10. save a redacted evidence report.

## Release evidence

Generate `artifacts/live-acceptance/<timestamp>/` containing no secrets:

- commit SHA;
- environment variable names/status;
- contract addresses;
- provider health summary;
- KeeperHub execution ID;
- transaction hash/link;
- receipt block;
- verification block;
- audit correlation IDs;
- test command results;
- Playwright report;
- screenshots with secrets redacted.
