# Integrations

The worker exposes identical typed mock/live boundaries for EVM observation,
exact-request simulation, KeeperHub submission/reconciliation/logs, read-only GitHub
provenance, and optional OpenAI evidence assistance. Every response is runtime
validated before entering domain state. All adapters expose health state and share
timeouts, bounded idempotent retry, rate-limit handling, and redacted telemetry.

KeeperHub receives a server-generated correlation/idempotency value, exact plan hash,
and exact transaction request. Aether uses `POST /api/execute/contract-call` with
`simulate: true`, then submits the pre-reviewed workflow through
`POST /api/workflows/{workflowId}/execute`. It reads status and transaction correlation
from `/api/workflows/executions/{executionId}/status` and redacted node evidence from
the logs endpoint. Aether persists intent before the call and verifies through the
chain reader. KeeperHub is execution transport, not an authority boundary.

The JSON-RPC adapter performs block-pinned `eth_call` observations and validates RPC
envelopes, chain identity, block identity, ABI tuple encoding, receipt status,
confirmations, canonical receipt hashes, and verification results. It calls the
generated `oracleStatus()` selector and requires both the desired address and a fresh
source after finality. The MVP permits only the configured test-chain
`setOracle(address)` correction with zero value.

Foundry produces `ArcadiaMarket` and `MockOracle` ABIs, method identifiers, and public
deployment data in the `@aether/contracts/server` export. The safety package consumes
this artifact to build and validate exact calldata. This export is intentionally not
referenced by any browser package.

The GitHub adapter is read-only and validates repository metadata, releases,
40-character commit SHAs and verification state, and pull-request head/base provenance.
Its optional token is server-only. Safe/governance remains authority metadata; signing
integration is excluded.

The optional OpenAI Responses API adapter returns only a strict schema-validated
evidence summary and typed `setOracle(address)` suggestion marked `advisoryOnly`.
It cannot emit approvals, policy mutations, signatures, provider calls, or verification
results. Invalid/refused/missing structured output is rejected.
