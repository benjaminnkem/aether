# No Runtime Mocks Policy

## Objective

Aether must not contain a runtime product mode that fabricates provider, database, identity, chain, operation, or execution behavior.

## Remove

Remove from runtime code and production dependencies:

- `NEXT_PUBLIC_AETHER_DATA_MODE`;
- `AETHER_PROVIDER_MODE`;
- direct mock transport;
- MSW startup in the application;
- `packages/mock-data` as an application package;
- demo controls;
- scenario selectors;
- scenario/advance API endpoints;
- in-memory product state machines;
- seeded fake transaction hashes;
- seeded fake GitHub provenance;
- seeded fake KeeperHub execution rows;
- fake AI investigations;
- fake provider health;
- implicit fallback to a sample organization or protocol;
- API startup that silently chooses memory persistence;
- any “success” response generated because a real provider is unavailable.

## Keep only in test scope

The following are allowed only under test directories/configuration and must never be bundled into the deployed application:

- unit-test mocks and spies;
- HTTP contract fixtures;
- ephemeral in-memory repositories used by isolated tests;
- Anvil;
- Mailpit;
- deterministic Foundry fixtures;
- recorded provider response fixtures with secrets removed;
- fault-injection providers;
- Playwright test data created through real API calls.

MSW may remain only if imported exclusively by tests or Storybook and omitted from production builds.

## Fail-closed behavior

When configuration is missing:

- API health reports the provider as `not_configured`;
- mutations requiring that provider return a typed `503 provider_not_configured`;
- the UI displays setup instructions;
- no fake data is substituted;
- no write action is enabled.

When a provider is down:

- reads may retry only when safe and bounded;
- writes must not be blindly retried;
- uncertain KeeperHub submissions enter reconciliation;
- the UI shows the real degraded state.

## Verification

Codex must prove runtime mock removal by:

1. searching for `mock`, `msw`, `scenario`, `demo controls`, fake hashes, and mode switches;
2. classifying every remaining occurrence as test-only, documentation, or a bug;
3. building the production frontend and inspecting its dependency graph;
4. starting the stack with an empty database and confirming no sample records appear;
5. starting without provider credentials and confirming explicit configuration errors;
6. creating all acceptance data through live UI/API actions.
