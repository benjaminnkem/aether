# Aether MVP Reduction Plan

## Objective

Reduce the existing frontend and all future implementation instructions to one
coherent demonstration: desired state → observation → oracle drift →
investigation → safe plan → approval → KeeperHub execution → independent
verification → immutable audit history.

## Current Frontend Routes

### Supporting

- `/`
- `/product`
- `/security`
- `/how-it-works`
- `/docs`
- `/login`
- `/signup`
- `/forgot-password`
- `/accept-invite`
- `/onboarding`

### Authenticated

- `/app/overview`
- `/app/protocols`
- `/app/protocols/new`
- `/app/protocols/arcadia`
- `/app/protocols/arcadia/desired-state`
- `/app/protocols/arcadia/deployments`
- `/app/protocols/arcadia/contracts`
- `/app/protocols/arcadia/drift`
- `/app/protocols/arcadia/incidents`
- `/app/protocols/arcadia/operations`
- `/app/protocols/arcadia/approvals`
- `/app/protocols/arcadia/invariants`
- `/app/protocols/arcadia/policies`
- `/app/keeperhub-runs`
- `/app/audit-log`
- `/app/integrations`
- `/app/team`
- `/app/notifications`
- `/app/settings/general`
- `/app/settings/security`
- `/app/settings/api-keys`
- `/app/settings/execution`

## Routes Retained

- `/`
- `/login`
- `/signup`
- `/onboarding`
- `/app/overview`
- `/app/protocol-setup`
- `/app/desired-state`
- `/app/drift`
- `/app/operations/[operationId]`
- `/app/executions/[executionId]`
- `/app/audit-log`

The standard Next.js not-found and error boundaries remain supporting behavior,
not product areas.

## Routes Deleted

- `/product`
- `/security`
- `/how-it-works`
- `/docs`
- `/forgot-password`
- `/accept-invite`
- `/app/protocols/new`
- `/app/team`
- `/app/notifications`
- all `/app/settings/*` routes

The public landing page retains concise product, security, and lifecycle content
without separate marketing routes.

## Routes Merged or Redirected

- Protocol list/detail, deployments, contracts, integrations, and execution
  settings merge into `/app/protocol-setup`.
- Existing desired-state route redirects to `/app/desired-state`.
- Existing protocol drift and incidents routes redirect to `/app/drift`.
- Operations and approvals merge into
  `/app/operations/op-oracle-restoration`.
- KeeperHub runs merge into `/app/executions/exec-kh-8314`.
- Invariants and policies become compact sections inside Desired State, Drift,
  and Operation Detail.
- Legacy audit URL remains `/app/audit-log`.

Useful legacy URLs receive one-way redirects. No removed route retains a hidden
page implementation.

## Components Retained

- Aether design-system primitives in `packages/ui`.
- Marketing shell, brand, Three.js field, motion utilities, and product
  composition.
- App shell, responsive sidebar/top bar, demo controller, drawers, dialogs,
  tables/cards, timelines, statuses, and permission states.
- Desired-state form foundation, reduced to the supported MVP resources.
- React Flow operation graph and mobile vertical-step fallback.
- TanStack Query dashboard hook, typed SDK boundary, and mock/API adapter switch.
- Zustand organization/protocol, mobile navigation, demo controls, and onboarding
  progress only.

## Components Removed or Consolidated

- Generic renderer branches for teams, notifications, settings, API keys,
  incidents, approvals, invariants, policies, integrations, deployments,
  contracts, protocol list, and KeeperHub list pages.
- Dedicated notification center and command palette product search.
- Generic create-page actions for removed resources.
- Nine-step onboarding content; it becomes the required eight-step MVP flow.
- Scenario fixtures for GitHub release, cross-chain mismatch, insufficient gas,
  approval rejection/expiry, rate-limit, empty organization, viewer, and stale
  RPC when they are not required by the six definitive MVP scenarios.

Low-level reusable primitives are retained.

## Documentation Requiring Updates

- `docs/01_AETHER_PRD.md`
- `docs/02_AETHER_SYSTEM_ARCHITECTURE.md`
- `docs/03_AETHER_UI_UX_SPEC.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND_ARCHITECTURE.md`
- `docs/FRONTEND_ROUTES.md`
- `docs/MOCK_SCENARIOS.md`
- `docs/ACCESSIBILITY.md`
- `docs/ENVIRONMENT.md`
- `docs/INTEGRATIONS.md`
- `docs/OPERATIONS.md`
- `docs/SECURITY.md`
- `docs/SETUP.md`
- `docs/TESTING.md`
- `docs/ASSUMPTIONS.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/VISUAL_REVIEW.md`
- new `docs/POST_MVP_ROADMAP.md`

## Prompts Requiring Updates

- `prompts/06_CODEX_PROMPT_02_BACKEND_API_WORKER.md`
- `prompts/07_CODEX_PROMPT_03_CONTRACTS_AND_LOCAL_CHAIN.md`
- `prompts/08_CODEX_PROMPT_04_KEEPERHUB_GITHUB_AI_INTEGRATIONS.md`
- `prompts/09_CODEX_PROMPT_05_END_TO_END_TESTING_HARDENING.md`
- `prompts/10_CODEX_PROMPT_06_FINAL_AUDIT_AND_HANDOFF.md`

Each rewritten prompt will state that the MVP PRD is binding and roadmap features
must not be implemented.

## Assumptions

1. The MVP demonstrates one organization, one protocol, and one selected
   environment while preserving tenant-scoped interfaces for the backend.
2. Marketing content remains on the landing page; separate marketing guide pages
   are not required.
3. Legacy URLs may redirect to the nearest MVP product area, but removed public
   marketing/auth pages return not found rather than preserving dead content.
4. Operation and execution IDs are dynamic URL segments even though mock mode
   currently seeds one primary oracle-correction record.
5. Approval and execution are mutations on the typed mock service, never local
   visual-component timers.
6. Playwright browser binaries remain unavailable until the deferred download can
   be completed; existing tests will be rewritten but browser execution will not
   be falsely reported.

## Completion Record

- Deleted six physical public/auth routes and the unused content-page renderer.
- Replaced the generic authenticated renderer with seven explicit product experiences.
- Reduced the sidebar from broad platform navigation to five destinations.
- Consolidated setup, policy, invariant, approval, and execution context as planned.
- Replaced thirteen fixtures with six authoritative deterministic scenarios.
- Rewrote the PRD, architecture, UI specification, downstream prompts, and handoff docs.
- Added the post-MVP roadmap and framework not-found/error states.
- Formatting, lint, strict type checks, 10 unit/component tests, and production build pass.
- Browser review confirms all retained routes, one removed-route 404, mobile drift
  cards/drawer, and the six-step mobile operation fallback without console errors or
  horizontal overflow.
- Playwright browser execution remains deferred because its browser binary is not
  installed and the user requested no network installation.
