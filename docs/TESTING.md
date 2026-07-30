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

Backend unit tests cover canonical safety authorization and redaction. API integration
tests boot a real Nest HTTP application with the in-memory test repository and exercise
auth, roles, tenancy, validation, scenario state, and approval. Contract tests parse
responses with the browser Zod schemas and inspect OpenAPI paths. Worker tests prove
provider correlation is persisted before submit, duplicates do not resubmit unknown
outcomes, provider timeouts enter reconciliation, and failed verification creates a
forward correction.

Production startup is smoke-tested from compiled output. Mongo/Redis end-to-end
infrastructure testing requires the local replica set and Redis from `compose.yaml`;
the deterministic processor tests do not need external services.

Playwright 1.62.1 is configured. Its Chromium binary is not installed because the user
deferred the network download. Do not claim browser execution until the binary exists;
run `pnpm --filter @aether/web test:e2e` when it becomes available.
