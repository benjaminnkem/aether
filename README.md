# Aether

Aether is mission control for multi-step onchain work.

It records what a caller intended, submits supported Sepolia writes through KeeperHub, verifies the resulting chain state through two independent RPC providers, locks retries when a submission result is uncertain, and executes only declared recovery actions when a mission stops halfway.

## Why mission-level execution

A successful transaction response does not prove that a multi-step objective completed. A provider response may be lost after broadcast, a later step may fail after earlier effects landed, or RPC providers may disagree before finality. Aether keeps an append-only record for each plan, simulation, attempt, observation, approval, reconciliation decision, recovery action, and final receipt.

The execution loop is:

> Define → Execute → Observe → Reconcile → Recover → Prove

KeeperHub remains the transaction execution provider. Aether does not manage wallets or rebuild transaction submission. Every supported write is simulated and submitted through KeeperHub Direct Execution. Aether independently evaluates the postcondition before calling a step verified.

Groq is optional. It may produce a schema-validated incident summary from bounded, sanitized evidence. It receives no transaction credentials or tools and cannot approve, alter, or submit a write. Recovery and authority decisions remain deterministic when Groq is unavailable.

## Architecture

- `apps/api` — NestJS API, inline run coordinator, Mongo-backed leases and fencing, SSE streams, authentication, approvals, audit, and provider adapters.
- `apps/web` — Next.js operator console and the fixed `/demo` scenarios.
- `apps/agents` — separately deployable Savings client at `/agents`; it uses only the public v1 API through a scoped server-side agent key.
- `packages/shared` — strict request and mission schemas.
- `packages/backend` — state transitions, persistence models, hashing, encryption, and safety boundaries.
- `packages/sdk` — typed fetch client and reconnectable run stream parser.
- `packages/contracts` — fixed-purpose Sepolia demo vault plus Foundry unit and fuzz tests.

There is no Redis, BullMQ, worker service, task queue, or outbox queue. A run advances immediately in the API process and persists every transition. A Mongo lease scanner resumes due work after a disconnect or restart. Provider delays are stored as `nextActionAt`; they are not implemented as blocking sleeps.

## Local setup

Requirements: Node.js 20.9 or newer, pnpm 10.15.1, Docker, and Foundry.

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm env:doctor
pnpm dev
```

MongoDB runs as a replica set on port `27018`; Mailpit runs on `1025`/`8025`. Configure two distinct Sepolia RPC endpoints before starting the API.

Important server-only variables are documented in `.env.example`:

- `MONGODB_URI`
- `AETHER_ACCESS_TOKEN_SECRET`, `AETHER_REFRESH_TOKEN_SECRET`, `AETHER_COOKIE_SECRET`, `AETHER_CSRF_SECRET`
- `AETHER_CREDENTIAL_ENCRYPTION_KEY`
- `SEPOLIA_RPC_PRIMARY_URL`, `SEPOLIA_RPC_SECONDARY_URL`
- `KEEPERHUB_API_KEY`, `KEEPERHUB_BASE_URL`
- `GROQ_API_KEY`, `GROQ_MODEL` (optional incident summaries)
- `DEMO_LIVE_EXECUTION_ENABLED`, `DEMO_VAULT_ADDRESS`, `KEEPERHUB_EXECUTOR_ADDRESS`

Never expose these through `NEXT_PUBLIC_*` variables.

### External savings and lending applications

The savings and lending agents use the public Aether API through a restricted server-side API key. Configure the `SAVINGS_*` and relevant `LENDING_*` variables in `.env`, then start the workspace with `pnpm dev`. The agent runtime is available at `http://localhost:3001?product=savings` and `http://localhost:3001?product=lending`. The Aether landing page links to those URLs using `AETHER_AGENT_RUNTIME_ORIGIN`.

Its normal path never replays or fabricates execution. When `SAVINGS_LIVE_EXECUTION_ENABLED=false`, it stops before mission creation. A connected wallet signs an ownership challenge only; the signature is not transaction authority and no private key reaches either application server.

The lending integration targets a configured Sepolia pool. Its closed-cycle mission supplies collateral, opens variable-rate debt, repays the full debt, withdraws collateral, revokes both approvals, and independently verifies the terminal balances and allowances. The local Sepolia configuration uses uncapped LINK collateral and borrows USDC because the Aave Sepolia USDC supply cap may already be full. The executor must hold enough USDC to cover interest accrued before repayment. Known failures use only the frozen repayment, withdrawal, and revocation actions; uncertain writes remain retry-locked until reconciled.

Deploy the fixed-purpose savings vault only with the explicit live command:

```bash
SAVINGS_KEEPERHUB_EXECUTOR_ADDRESS=0x... \
SEPOLIA_RPC_PRIMARY_URL=https://... \
PRIVATE_KEY=0x... \
pnpm savings:deploy:live
```

Set the deployed address as `SAVINGS_VAULT_ADDRESS`. The configured KeeperHub executor must hold the supported token and enough Sepolia ETH, and the Aether workspace must have valid KeeperHub credentials.

## Development and validation

### Render API deployment

Render must build the API's workspace dependencies before starting Nest. Use these commands for the API web service:

```text
Build Command: pnpm install --frozen-lockfile && pnpm build:api
Start Command: pnpm --filter @aether/api start
```

`build:api` includes `@aether/backend` and `@aether/shared`; without those packages' compiled `dist` files, Node cannot resolve the API's runtime imports on a clean Render deploy.

```bash
pnpm format
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

Ordinary tests and builds cannot broadcast transactions. Live Sepolia acceptance is separate and requires credentials plus the explicit flag:

```bash
LIVE_SEPOLIA_TESTS=true pnpm test:live:sepolia
```

The public demo accepts only `HAPPY_PATH`, `PARTIAL_FAILURE`, or `UNKNOWN_OUTCOME`, fixed server-side addresses and amounts, and bounded request rates. If live execution is disabled, it shows only hash-validated receipts imported from previously verified Sepolia runs.

## Security boundaries

- Ethereum Sepolia (`11155111`) is the only write network.
- Every write is planned and simulated before KeeperHub submission.
- The execution attempt and audit evidence commit before the potentially broadcasting call.
- Unknown outcomes set a durable resubmission lock; they are never blindly retried.
- Critical terminal invariants and all unknown attempts must resolve before a final receipt.
- Browser tenant identity comes from the authenticated server session.
- Browser mutations require CSRF protection and an `Idempotency-Key`.
- Agent API keys are scoped, shown once, and stored as Argon2id hashes.
- Integration secrets use workspace/provider/version-bound AES-GCM encryption.

See [PRD.MD](./PRD.MD) for product and safety requirements and [docs/DESIGN.MD](./docs/DESIGN.MD) for the visual system.
