# Security

The API authenticates a signed tenant context and rejects organization/protocol
mismatches before controller work. Roles are enforced server-side at contextual
mutations: owners/operators configure and execute; owners/reviewers approve; viewers
are read-only. The development identity is unavailable unless
`AETHER_AUTH_MODE=development`.

Execution authorization is deterministic. It validates the exact transaction schema,
chain, target, `setOracle(address)` function, zero value, configured maximum value,
successful exact-plan simulation, matching plan hash, distinct approval identities,
simulation binding, threshold, and expiry. The worker persists execution intent and
provider correlation before the external submit. Duplicate jobs read durable state.
Unknown outcomes take a retry lock and can only advance through reconciliation.

Every provider response is parsed with Zod before use. An LLM has no authority or
signing boundary in this phase. No private key is accepted or stored. Protocol setup
rejects credential-, secret-, token-, mnemonic-, signature-, and private-key-shaped
fields. Live provider credentials remain server-only.

Logs use Nest JSON output and recursively redact authorization, cookies, credentials,
tokens, secrets, seeds, mnemonics, signatures, and private keys. Audit/outbox payloads
retain identifiers and redacted evidence, not raw headers or credentials.

Confirmed writes that fail verification become `partial` with a linked
forward-correction operation. No endpoint or event claims rollback. CORS is an exact
origin list, Helmet supplies HTTP hardening headers, production requires a strong JWT
secret, and MongoDB transactions require a replica set.

Current MVP limitation: authentication uses a locally verified JWT boundary rather
than a selected external identity provider. Production deployments must integrate
token issuance and revocation at that boundary.
