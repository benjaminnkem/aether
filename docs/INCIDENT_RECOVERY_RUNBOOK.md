# Incident Recovery Runbook

## Unknown KeeperHub submission

1. Do not create a new idempotency key and do not resubmit.
2. Confirm the execution row is `unknown` or `reconciling` with `retryLocked=true`.
3. Query `GET /api/execute/{executionId}/status` using the persisted direct execution
   ID. Honor `X-Poll-Interval-Hint`.
4. Query Base Sepolia independently for the persisted target/request evidence.
5. Resolve only to failed, submitted, confirmed, partial, or verified based on real
   evidence. A missing receipt remains unknown.

## Worker/Redis restart

MongoDB is canonical. Restart Redis, then the worker. The outbox publisher republishes
unpublished records with stable job IDs. Confirm duplicate deliveries did not create a
second execution intent or KeeperHub idempotency key.

## API restart or browser reconnect

Restart the API and reconnect SSE using the last durable sequence. Reloading a detail
URL reads MongoDB by its real resource ID; browser state must not advance an operation.

## Reorg or stale postcondition

If the receipt block is no longer canonical, return to reconciliation. If the write is
canonical but `oracleStatus()` is stale or points elsewhere, mark the execution
`partial` and create an explicit forward-correction operation. Never claim rollback.

## Credential compromise

Revoke the provider key at its platform, rotate the corresponding server secret,
revoke Aether refresh-session families, and inspect correlated audit/provider request
IDs. Never place the compromised value in an incident ticket.
