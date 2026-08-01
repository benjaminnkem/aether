# Live Completion Plan

> Superseded for chain targeting by `ETHEREUM_SEPOLIA_MIGRATION_PLAN.md`. The current
> verdict is `ETHEREUM SEPOLIA MIGRATION CODE-COMPLETE — LIVE BROADCAST BLOCKED`.

## Implementation update — 2026-07-31

The inventories below capture the repository at the start of this pass. The runtime
items were removed or replaced: the mock package/MSW/demo controller and endpoints,
`MvpState`, fixed identities, provider switches, and fabricated dashboard are gone.
Authentication, persistent onboarding, RPC scan/drift, Direct Execution,
GitHub App, strict OpenAI, environment doctors, Sonner, and CI were implemented.

External proof remains blocked by the invalid-chain RPC, absent signer/funds,
GitHub/OpenAI credentials, and the undeployed fixture. The authoritative current
status is `IMPLEMENTATION_STATUS.md`.

## Current architecture

The intended runtime path is:

```text
Next.js -> @aether/sdk -> NestJS API -> MongoDB/outbox -> BullMQ worker
                                                    -> RPC/KeeperHub/GitHub/OpenAI
```

The repository already contains all deployable processes, Mongoose collections,
transactional audit/outbox writes, durable BullMQ job envelopes, generated Foundry
artifacts, JSON-RPC observation/verification, and typed provider boundaries. The
current browser and API still sit on a deterministic `MvpState` aggregate, however,
and the worker still chooses mock providers unless explicitly switched to live.

## Runtime mock inventory

- `packages/mock-data` and the browser MSW worker are production dependencies.
- `apps/web/src/components/providers.tsx` dynamically installs a direct mock transport.
- `apps/web/src/components/app/demo-controller.tsx` exposes scenario selection.
- the SDK implements `/demo/scenario` and `/demo/advance`.
- the API exposes matching demo endpoints and can silently use an in-memory store.
- `packages/backend/src/dashboard.ts` fabricates Arcadia records, provider health,
  operation/execution IDs, blocks, transaction evidence, and audit rows.
- the worker registers deterministic chain, simulation, KeeperHub, GitHub, and AI
  providers.
- fixed `org-arcadia`, `arcadia`, `op-oracle-restoration`, and `exec-kh-8314` values
  are used as runtime tenant and resource identity.

Test-only fixtures, Anvil, Mailpit, and fault-injection providers remain permitted
after they are moved out of runtime imports.

## Live integration inventory

- RPC: live JSON-RPC reader exists with pinned reads, receipts, confirmations, and
  canonical block checks. Configuration and a live chain check are not yet proven.
- KeeperHub: existing live code uses the obsolete workflow execution path. It must
  use Direct Execution, validate `/api/chains`, simulate the exact body, submit the
  same body with idempotency, and poll the direct execution status endpoint.
- GitHub: a read-token adapter exists. GitHub App installation, token minting,
  webhook verification/idempotency, and persisted connection state are missing.
- OpenAI: a Responses API structured-output adapter exists, but its schema is too
  narrow and live credentials are absent.
- SMTP/auth: first-party issuance, refresh sessions, email verification, reset, and
  revocation are missing.

## Unsafe assumptions

- development authentication silently grants an owner identity.
- configured organization/protocol IDs are treated as membership.
- an empty database returns a fully populated healthy dashboard.
- provider health begins as healthy before any request.
- KeeperHub workflow IDs and fabricated transaction data are treated as product
  evidence.
- setup forms accept local-only UI changes and do not consistently persist real
  organization, protocol, network, or contract resources.

## Data migrations

1. Add password/email-verification/reset fields to users and create hashed refresh
   sessions.
2. Add durable scan, investigation, direct-execution, provider request, and webhook
   delivery fields/indexes.
3. Stop reading or creating `mvp_state`; provide an explicit development-only reset
   command for legacy sample collections.
4. Resolve tenant context from the authenticated user and memberships, with the
   selected protocol validated against that organization.
5. Create desired-state, operation, approval, execution, audit, and outbox records
   as immutable/versioned domain documents.

## Code changes

- make Axios with credentials the only browser transport;
- remove runtime mock dependencies, demo UI/endpoints, scenario state, and fixed IDs;
- add first-party cookie authentication, CSRF, rotation/replay detection, SMTP, and
  auth rate limiting;
- make MongoDB mandatory outside isolated test modules;
- implement persistent onboarding and truthful empty/provider-disabled states;
- update KeeperHub to the current Direct Execution contract;
- retain deterministic authorization and independent RPC verification;
- add GitHub App and strict advisory-only OpenAI paths;
- use Sonner for all dashboard toasts and add subtle backdrop blur plus restrained
  enter/exit motion with reduced-motion fallbacks;
- add environment/provider doctors and a runtime-import CI guard.

## External blockers observed on 2026-08-01

Environment values were inspected by name/status only. KeeperHub, GitHub App, and
OpenAI credentials are configured; GitHub App identity and OpenAI model availability
passed. The configured RPC reports a chain other than Ethereum Sepolia, no usable
Foundry signer matches the configured administrator, and no deployment or transaction
exists. Exact external actions are maintained in `docs/MANUAL_EXTERNAL_ACTIONS.md`.

## Verification plan

1. Static search and production dependency graph prove runtime mock removal.
2. Environment doctors report names/status only and providers fail closed.
3. Unit/security tests cover auth rotation, CSRF, replay, deterministic request
   binding, schemas, redaction, and runtime import policy.
4. Mongo/Redis integration covers transactions, outbox replay, duplicate delivery,
   SSE cursor resume, and restart recovery.
5. Foundry and local Anvil cover real observation, drift, correction, partial
   verification, and forward correction.
6. Playwright covers signup through audit at desktop/mobile/reduced-motion/keyboard.
7. Opt-in live acceptance records only real Ethereum Sepolia/OpenAI/GitHub/KeeperHub/RPC
   evidence. Until those provider and signer requirements exist, the maximum honest
   verdict is `ETHEREUM SEPOLIA MIGRATION CODE-COMPLETE — LIVE BROADCAST BLOCKED`.
