# Implementation Status

## Focused MVP frontend

Status: implemented and locally validated, except for the user-deferred Playwright
browser binary.

## Complete

- Original SVG brand set, favicon, loading, empty-state, and static hero fallback use.
- Landing, login, signup, eight-step onboarding, not-found, and error states.
- Exactly seven authenticated areas with five sidebar destinations.
- Protocol Setup consolidating general, networks, contracts, GitHub, and KeeperHub.
- Desired State form/YAML modes, runtime validation, explicit units/addresses/roles,
  diff, provenance, safety summary, and version history.
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

## Validation evidence — July 30, 2026

- `pnpm format` — passed; Prettier completed.
- `pnpm lint` — 5/5 package tasks passed with zero warnings.
- `pnpm check-types` — 5/5 package tasks passed in strict mode.
- `pnpm test` — 9/9 tasks passed; 10 tests passed: 4 mock-service and 6 web tests.
- `pnpm build` — 5/5 package tasks passed; Next.js 16.2.12 production build compiled
  and generated `/`, login, signup, onboarding, favicon, not-found, and the dynamic app route.
- In-app browser route review — landing, auth, onboarding, all seven authenticated
  areas, and removed `/app/team` behaved as specified; no captured console errors or
  horizontal overflow.
- Mobile 390 × 844 review — drift table became one actionable card, evidence drawer
  exposed complete facts/inference, and operation graph became a six-step fallback.
- Playwright — not run in this reduction pass because Chromium is absent and the user
  explicitly deferred browser installation due network conditions.

## Deferred by phase boundary

- NestJS API and worker, MongoDB, Redis/BullMQ, outbox, and durable SSE.
- Foundry contracts, live chain observation, and testnet deployment.
- Live KeeperHub, GitHub, EVM RPC, OpenAI, and Safe/governance adapters.
- Server-enforced authentication, tenancy, authorization, idempotency, and persistence.
