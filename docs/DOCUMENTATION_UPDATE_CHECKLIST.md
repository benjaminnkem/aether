# Documentation Update Checklist

Codex must reconcile documentation with actual code after the live-completion pass.

## Must update

- root `README.md`;
- `AGENTS.md`;
- main PRD;
- architecture documentation;
- frontend architecture;
- frontend routes;
- environment;
- integrations;
- operations/runbook;
- security;
- setup;
- testing;
- accessibility when authentication or UI states change;
- implementation status;
- visual review;
- post-MVP roadmap;
- API/OpenAPI documentation;
- contract deployment documentation.

## Must add

- `docs/PRODUCTION_READINESS.md`;
- `docs/NO_RUNTIME_MOCKS.md`;
- `docs/LIVE_TESTNET_UI_TEST_FLOW.md`;
- `docs/MANUAL_EXTERNAL_ACTIONS.md`;
- `docs/LIVE_ACCEPTANCE_EVIDENCE.md`;
- `docs/INCIDENT_RECOVERY_RUNBOOK.md`;
- `docs/ENVIRONMENT_VALIDATION.md`.

## Must delete or rename

- `docs/MOCK_SCENARIOS.md` after useful failure cases are moved into testing documentation;
- documentation that tells users to run browser/provider mock mode;
- prompt files that instruct future work to preserve mock mode;
- stale claims that live providers were verified when they were not.

## Required consistency checks

Search the repository for:

```text
NEXT_PUBLIC_AETHER_DATA_MODE
AETHER_PROVIDER_MODE
mock transport
MSW
Demo controls
scenario
advance
org-arcadia
exec-kh-8314
op-oracle-restoration
fake transaction
seeded
memory persistence
KEEPERHUB_WORKFLOW_ID
```

Every remaining match must be classified and justified. Test-only occurrences are acceptable. Runtime or user-documentation occurrences are not.

## README minimum content

The README must state:

- what Aether does;
- testnet-only safety notice;
- architecture;
- prerequisites;
- external accounts required;
- setup commands;
- environment doctor;
- Ethereum Sepolia deployment;
- how to run the full UI flow;
- real KeeperHub proof;
- test commands;
- limitations;
- no mainnet claim.
