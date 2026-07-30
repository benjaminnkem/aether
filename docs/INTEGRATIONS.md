# Integrations

The worker exposes identical typed mock/live boundaries for EVM observation,
exact-request simulation, KeeperHub submission/reconciliation, and read-only GitHub
release provenance. Every response is runtime validated before entering domain state.

KeeperHub receives a server-generated correlation/idempotency value and exact plan
hash. Aether persists that intent before the call, independently checks status after
submission, and verifies the oracle through the chain reader. KeeperHub is execution
transport, not an authority boundary.

The JSON-RPC adapter performs block-pinned `eth_call` observations and validates RPC
envelopes, block identity, address encoding, and verification results. The MVP permits
only the configured test-chain `setOracle(address)` correction with zero value.

The GitHub adapter is read-only and resolves release provenance to a 40-character
commit SHA. Its optional token is server-only. Safe/governance remains authority
metadata; signing integration is excluded. An investigation assistant remains
post-MVP and would be advisory/schema-validated only.
