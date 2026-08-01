# Aether Repository Instructions

Read all numbered Markdown documents in the repository root before changing code. `01_AETHER_PRD.md` is the product source of truth. `02_AETHER_SYSTEM_ARCHITECTURE.md` is the architecture source of truth. `03_AETHER_UI_UX_SPEC.md` is the interface source of truth. The original visual reference is in `docs/DESIGN.md`.

## Engineering posture

Act as a principal frontend, backend, platform, security, and Web3 engineer. Produce production-shaped code, not a demo scaffold. Prefer clear, boring, testable architecture over clever abstractions. Every external system must sit behind a typed adapter. Every side effect must be observable, retry-safe where possible, and protected from duplicate execution.

## Required stack

- Turborepo and pnpm workspaces.
- `apps/web`: Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, GSAP, Lenis, Three.js where justified, Axios, TanStack Query, Zustand, React Hook Form, Zod, Iconsax, React Flow.
- `apps/api`: NestJS, TypeScript, MongoDB with Mongoose, Swagger UI.
- `apps/worker`: standalone NestJS worker using Redis and BullMQ.
- `packages/contracts`: Foundry smart contracts, tests, deployment and drift scripts.
- Shared packages for UI, types/schemas, SDK, configuration, and testing.

## Required workflow

1. Keep one runtime path: browser SDK → API → MongoDB/outbox → worker → live providers.
2. Runtime mocks, provider switches, demo controls, seeded product state, and fake
   evidence are prohibited; test doubles remain test-only.
3. Ethereum Sepolia `11155111` is the only live target, Anvil `31337` is local
   infrastructure, and mainnet `1` is prohibited.
4. Validate all external inputs and AI outputs with Zod or equivalent runtime schemas.
5. Never let an LLM directly authorize or sign a transaction.
6. Enforce permissions, policies, target allowlists, function allowlists, value limits, chain restrictions, approval thresholds, and invariant checks in deterministic code.
7. Simulate transaction requests before execution whenever the provider supports it.
8. Use stable idempotency keys and persist execution correlation IDs before retrying.
9. After every write, verify onchain postconditions independently.
10. Never represent an irreversible blockchain write as a traditional rollback; use explicit compensating or forward-correction plans.
11. Never place secrets or private keys in source control, client bundles, logs, fixtures, screenshots, or error messages.

## Quality gates

Before declaring a phase complete, run and report:

- formatting and linting;
- TypeScript checks;
- unit tests;
- integration tests relevant to the phase;
- production builds;
- accessibility checks for critical frontend flows;
- security checks relevant to touched code.

Do not hide failures. Fix them or document the exact blocker and evidence.

## Decision rule

Ask the user only when a decision is genuinely blocking, irreversible, security-sensitive, or cannot be inferred from these documents. Otherwise, make a conservative assumption, record it in `docs/ASSUMPTIONS.md`, and continue.

## Documentation rule

Keep these files current throughout implementation:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/SETUP.md`
- `docs/ENVIRONMENT.md`
- `docs/TESTING.md`
- `docs/SECURITY.md`
- `docs/INTEGRATIONS.md`
- `docs/OPERATIONS.md`
- `docs/ASSUMPTIONS.md`
- `docs/IMPLEMENTATION_STATUS.md`
