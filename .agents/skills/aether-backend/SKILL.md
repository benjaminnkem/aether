---
name: aether-backend
description: Implement and audit Aether's NestJS API, worker, MongoDB/Mongoose, Redis/BullMQ, outbox, idempotency, authorization, realtime events, and provider adapters.
---

# Aether Backend Skill

Read the PRD and system architecture. Keep request handlers short and background work durable.

## Rules

- Strict tenant isolation and server-enforced RBAC.
- MongoDB local; document indexes and transaction boundaries.
- BullMQ at-least-once consumers must be idempotent.
- Use transactional outbox and reconciliation for side effects.
- Persist external execution intent/idempotency before retrying.
- Enforce domain state machines and immutable plan/desired-state versions.
- AI output is untrusted and cannot authorize execution.
- SSE streams are resumable and tenant-safe.
- Every external provider has mock and live adapters.
- Run unit, integration, build, and API-mode frontend tests.
