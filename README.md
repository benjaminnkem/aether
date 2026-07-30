# Aether

Aether is a desired-state control plane for smart-contract protocols. The focused MVP
frontend covers protocol setup, desired state, drift investigation, correction
operations, KeeperHub execution evidence, and audit history.

## Quick Start

Requirements: Node.js 20.9+ and pnpm 10.15.1.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @aether/web dev
```

Open `http://localhost:3000`. Mock mode requires no credentials.
If the mode variable is omitted, Aether safely defaults to mock mode.

```env
NEXT_PUBLIC_AETHER_DATA_MODE=mock
NEXT_PUBLIC_AETHER_API_URL=/v1
```

The future API switch is:

```env
NEXT_PUBLIC_AETHER_DATA_MODE=api
NEXT_PUBLIC_AETHER_API_URL=http://localhost:4000/v1
```

Components never branch on this mode. They use `@aether/sdk`; mock mode installs a
deterministic SDK transport and MSW implements the same HTTP paths.

## Workspace

- `apps/web` — Next.js 16 App Router marketing and product UI.
- `packages/ui` — original Aether accessible component library.
- `packages/shared` — browser-safe Zod schemas and domain types.
- `packages/sdk` — typed Axios client and realtime contract.
- `packages/mock-data` — deterministic scenarios and MSW handlers.
- `packages/eslint-config`, `packages/typescript-config` — shared quality configuration.

Backend, worker, contracts, and live provider adapters are intentionally not implemented.
The six deterministic mock scenarios require no credentials.

## Quality Commands

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm test:e2e
pnpm build
```

See `docs/FRONTEND_ROUTES.md`, `docs/MOCK_SCENARIOS.md`, and `docs/IMPLEMENTATION_STATUS.md`.
