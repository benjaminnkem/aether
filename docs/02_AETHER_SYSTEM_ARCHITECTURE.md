# Aether System Architecture

## Runtime topology

```mermaid
flowchart LR
  B[Browser] --> S[@aether/sdk Axios]
  S --> A[NestJS API]
  A --> M[(MongoDB replica set)]
  A --> E[SSE durable cursor]
  M --> O[Transactional outbox]
  O --> Q[(Redis / BullMQ)]
  Q --> W[NestJS worker]
  W --> R[Ethereum Sepolia RPC]
  W --> K[KeeperHub Direct Execution]
  W --> AI[OpenAI Responses API]
  A --> G[GitHub App API]
```

MongoDB is mandatory for every non-test API and worker process. Isolated unit tests may
use test doubles, but production bundles cannot import them. Domain writes, audit
evidence, and queue intent use durable records; BullMQ job IDs and provider
idempotency keys are stable.

## Identity and tenancy

Users authenticate with Argon2id credentials, short access cookies, rotating hashed
refresh sessions, replay-family revocation, CSRF tokens, and Mongo-backed throttling.
Every protected request revalidates membership and protocol ownership. Organization,
membership, protocol, network, contract, desired state, provider connection,
observation, finding, investigation, plan, approval, execution, audit, and outbox data
are real records with generated IDs.

## Execution safety

Deterministic code produces exact calldata and hashes the request/plan. The simulation
must match sender, target, value, plan hash, and non-revert result. Approvals bind plan
and simulation IDs and expire. Submission intent and provider correlation are
persisted before the single direct call. Ambiguous outcomes lock resubmission and enter
status reconciliation. Confirmation never substitutes for postcondition verification.

## Recovery

Outbox events have monotonic durable sequences. Duplicate publication is safe because
queue jobs and execution writes are idempotent. Restart and unknown-submit procedures
are in [the incident runbook](INCIDENT_RECOVERY_RUNBOOK.md).
