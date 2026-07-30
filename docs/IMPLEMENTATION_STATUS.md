# Implementation Status

## Focused MVP frontend

Status: implemented and locally validated, except for the user-deferred Playwright
browser binary.

## Reduced MVP API and worker

Status: implemented.

- Live provider boundaries cover GitHub repository/release/commit/PR provenance,
  KeeperHub exact dry-run plus workflow submission/status/step logs/transaction
  correlation, EVM block-pinned reads/logs/receipts/finality/verification, and optional
  strict-schema OpenAI advisory summaries/plan suggestions.
- Every live provider uses timeout, bounded safe retry, `Retry-After`, redacted
  observability, runtime response validation, and health state; deterministic mocks
  implement the same expanded interfaces.
- Provider credential envelopes use tenant/provider-bound AES-256-GCM, and uncertain
  KeeperHub submissions remain retry-locked when no external execution ID is available.
- NestJS API with MongoDB/Mongoose persistence definitions, Swagger/OpenAPI, JWT tenant
  context, contextual RBAC, strict CORS, Helmet, Zod request/provider validation, and
  structured redacted logs.
- Browser-compatible dashboard, scenario, advance, contextual approval, and desired
  validation endpoints plus reduced setup, versions, observations, drift, operations,
  executions, audit, and SSE resources.
- Transactional audit/outbox mutation boundary and durable tenant-scoped event sequence.
- Standalone NestJS worker with all seven BullMQ queues, stable job IDs, bounded retry,
  outbox publication, validated mock/live adapters, KeeperHub correlation persistence,
  reconciliation lock, independent verification, and forward correction.
- Shared server safety package with Mongo collection/index definitions and deterministic
  authorization checks.
- API integration/contract/security tests and worker idempotency/retry tests.

## MVP contracts and local chain

Status: implemented and locally validated.

- Minimal unaudited, value-free Foundry package with an ERC-1967 Arcadia market proxy,
  role-protected oracle setter, timestamp oracle fixtures, and independent freshness
  postcondition.
- Deterministic deployment/seed/drift/correction scripts restricted to Anvil `31337`
  and Base Sepolia `84532`, including missing-role simulation and post-write
  verification-failure scenarios.
- Generated server-only ABIs, selectors, and public deployment registry consumed by the
  backend exact-request encoder and worker chain reader.
- Receipt-aware finality, canonical block checks, reorg detection, unknown-outcome
  reconciliation lock, fresh independent verification, and explicit forward
  correction without rollback claims.
- Unit, 512-run fuzz, 128-run/8,192-call invariant, deployment, drift, and correction
  tests plus a checked gas snapshot.

## Contracts and affected workspace validation — July 30, 2026

- `pnpm format:check` — passed for Prettier and `forge fmt`.
- `forge lint` and `forge build --deny warnings` — passed with no diagnostics.
- `forge test` — 15 passed: 6 unit, 2 fuzz campaigns at 512 runs each, 2 stateful
  invariants at 128 runs/8,192 calls each, 2 deployment, and 3 lifecycle tests.
- `forge test --gas-report` and `forge snapshot --check` — passed; `setOracle` median
  measured at 9,634 gas in the report.
- Full Anvil script lifecycle — passed: deploy, seed, drift, missing-role simulation,
  exact restore, stale verification failure, and forward freshness correction.
- Base Sepolia deployment script with chain ID `84532` — passed without broadcast; no
  signer or live deployment is claimed.
- `pnpm lint`, `pnpm check-types`, and `pnpm build` — all 9 runnable workspace tasks
  passed.
- `pnpm test` — 49 tests passed across Foundry, backend, API, worker, mock transport,
  and web suites.
- Focused API integration/contract/security and worker idempotency/retry gates — passed.
- JSON-RPC worker tests — 4 passed for unknown receipts, finality, reorg detection, and
  canonical fresh verification.
- `pnpm audit --prod` — no known vulnerabilities.

## Backend validation evidence — July 30, 2026

- `pnpm format:check` — passed.
- `pnpm lint` — 8 runnable workspace lint tasks passed with zero warnings.
- `pnpm check-types` — 8 strict TypeScript tasks passed.
- `pnpm test` — 27 tests passed: 10 API, 4 worker, 3 backend safety,
  4 mock-service, and 6 web tests.
- Focused API integration, browser-contract, API security, worker idempotency, and
  worker retry commands — passed.
- `pnpm audit --prod` — no known vulnerabilities after patched transitive overrides.
- `pnpm build` — API, worker, web, and shared package production builds passed.
- API-mode frontend production build with
  `NEXT_PUBLIC_AETHER_DATA_MODE=api` — passed without component changes.
- Compiled API smoke — health, OpenAPI (18 paths), and typed dashboard passed.
- Isolated MongoDB replica-set plus Redis smoke — transactional outbox published the
  execution job; the worker submitted, reconciled, and independently reached
  `verified`, with seven correlated audit events.
- Playwright browser execution remains deferred because its Chromium binary is absent,
  as recorded by the frontend phase.

## Complete

- Original SVG brand set, favicon, loading, empty-state, and static hero fallback use.
- Landing, login, signup, eight-step onboarding, not-found, unauthorized, and error
  states.
- Exactly seven authenticated areas with five sidebar destinations.
- Protocol Setup consolidating general, networks, contracts, GitHub, and KeeperHub.
- Desired State form/YAML modes, runtime validation, explicit units/addresses/roles,
  diff, provenance, safety summary, version history, and save invalidation whenever the
  validated exact draft changes.
- Drift list/filter/mobile cards and evidence drawer separating facts from inference.
- Immutable operation detail with policy, simulation, approval, React Flow graph,
  accessible fallback, and graph-step drawer.
- KeeperHub execution detail with transaction evidence, simulation failure, partial
  correction, unknown-outcome retry lock, reconciliation, and verification states.
- Searchable audit table/mobile cards and structured event drawer.
- Typed shared schemas, Axios SDK, direct mock transport, equivalent MSW handlers,
  event bus, and six deterministic scenarios.
- Reduced downstream prompts and complete post-MVP scope boundary.

## Removed or consolidated

- Separate product, security, how-it-works, docs, forgot-password, and invite routes.
- Protocol list/detail, deployments, contracts, incidents, approvals, invariants,
  policies, KeeperHub list, integrations, team, notifications, and settings pages.
- Command palette and notification center.
- Seven non-MVP mock scenarios.

## MVP provider and end-to-end hardening validation — July 30, 2026

- `pnpm format:check`, `pnpm lint`, and `pnpm check-types` — passed across all
  runnable workspace tasks, including Foundry formatting, lint, and warning-denying
  compilation.
- `pnpm test` — 62 tests passed: 15 contracts, 6 backend, 10 API, 17 worker,
  5 deterministic mock transport, and 9 web unit/component tests.
- Focused API integration, API contract, API security, worker idempotency, worker
  retry, contract gas-report, and contract snapshot gates — passed.
- `pnpm build` — all 9 runnable production builds passed. The separate API-mode web
  production build also passed without weakening mock mode.
- `pnpm audit --prod` — no known production dependency vulnerabilities.
- The Playwright matrix discovered 20 desktop/mobile cases. All 20 stopped before
  application launch because Playwright's Chromium headless-shell executable was not
  installed locally; this is an environment constraint, not a passing browser result.
- In-app browser inspection covered landing, login, signup, onboarding, unauthorized,
  all seven authenticated areas, legacy redirects, removed routes, dialogs/drawers,
  tables/cards, and operation graph fallback at desktop and 390 × 844. It found and
  verified fixes for mobile protocol-tab overflow and controlled-drawer focus
  restoration; retained routes had no remaining horizontal overflow.

## Deferred by phase boundary

- Live Base Sepolia deployment and provider acceptance against actual RPC/KeeperHub,
  GitHub, and OpenAI accounts; no provider credentials were available in this pass.
- External identity token issuance/revocation and Safe/governance signing adapters.
