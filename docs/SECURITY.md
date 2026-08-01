# Security

The API issues short-lived access cookies and rotating refresh cookies after Argon2id
credential verification. Refresh token hashes, families, expiry, replay revocation,
login lockout/rate limits, one-time verification/reset challenges, and auth audit
events are stored in MongoDB. Cookie mutations require a double-submit CSRF token.
Every protected request revalidates membership/protocol records and rejects
organization/protocol mismatches before controller work. Roles are enforced at
mutations: owners/operators configure and execute; owners/reviewers approve; viewers
are read-only. There is no development identity bypass.

Execution authorization is deterministic. It validates the exact transaction schema,
chain, target, `setOracle(address)` function, zero value, configured maximum value,
successful exact-plan simulation, matching plan hash, distinct approval identities,
simulation binding, threshold, and expiry. The worker persists execution intent and
provider correlation before the external submit. Duplicate jobs read durable state.
Unknown outcomes take a retry lock and can only advance through reconciliation.

The backend obtains `setOracle(address)` and `oracleStatus()` selectors from generated
Foundry artifacts and independently re-encodes the desired oracle before authorization.
The fixture supports only chain IDs `31337` and `11155111`. The proxy implementation is
initializer-locked, initialization grants `DEFAULT_ADMIN_ROLE` to the administrator,
`ORACLE_ADMIN_ROLE` only to the KeeperHub correction wallet, and the separate
`DRIFT_FIXTURE_ROLE` to the drift actor. Oracle targets must have deployed code. The
drift method rejects every chain except Anvil and Ethereum Sepolia.

Every provider response is parsed with Zod before use. An LLM has no authority or
signing boundary in this phase. No private key is accepted or stored. Protocol setup
rejects credential-, secret-, token-, mnemonic-, signature-, and private-key-shaped
fields. Live provider credentials remain server-only.

Stored provider credentials use AES-256-GCM envelopes with random nonces and
organization/protocol/provider identity as authenticated associated data. The
encryption key is supplied separately as a base64-encoded 32-byte server secret and is
never stored in MongoDB. Provider credential fields are excluded from normal queries.

Logs use Nest JSON output and recursively redact authorization, cookies, credentials,
tokens, secrets, seeds, mnemonics, signatures, and private keys. Audit/outbox payloads
retain identifiers and redacted evidence, not raw headers or credentials.

Confirmed writes that fail verification become `partial` with a linked
forward-correction operation. No endpoint or event claims rollback. CORS is an exact
origin list, Helmet supplies HTTP hardening headers, production requires a strong JWT
secret, and MongoDB transactions require a replica set.

Provider HTTP retries are bounded and allowed only for reads or explicitly idempotent
requests. KeeperHub submission carries a persisted idempotency key. A 429 honors
`Retry-After`; provider URLs are logged without query strings, and headers/bodies are
not placed in observability events.

The contracts are unaudited test fixtures, custody no value, and are prohibited from
mainnet or production protocol use. Deployment scripts contain no signing material.
ABIs and public addresses are server-side artifacts; credentials and signing material
must remain in an operator keystore, hardware wallet, or secret manager and never
appear in browser variables, fixtures, screenshots, or logs.
