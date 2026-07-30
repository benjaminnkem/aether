# Aether Post-MVP Roadmap

This file protects the MVP boundary. Items below are intentionally deferred and must
not be reintroduced into the current navigation or data model without a new product
decision.

## Phase 2 — Live MVP services

- NestJS API and worker implementing the reduced module set.
- MongoDB, Redis/BullMQ, outbox, idempotency, SSE, and audit persistence.
- Read-only GitHub and EVM observation adapters.
- KeeperHub simulation/execution adapter behind deterministic authorization.
- Schema-validated investigation assistant with no signing authority.
- Testnet-only demo contracts and verification scripts.

## Phase 3 — Operational depth

- Multiple protocol environments within one organization.
- Scheduled scans, provider failover, richer observation evidence.
- Approval expiry/revocation and stronger authentication.
- Forward-correction authoring and reconciliation operations.
- Delivery integrations for critical alerts, without a broad in-app notification center.

## Phase 4 — Portfolio and governance

- Multiple organizations and protocol portfolio views.
- Team and service-account administration.
- Reusable policy and invariant libraries.
- Standalone approval work queues when volume justifies them.
- Governance and Safe proposal integrations.

## Phase 5 — Enterprise and ecosystem

- API keys, webhooks, retention controls, exports, billing, and SSO.
- Additional execution providers and non-EVM observation adapters.
- Advanced analytics and compliance reports.
- Mainnet enablement only after security review, operational runbooks, and staged limits.

## Re-entry rule

A deferred feature must have a validated user need, explicit security model, typed
backend contract, route owner, accessibility specification, test plan, and evidence
that it cannot be served contextually by one of the seven MVP product areas.
