# Aether

> Mission control for autonomous onchain agents.

Built for the **KeeperHub Onchain Hackathon**, Aether makes multi-step onchain missions recoverable.

Aether freezes what an agent intends to do, executes supported writes through KeeperHub, independently observes Sepolia, reconciles uncertain outcomes, and either completes the mission or proves that an authorized safe state was restored.

**[Open the Aether console](https://aether.oluwadunsin.dev)** · **[Open the agent runtime](https://aether-agents.oluwadunsin.dev)** · **[Watch the demo](https://drive.google.com/file/d/1DnQKuXrmrR6Uw3zodU3uejMQ_EIZtxNM/view?usp=sharing)**

## The problem

A successful transaction does not prove that a multi-step objective completed. A provider response can disappear after broadcast, an earlier write can settle while a later step fails, and RPC providers can temporarily disagree. Blockchain state cannot be rolled back.

Aether records the mission’s intent and every material effect, locks unsafe retries when the outcome is unknown, and uses only pre-authorized compensating transactions to restore a safe state.

> **Define → Execute → Observe → Reconcile → Recover → Prove**

KeeperHub remains the transaction execution provider. Aether is the mission-level control plane above it; it does not manage wallets or rebuild transaction submission.

## Verified KeeperHub execution

This is a real Aether run selected from the local MongoDB ledger (`mission_receipts`, `execution_attempts`, and `operation_plans`) and checked against a public Ethereum Sepolia RPC.

| Field                            | Evidence                                                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network                          | Ethereum Sepolia (`11155111`)                                                                                                                                              |
| Mission                          | Supply 1 LINK, attempt to borrow 100 USDC, then repay, withdraw, and revoke approvals                                                                                      |
| Run                              | `run_f906363b-e125-4310-bf24-4f4177ec2b7e`                                                                                                                                 |
| Terminal result                  | `RECOVERED` — the borrow step failed and Aether restored the authorized safe state                                                                                         |
| Step / operation plan            | `supply-collateral` / `plan_0f1ed75d-a3f7-44c3-a7e4-751ef88430b0` (`COMPENSATION`)                                                                                         |
| KeeperHub execution              | `n32timo0387zasdbfrux6`                                                                                                                                                    |
| Exact transaction                | [`0x8d3cb0c43a283ab442c24df65c023be45da96e031eee7f60538570f2d0deb2e3`](https://sepolia.etherscan.io/tx/0x8d3cb0c43a283ab442c24df65c023be45da96e031eee7f60538570f2d0deb2e3) |
| Block / receipt                  | `11,468,046` / `0x1` (success)                                                                                                                                             |
| Operation                        | Compensation `withdraw` from the Aave Pool, returning the LINK collateral to the KeeperHub executor                                                                        |
| Collateral token                 | LINK — `0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5`                                                                                                                        |
| Contract target in Aether’s plan | [`0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`](https://sepolia.etherscan.io/address/0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951)                                            |
| `withdraw` destination           | KeeperHub executor `0x9B3b00B52f74570dc090913A2aFCF34d14D0FbbF`                                                                                                            |
| Outer transaction recipient      | KeeperHub router `0x5af5194b4b0909eb978e3cf1e25333852277f07d`                                                                                                              |
| Final receipt hash               | `0xb41f38c5853a1024c44b9ad4472de797c31d0994ad6fa857deba2eb8d7417e21`                                                                                                       |

This is the recovery write that returned the supplied LINK collateral after the borrow step failed. The distinction between the contract target, the `withdraw` destination, and the outer recipient is intentional: KeeperHub routes the transaction, while Aether’s immutable operation plan records the application contract and function being executed. The selected run passed Sepolia chain, fixed-target, known-outcome, no-collateral-position, no-variable-debt, and allowance invariants.

## How Aether works

1. **Define** — Persist an immutable mission version with fixed steps, targets, limits, retry classes, invariants, and recovery rules.
2. **Execute** — Simulate the exact request, persist the plan and execution intent, then submit through KeeperHub Direct Execution with a unique idempotency key.
3. **Observe** — Read receipts, logs, contract state, balances, allowances, and confirmations from two independent Sepolia RPC providers.
4. **Reconcile** — Treat a lost or ambiguous provider response as `UNKNOWN`; lock resubmission until chain evidence proves what happened.
5. **Recover** — Run only declared, deterministic compensation actions when the original objective cannot continue.
6. **Prove** — Create a final receipt only when all critical terminal invariants pass and no uncertain attempt remains unresolved.

## What makes it safe

- Ethereum Sepolia (`11155111`) is the only live write network.
- Every supported write is simulated before it can be broadcast.
- The mission version, plan hash, simulation, approval, and execution are bound together.
- The execution attempt and audit evidence are committed before the external call.
- A provider timeout is not treated as proof that no transaction landed.
- `UNKNOWN` and `NEEDS_ATTENTION` are visible operational outcomes, not hidden failures.
- Finalized transactions are never described as rolled back; recovery uses new compensating transactions.
- `COMPLETED` and `RECOVERED` require independent verification of critical invariants.
- Groq is advisory only. It may summarize sanitized evidence, but it cannot approve, create unrestricted calldata, receive credentials, or broadcast.

## Demo scenarios

The `/demo` experience uses the production mission engine with fixed server-side actions, addresses, amounts, and rate limits:

- **Happy path** — a Sepolia mission completes and is independently verified.
- **Partial failure** — earlier effects are confirmed, a later step fails, and Aether compensates to a safe state.
- **Unknown outcome** — a response is intentionally lost after a real write; Aether locks replay, reconciles the chain, and continues without duplicating the economic action.

When live execution is disabled, the demo may replay only hash-validated receipts from previously verified Sepolia runs. It never fabricates transaction hashes or receipts.

## Architecture

| Package              | Responsibility                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`           | NestJS API, mission coordinator, Mongo-backed leases and fencing, SSE streams, authentication, approvals, audit, and provider adapters |
| `apps/web`           | Next.js operator console and fixed `/demo` scenarios                                                                                   |
| `apps/agents`        | Separately deployable autonomous-agent runtime using the public Aether API through a scoped server-side key                            |
| `packages/shared`    | Strict mission and request schemas                                                                                                     |
| `packages/backend`   | Domain state transitions, persistence models, hashing, encryption, and safety boundaries                                               |
| `packages/sdk`       | Typed API client and reconnectable run-stream parser                                                                                   |
| `packages/contracts` | Fixed-purpose Sepolia demo contracts and Foundry tests                                                                                 |

Runs advance in the API process and persist every transition. MongoDB leases and `nextActionAt` allow unfinished work to resume after a disconnect or restart; there is no Redis, BullMQ, worker service, or queue dependency in the current runtime.

## Local development

Requirements: Node.js 20.9+, pnpm 10.15.1, Docker, and Foundry.

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm env:doctor
pnpm dev
```

The local stack runs MongoDB as a replica set on port `27018` and Mailpit on ports `1025` and `8025`. Configure two distinct Sepolia RPC endpoints before starting the API.

Server-only credentials belong in `.env` and must never be exposed through `NEXT_PUBLIC_*` variables:

- `MONGODB_URI`
- `AETHER_ACCESS_TOKEN_SECRET`, `AETHER_REFRESH_TOKEN_SECRET`, `AETHER_COOKIE_SECRET`, `AETHER_CSRF_SECRET`
- `AETHER_CREDENTIAL_ENCRYPTION_KEY`
- `SEPOLIA_RPC_PRIMARY_URL`, `SEPOLIA_RPC_SECONDARY_URL`
- `KEEPERHUB_API_KEY`, `KEEPERHUB_BASE_URL`
- `GROQ_API_KEY`, `GROQ_MODEL` (optional incident summaries)
- `DEMO_LIVE_EXECUTION_ENABLED`, `DEMO_VAULT_ADDRESS`, `KEEPERHUB_EXECUTOR_ADDRESS`

The default Groq model is `llama-3.3-70b-versatile`. Groq is not required for deterministic execution or recovery.

## Validation

```bash
pnpm format:check
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

Ordinary tests, builds, and doctor commands cannot broadcast transactions. Live Sepolia acceptance is explicitly opt-in:

```bash
LIVE_SEPOLIA_TESTS=true pnpm test:live:sepolia
```

Live deployment commands also require `LIVE_SEPOLIA_TESTS=true` and are intentionally separate from normal development.

## Documentation

- [Product requirements](./PRD.MD)
- [Engineering rules](./AGENTS.MD)
- [Visual design system](./docs/DESIGN.MD)
