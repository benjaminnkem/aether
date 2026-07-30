# Testing

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm test:e2e
pnpm build
```

Focused backend gates:

```bash
pnpm --filter @aether/api test:integration
pnpm --filter @aether/api test:contract
pnpm --filter @aether/api security:check
pnpm --filter @aether/worker test:idempotency
pnpm --filter @aether/worker test:retry
```

Focused contract gates:

```bash
pnpm --filter @aether/contracts format:check
pnpm --filter @aether/contracts lint
pnpm --filter @aether/contracts test
pnpm --filter @aether/contracts test:gas
pnpm --filter @aether/contracts snapshot:check
```

The Foundry suite includes unit tests for initialization, roles, emitted evidence,
contract-address validation, and freshness; 512-case fuzz campaigns for freshness
boundaries and authorized oracle selection; stateful invariants for oracle code and
role isolation; deployment/proxy-slot tests; and lifecycle tests for drift, exact
correction, missing-role simulation, post-write verification failure, and forward
correction.

Backend unit tests cover canonical safety authorization and redaction. API integration
tests boot a real Nest HTTP application with the in-memory test repository and exercise
auth, roles, tenancy, validation, scenario state, and approval. Contract tests parse
responses with the browser Zod schemas and inspect OpenAPI paths. Worker tests prove
provider correlation is persisted before submit, duplicates do not resubmit unknown
outcomes, provider timeouts enter reconciliation, and failed verification creates a
forward correction. JSON-RPC tests additionally cover finality thresholds, canonical
receipt hashes, reorg-aware reads, unknown receipts, and fresh independent
postconditions.

Provider adapter tests also cover exact KeeperHub dry-run request parity, idempotent
workflow submission, status/transaction correlation, redacted step logs, bounded
rate-limit retry, non-idempotent no-retry behavior, provider health, deterministic
GitHub/OpenAI mocks, and bounded EVM log reads. Credential tests bind AES-GCM envelopes
to organization, protocol, and provider.

The Playwright matrix covers onboarding resume, the healthy-to-verified journey,
critical evidence drawer and Escape handling, exact approval, missing-role simulation
failure before submission, partial forward correction, unknown-outcome retry lock,
audit correlation, legacy redirects, removed-route 404s, reduced motion, and mobile
operation fallback.

Production startup is smoke-tested from compiled output. Mongo/Redis end-to-end
infrastructure testing requires the local replica set and Redis from `compose.yaml`;
the deterministic processor tests do not need external services.

Playwright 1.62.1 is configured. On July 30, 2026,
`pnpm --filter @aether/web test:e2e` discovered all 20 desktop/mobile cases, but each
stopped before application launch because the local Chromium headless-shell executable
was absent from the Playwright cache. This is not a passing result. Run the same command
after installing the matching Chromium binary; do not alter the tests or claim browser
execution in the meantime.
