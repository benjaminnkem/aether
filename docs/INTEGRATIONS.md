# Live Integrations

## Global requirements

Every provider adapter must:

- have a strict request and response schema;
- expose health and configuration state;
- use bounded timeouts;
- retry only safe/idempotent operations;
- honor provider rate-limit headers;
- propagate request/correlation IDs;
- redact secrets;
- persist evidence required for reconciliation;
- never fall back to mock data.

## KeeperHub

KeeperHub is the execution transport, not Aether’s authority boundary.

### Canonical correction path

1. Call `GET /api/chains`.
2. Confirm chain ID `11155111` is enabled and marked testnet.
3. Build the exact transaction request deterministically from generated ABI artifacts.
4. Persist plan hash, request hash, chain, target, function, arguments, value, approval binding, and idempotency key.
5. Call `POST /api/execute/contract-call` with the exact request plus `simulate: true`.
6. Require `success: true` and `wouldRevert: false`.
7. Bind the simulation evidence to the immutable operation and approval.
8. Remove only the `simulate` field.
9. Submit the same request once with `Idempotency-Key`.
10. Persist the returned direct execution ID immediately.
11. Call `GET /api/execute/{executionId}/status`.
12. Honor `X-Poll-Interval-Hint`.
13. Persist terminal status, transaction hash, transaction link, gas evidence, and provider request IDs.
14. Independently verify receipt, finality, canonical block, oracle address, and freshness through Aether’s RPC adapter.

### Unknown outcome

A timeout after submission is not a failure and not permission to resubmit.

- mark execution `unknown`;
- lock automatic resubmission;
- query KeeperHub using the persisted execution/correlation/idempotency evidence;
- query the chain for matching evidence;
- move to `reconciling`;
- resolve to failed, submitted, confirmed, partial, or verified.

### Safe limitation

KeeperHub simulation may use the organization EOA rather than Safe `msg.sender` semantics. Aether must show this limitation and must not call a simulation “Safe-accurate” unless it is actually executed from the same authority context.

## RPC

The RPC adapter must:

- validate `eth_chainId`;
- pin reads to explicit block numbers;
- bound log ranges;
- validate JSON-RPC envelopes;
- verify receipt status;
- wait for configured confirmations;
- check canonical block hashes;
- detect reorgs;
- re-read `oracleStatus()` at a post-finality block;
- treat missing receipts as unknown;
- use a second RPC provider for critical verification when configured.

## GitHub

Preferred production path: GitHub App installation.

Required capabilities:

- signed, one-time installation state and post-installation Setup URL flow;
- signed webhook verification;
- installation-token generation and rotation;
- repository selection;
- default branch metadata;
- exact 40-character commit SHA;
- pull-request head/base provenance;
- release/tag provenance;
- desired-state file fetch;
- idempotent webhook delivery handling;
- delivery-ID audit correlation;
- read-only permissions unless a separate future feature is approved.

An operator-managed fine-grained token mode may be added only when explicitly
labelled; it must never be represented as a GitHub App installation.

The installation webhook and browser redirect have different responsibilities.
Webhooks authenticate provider events but do not contain Aether's tenant-bound
`state`; only the Setup URL callback may bind an installation to an organization and
protocol. After persistence, the API issues a `303` redirect to Protocol Setup and the
frontend invalidates the active tenant dashboard query. Installation repository lists
are paginated until GitHub's reported `total_count` is reached.

## OpenAI

The OpenAI adapter must:

- use the current official Responses API;
- request strict structured output;
- pass only bounded, redacted evidence;
- mark every result `advisoryOnly`;
- separate facts, inferences, uncertainty, and recommended action;
- reject invalid/refused/missing structured output;
- never produce or authorize signatures, approvals, provider calls, or verification;
- never receive provider credentials, raw cookies, private keys, mnemonics, or unredacted logs.

Deterministic code must independently validate every suggested target/function/argument.

## Authentication and email

Authentication is a first-party NestJS capability for this release:

- Argon2id password hashes;
- access and rotating refresh tokens;
- hashed refresh sessions;
- HttpOnly/Secure/SameSite cookies;
- CSRF protection;
- immediate authenticated signup;
- password reset;
- session revocation;
- brute-force rate limiting;
- security audit events.

Mailpit is used locally. Hosted environments require real SMTP credentials.
