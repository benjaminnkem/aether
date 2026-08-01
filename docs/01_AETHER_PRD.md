# Aether MVP Product Requirements

## Product outcome

Aether detects when a configured Ethereum Sepolia protocol diverges from immutable desired
state and safely carries one allowlisted `setOracle(address)` correction from evidence
to independently verified finality.

## Required lifecycle

```text
desired state → pinned observation → drift → advisory investigation
→ immutable deterministic plan → KeeperHub simulation → contextual approval
→ persisted intent → direct execution → reconciliation → receipt/finality
→ independent oracleStatus verification → resolved or forward correction → audit
```

## Product areas

The focused application retains Overview, Protocol Setup, Desired State, Drift,
Operation Detail, KeeperHub Execution, and Audit Log. Signup, verification, login,
password recovery, onboarding, and session management support those areas.

## Trust boundaries

- Aether owns tenant authorization, policy, plan immutability, approval, idempotency,
  unknown-outcome locking, and verification.
- OpenAI is advisory only. It does not construct authoritative calldata or execute.
- KeeperHub signs and broadcasts only after exact-request simulation and approval.
- GitHub App access is read-only provenance evidence.
- RPC observations are pinned, chain-checked, and independently repeated after writes.
- The fixture is unaudited, testnet-only, and must never custody real value.

## Acceptance

Acceptance requires actual chain `11155111` deployment evidence, a real drift transaction,
a valid OpenAI structured investigation, a successful KeeperHub simulation, a real
direct execution and transaction link, finality, an independent postcondition read, a
correlated audit trail, restart recovery, and passing Playwright. A code-complete
migration blocked by external signing, funding, or RPC authority is reported as
`ETHEREUM SEPOLIA MIGRATION CODE-COMPLETE — LIVE BROADCAST BLOCKED`, never as a live
release.

Enterprise administration, billing, SSO, customer webhooks, generic workflows,
non-EVM chains, mainnet, and compliance reporting remain deferred.
