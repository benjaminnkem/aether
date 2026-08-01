# Live Acceptance Evidence

Evidence date: 2026-08-01.

## Current evidence

- KeeperHub authentication, Ethereum Sepolia enabled/testnet, and organization-wallet
  configuration passed before the doctor reached the RPC mismatch gate.
- KeeperHub organization wallet: configured; address stored locally as the executor
  public address without being printed here.
- Ethereum Sepolia RPC: failed validation because the configured endpoint reported another
  chain.
- Ethereum Sepolia deployment: not broadcast.
- GitHub App authentication/identity: passed.
- OpenAI authentication and configured-model availability: passed.
- KeeperHub simulation/execution: not run because no live deployment/desired state is
  available.
- Transaction link and independent verification: none.
- Local static/unit/build/security gates: passed.
- Isolated Mongo replica-set API integration: 2 passed.
- Playwright Chromium desktop/mobile smoke: 8 passed; 2 protected live cases skipped.
- Production dependency audit: no known vulnerabilities.

## Verdict

`ETHEREUM SEPOLIA MIGRATION CODE-COMPLETE — LIVE BROADCAST BLOCKED`

The evidence directory is created by the opt-in live acceptance command only after real
provider calls. No placeholder transaction, execution, provider health, or screenshot
is generated.
