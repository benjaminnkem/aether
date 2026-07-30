# Frontend Routes

## Public and support

- `/` — landing, product narrative, security model, and demo entry.
- `/login` — sign in.
- `/signup` — optional account creation.
- `/onboarding` — eight-step minimal protocol setup.
- `/unauthorized` — explicit access-denied support state with no mutation claim.
- framework `not-found` and `error` states.

Product, Security, and How it works are anchors on `/`, not separate routes.

## Authenticated

- `/app/overview`
- `/app/protocol-setup`
- `/app/desired-state`
- `/app/drift`
- `/app/operations/op-oracle-restoration`
- `/app/executions/exec-kh-8314`
- `/app/audit-log`

The operation and execution identifiers are dynamic route parameters. The mock service
exposes one deterministic record of each.

## Sidebar

Only Overview, Protocol Setup, Desired State, Drift, and Audit Log appear. Operation
and execution details are opened from contextual links.

## Intentional compatibility redirects

Legacy protocol setup, contracts, deployments, integrations, desired-state, drift,
incidents, operations, approvals, invariants, policies, execution settings, and
KeeperHub-run paths redirect to the closest retained route. Old team, notification,
security-settings, and API-key paths return not found.
