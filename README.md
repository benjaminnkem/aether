# Aether

Aether is an Ethereum Sepolia control plane for versioned protocol intent, live RPC
observation, advisory AI investigation, deterministic correction planning, contextual
approval, KeeperHub Direct Execution, independent verification, and immutable audit.

The only application path is:

```text
Next.js → @aether/sdk → NestJS API → MongoDB/outbox → BullMQ worker → live providers
```

There is no browser data mode, provider mode, demo state machine, runtime fixture
fallback, or normal-startup seed. Missing providers fail closed and the UI shows an
honest setup or unavailable state.

## Workspace

- `apps/web` — Next.js App Router frontend with TanStack Query and Sonner toasts.
- `apps/api` — NestJS API, first-party authentication, tenant domain, SSE, GitHub App.
- `apps/worker` — BullMQ worker for observation, investigation, simulation, execution,
  reconciliation, and verification.
- `packages/backend` — Mongoose models, provider contracts, security, calldata, safety.
- `packages/contracts` — unaudited testnet-only Foundry fixture and scripts.
- `packages/sdk`, `packages/shared`, `packages/ui` — browser SDK, schemas, UI system.

## Start locally

```bash
pnpm install
pnpm env:doctor
docker compose up -d
pnpm dev
```

Open `http://localhost:3000`; Mailpit is at `http://localhost:8025`. Before any live
onchain action, follow [manual external actions](docs/MANUAL_EXTERNAL_ACTIONS.md) and
make every relevant doctor pass.

```bash
pnpm chain:doctor
pnpm keeperhub:doctor
pnpm github:doctor
pnpm openai:doctor
```

The current release verdict and evidence are recorded in
[live acceptance evidence](docs/LIVE_ACCEPTANCE_EVIDENCE.md). Never interpret a local
build or a provider doctor as proof of an Ethereum Sepolia transaction.

The canonical live chain is Ethereum Sepolia `11155111`; Anvil `31337` is local
integration infrastructure and mainnet `1` is prohibited. The current migration is
code-complete but live broadcast is blocked by the configured non-Sepolia RPC and the
absence of an authorized funded deployer. See the
[migration plan](docs/ETHEREUM_SEPOLIA_MIGRATION_PLAN.md) and exact continuation steps
in [manual external actions](docs/MANUAL_EXTERNAL_ACTIONS.md).
