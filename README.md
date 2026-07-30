# Aether

Aether is a desired-state control plane for smart-contract protocols. The focused MVP
covers protocol setup, desired state, drift investigation, deterministic correction
operations, KeeperHub execution, independent verification, realtime events, and audit
history.

## Quick Start

Requirements: Node.js 20.9+, pnpm 10.15.1, Foundry 1.7+, MongoDB configured as a
replica set, and Redis 7+.

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm dev
```

Open `http://localhost:3000`. Mock mode requires no credentials.
If the mode variable is omitted, Aether safely defaults to mock mode.

```env
NEXT_PUBLIC_AETHER_DATA_MODE=mock
NEXT_PUBLIC_AETHER_API_URL=/v1
```

The live API switch is:

```env
NEXT_PUBLIC_AETHER_DATA_MODE=api
NEXT_PUBLIC_AETHER_API_URL=http://localhost:4000/v1
```

Components never branch on this mode. They use `@aether/sdk`; mock mode installs a
deterministic SDK transport and MSW implements the same HTTP paths.

## Workspace

- `apps/web` — Next.js 16 App Router marketing and product UI.
- `apps/api` — NestJS HTTP API, MongoDB persistence, Swagger, authorization, and SSE.
- `apps/worker` — standalone NestJS BullMQ worker and provider adapters.
- `packages/contracts` — unaudited, value-free Foundry fixtures and lifecycle scripts
  for local Anvil and Base Sepolia.
- `packages/backend` — server-only schemas, deterministic safety checks, queue contracts,
  Mongoose models, hashing, and redaction.
- `packages/ui` — original Aether accessible component library.
- `packages/shared` — browser-safe Zod schemas and domain types.
- `packages/sdk` — typed Axios client and realtime contract.
- `packages/mock-data` — deterministic scenarios and MSW handlers.
- `packages/eslint-config`, `packages/typescript-config` — shared quality configuration.

The browser still defaults to deterministic mock mode. API mode uses the same SDK
schemas and requires no component changes. Server provider mode separately selects
validated mock or live RPC/KeeperHub/GitHub adapters plus an optional advisory-only
OpenAI evidence assistant. Live mode uses bounded retry, rate-limit handling, redacted
provider telemetry, health state, and server-only credentials.

## Quality Commands

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm test:e2e
pnpm build
```

Contract-specific commands, including local deployment, drift, correction, and gas
snapshot checks, are documented in `docs/TESTING.md` and `docs/OPERATIONS.md`.

Backend-specific focused gates are documented in `docs/TESTING.md`. See
`docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, and `docs/IMPLEMENTATION_STATUS.md`.
