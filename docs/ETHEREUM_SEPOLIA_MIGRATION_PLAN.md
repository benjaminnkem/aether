# Ethereum Sepolia Migration Plan

Evidence date: 2026-08-01.

## Objective and invariants

Move Aether's only live target from Base Sepolia (`84532`, `0x14a34`) to Ethereum
Sepolia (`11155111`, `0xaa36a7`, `ethereum-sepolia`) while retaining Anvil `31337`
for local integration and explicitly rejecting Ethereum mainnet `1`. Historical Base
Sepolia deployment and audit evidence must remain historical; no record or artifact is
to be relabelled as Ethereum Sepolia.

## Initial reference inventory

The pre-change audit found active Base Sepolia assumptions in:

- runtime chain allowlists and defaults in `packages/shared`, `packages/backend`,
  `apps/api`, and `apps/worker`;
- API onboarding/network creation, desired-state parsing, operation construction, RPC
  validation, provider health, and response labels;
- worker observation, safety policy, RPC validation, KeeperHub chain validation, and
  explorer-link construction;
- KeeperHub simulation and provider-contract tests;
- frontend onboarding, Protocol Setup, Overview, Desired State, Drift, Operation
  Detail, KeeperHub Execution, Testnet Lab instructions, marketing copy, explorer
  links, and Playwright expectations;
- Foundry `ScriptBase.sol`, deployment checks, package scripts, and the historical
  `packages/contracts/deployments/84532.json` registry;
- environment schema/example, `env:doctor`, `chain:doctor`, `keeperhub:doctor`, live
  acceptance, deployment automation, and CI defaults;
- API, worker, backend, UI, provider, environment, and authorization tests using
  `84532`, `0x14a34`, Base labels, or Basescan URLs;
- the PRD, architecture, assumptions, environment, integrations, operations,
  security, setup, testing, production-readiness, live flow, roadmap, recovery,
  evidence, status, manual-actions, and historical implementation prompts.

The only Base-specific deployment registry is
`packages/contracts/deployments/84532.json`. It is an undeployed historical artifact
and will be retained, marked inactive, rather than rewritten. No runtime seed is
allowed to create a Base environment. Existing MongoDB Base records, if present, are
historical input to an explicit additive migration only.

## Central configuration

Create one browser-safe chain registry in `@aether/shared` containing numeric/hex ID,
slug, display name, explorer, native currency, finality, testnet, execution,
deployment, prohibition, and RPC environment-variable metadata. API, worker, backend,
SDK, UI, doctors, and TypeScript tests consume it. Backend policy remains authoritative
for execution. Solidity scripts import one Solidity chain constant because Solidity
cannot consume the TypeScript module; generated deployment artifacts remain the
address authority.

Supported release entries:

- Anvil: `31337`, local integration only;
- Ethereum Sepolia: `11155111`, live testnet;
- Ethereum mainnet: `1`, prohibited and absent from supported execution targets.

Base Sepolia is deliberately absent from active supported chains.

## Data and desired-state migration

Add an explicit dry-run-by-default MongoDB migration. It must never rewrite Base
records. When applied, it creates a new Ethereum Sepolia network/environment for a
selected persisted protocol only after a real Ethereum Sepolia deployment registry
exists; contract and desired-state records are created from that registry with new
IDs and provenance. Existing observations, findings, operations, simulations,
approvals, executions, and audits remain chain-bound historical records. Plan/request
hashes include the new chain and addresses, so Base evidence cannot authorize an
Ethereum Sepolia write.

## Migration order

1. Back up `.env` into the Git-ignored `.env.backups` directory and inventory values
   by name/status only.
2. Add the central chain registry and change schema/policy authority to Ethereum
   Sepolia.
3. Migrate API, worker, providers, SDK/UI, explorer links, SSE payloads, and error
   language to registry-backed metadata.
4. Add an additive data migration and invalidate cross-chain simulation/approval
   reuse through tests.
5. Update Foundry deployment guards and create a fresh `11155111` registry without
   reusing Base addresses.
6. Migrate environment tooling, doctors, deployment/live-acceptance scripts, CI, and
   `.env.example`; preserve credentials and never fabricate RPC/signing/funds.
7. Update all tests and documents, then run static, integration, security, Foundry,
   Playwright, build, audit, and focused chain/provider checks.
8. If an authorized funded signer and valid providers are available, dry-run,
   broadcast, and execute the real lifecycle. Otherwise record the exact external
   action and use the required blocked verdict.

## Risks and controls

- **Cross-chain authorization:** every plan, request, simulation, approval, execution,
  and verification remains bound to chain ID and deployment address; explicit tests
  reject Base evidence.
- **Wrong RPC/mainnet:** startup and doctors require `0xaa36a7`; chain `1`, `84532`,
  or any mismatch fails closed.
- **Address reuse:** the Ethereum registry starts undeployed with no contract address;
  broadcast output alone may populate it.
- **Ambiguous submit:** persisted intent/idempotency and unknown-outcome retry locks
  remain unchanged.
- **Historical integrity:** migration is additive and dry-run by default; old audit and
  chain records are not relabelled.
- **Provider capability:** KeeperHub `/api/chains`, wallet readiness, Sepolia balance,
  and role checks must pass before execution is enabled.

## External actions

Only external authority boundaries may remain: a reliable Ethereum Sepolia RPC, an
authorized funded Foundry keystore/hardware signer, Sepolia ETH for the deployer and
KeeperHub wallet, and any unavailable provider credentials/hosted callback or SMTP
configuration. The exact current list and continuation commands are maintained in
`MANUAL_EXTERNAL_ACTIONS.md`; no secret values are recorded.

## Verification plan

- prove no active runtime `84532`, `0x14a34`, Base Sepolia, Basescan, or Base-specific
  public explorer variable remains;
- prove Ethereum Sepolia accepted, Base/mainnet/mismatched RPC rejected, bytecode and
  proxy slots checked, receipt/finality/reorg/oracle postconditions verified;
- prove KeeperHub requests use `11155111`, Etherscan links, balance/role readiness,
  idempotency, and unknown-outcome locking;
- prove chain/address changes invalidate simulations and approvals;
- retain Anvil `31337` Foundry/local integration coverage;
- run all repository gates and record only commands that actually ran.
