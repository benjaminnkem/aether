# Aether MVP Product Requirements

## 1. Product definition

Aether is a desired-state control plane for EVM protocols. It observes configured
contracts, compares observed state with approved intent, explains drift with
evidence, creates deterministic correction plans, routes approved execution
through KeeperHub, and independently verifies the resulting onchain state.

Product promise: **Keep protocols in their intended onchain state.**

The MVP is intentionally narrow: one organization, one protocol environment, two
test networks, a small contract set, one high-quality drift-to-verification
lifecycle, and six deterministic failure/safety demonstrations.

## 2. Users and jobs

- Protocol owner: configure one protocol and approve exact correction plans.
- Operator: monitor health, investigate drift, and advance approved operations.
- Reviewer: distinguish observed evidence from analysis before approving.
- Auditor: reconstruct scans, approvals, provider calls, transactions, and verification.

## 3. MVP outcomes

1. A new user completes minimal onboarding and reaches a useful overview.
2. A team declares desired state with explicit addresses, roles, units, and provenance.
3. Aether detects unauthorized oracle drift from a block-pinned observation.
4. A reviewer inspects facts separately from AI-assisted inference.
5. A deterministic plan passes policy, simulation, and approval controls.
6. KeeperHub executes the exact approved request through a typed adapter.
7. Aether independently verifies the postcondition and closes the incident.
8. The audit log provides a durable, correlated operational record.

## 4. Product surface

### Public and support routes

- `/` — single-page product narrative, security model, and demo entry.
- `/login` — sign-in UI.
- `/signup` — optional account creation UI.
- `/onboarding` — eight-step minimal setup and resume flow.
- framework not-found and error states.

### Authenticated routes

| Route                           | Responsibility                                                     |
| ------------------------------- | ------------------------------------------------------------------ |
| `/app/overview`                 | Health, metrics, current drift, operation, execution, and networks |
| `/app/protocol-setup`           | General setup, networks, contracts, GitHub, and KeeperHub          |
| `/app/desired-state`            | Form/YAML desired state, validation, diff, policy, and versions    |
| `/app/drift`                    | Searchable findings and evidence drawer                            |
| `/app/operations/[operationId]` | Investigation, plan, policy, simulation, approval                  |
| `/app/executions/[executionId]` | KeeperHub lifecycle, transaction, uncertainty, correction          |
| `/app/audit-log`                | Searchable append-only events and event drawer                     |

The sidebar exposes only Overview, Protocol Setup, Desired State, Drift, and Audit Log.
Operation and execution details are contextual routes, not top-level modules.

## 5. Protocol setup

Protocol Setup combines capabilities that were previously separate modules:

- protocol name, environment, governance authority;
- EVM network and RPC metadata;
- contract addresses, proxy type, ABI provenance, and ownership;
- read-only GitHub release provenance;
- KeeperHub simulation and execution adapter status.

The browser must never request, expose, or persist provider secrets or private keys.

## 6. Desired state

The active manifest includes:

- semantic manifest version and release source;
- network identifier and chain ID;
- contract resource, version, and implementation address;
- approved oracle address;
- administrator and guardian addresses;
- pause state;
- protocol fee in basis points;
- minimum executor gas in native-token units;
- maximum automatic transaction value in native-token units.

Form and YAML modes use the same runtime Zod schema. Validation is required before
saving a new version. The UI shows an unsaved indicator, semantic diff, provenance,
active version, version history, approval threshold, allowlists, and independent
verification requirement.

## 7. Drift and investigation

Each finding includes severity, status, network, contract, observed value, desired
value, block number, first/last observation, and evidence provenance. The detail
drawer separates:

- observed facts;
- source-of-truth desired values;
- AI-assisted analysis explicitly labelled as inference;
- recommended deterministic next action.

The MVP correction target is an unauthorized `setOracle(address)` change.

## 8. Operation

An operation is an immutable plan revision bound to:

- exact target, function, calldata, chain, and zero-value transfer;
- evidence snapshot and desired-state version;
- target/function/value policies;
- exact-request fork simulation;
- approval identity, threshold, expiry, and plan hash;
- KeeperHub workflow correlation;
- confirmation and independent postcondition checks.

AI may summarize evidence and suggest a typed plan. AI never approves, signs, changes
allowlists, bypasses simulation, or declares verification success.

## 9. KeeperHub execution

KeeperHub is a third-party execution integration, not an endorsement or authority
boundary. Aether remains responsible for deterministic authorization and independent
verification. Execution presents:

- workflow and operation identifiers;
- lifecycle steps and live status;
- simulation and gas evidence;
- transaction hash when submitted;
- errors and retry state;
- partial completion requiring forward correction;
- unknown transaction outcome with automatic retry locked;
- final independent verification.

An irreversible blockchain write is never represented as a rollback.

## 10. Audit

Audit events are append-only and include actor, organization, protocol, event type,
request/correlation identifiers, resource references, redacted provider evidence,
timestamps, and result. Secret values and raw credentials are never retained.

## 11. Definitive mock scenarios

1. `healthy` — all observed state aligns.
2. `unauthorized-oracle` — critical drift from an unapproved oracle.
3. `approval-execution` — correction awaits approval, then succeeds.
4. `missing-role` — simulation reverts before submission.
5. `partial-execution` — write confirms but verification requires forward correction.
6. `unknown-outcome` — submission outcome is uncertain; retry is locked during reconciliation.

Primary review journey:

`healthy → unauthorized drift → investigate → plan → approve → simulate → execute → verify → healthy → audit complete`

## 12. State and API rules

- TanStack Query owns server records and keys include organization and protocol.
- Zustand owns ephemeral navigation, selection, demo, and onboarding resume state.
- React Hook Form owns form state.
- URL parameters own shareable route and future filter state.
- Components call the typed SDK only.
- Mock transport and MSW implement the same HTTP contract.
- `NEXT_PUBLIC_AETHER_DATA_MODE=mock` is the default.
- `NEXT_PUBLIC_AETHER_DATA_MODE=api` switches transport without component rewrites.

## 13. Accessibility and responsiveness

- All critical actions are keyboard operable with visible focus.
- Status always has icon and text, never color alone.
- Dialogs and drawers trap focus, close with Escape, and restore focus.
- Progress updates use live regions without excessive announcements.
- Reduced motion disables smooth scrolling, parallax, pulses, and nonessential 3D.
- WebGL failure uses the static brand field.
- Tables have useful mobile card alternatives.
- Operation graphs have an accessible vertical step list.

## 14. Non-goals

No multi-protocol portfolio, broad settings center, team administration, notification
center, API key UI, generalized policy builder, standalone approval queue, standalone
incident module, backend, worker, smart-contract deployment, live GitHub/OpenAI/
KeeperHub/RPC integration, mainnet execution, billing, or enterprise governance.

## 15. Acceptance

The MVP is accepted when all retained routes are coherent in mock mode, all six
scenarios are deterministic, the primary journey updates every affected view, removed
routes are absent or intentionally redirected, and formatting, lint, type checks,
unit tests, production build, and available browser checks are reported truthfully.
