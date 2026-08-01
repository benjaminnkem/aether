# Aether Roadmap

## Purpose

This roadmap separates what is required for a live testnet release from what belongs to later product expansion.

The previous roadmap mixed already-implemented architecture, missing live-provider acceptance, and enterprise features. It must not be interpreted as “implement every possible feature before the hackathon.”

## Release 1 — Live testnet MVP

Required now. Runtime/auth/persistence/provider code is implemented; external
deployment and acceptance evidence remain open:

- no runtime mock path;
- real authentication and session lifecycle;
- real organization/protocol onboarding;
- real MongoDB/Redis/worker persistence;
- Ethereum Sepolia deployment;
- real RPC observation;
- real GitHub provenance;
- real OpenAI advisory investigation;
- real KeeperHub simulation and direct execution;
- independent post-finality verification;
- immutable audit correlation;
- full UI test flow;
- complete Playwright execution;
- live acceptance evidence and transaction link;
- operational setup, env doctor, provider doctor, recovery runbook.

This release remains testnet-only and does not custody user value.

## Release 1.1 — Operational hardening

Complete after the live flow is stable:

- second RPC provider for critical reads;
- scheduled scans and event-driven scans;
- approval revocation and expiry UX;
- provider alert delivery;
- backup/restore drill;
- worker crash/restart chaos tests;
- hosted observability dashboards;
- security headers/CSP review;
- deployment rollback for application services only;
- rate-limit and abuse dashboards.

## Release 2 — Team and governance authority

Not required for the hackathon:

- multiple organizations and protocols in the UI;
- member invitation and service accounts;
- Safe proposal creation and execution semantics;
- governance proposal ingestion;
- reusable policy/invariant libraries;
- dedicated approval queue;
- richer release/canary coordination.

## Release 3 — Enterprise

Not required for the hackathon:

- SSO/SAML;
- billing;
- API keys and external webhooks;
- audit exports and retention controls;
- compliance reporting;
- additional execution providers;
- non-EVM adapters;
- private deployment;
- contractual SLAs.

## Mainnet readiness

Mainnet is prohibited until:

- contracts and application receive independent security review;
- authority/signing model is finalized;
- Safe/governance integrations are tested;
- incident response is rehearsed;
- limits and canary controls are staged;
- backups and disaster recovery are validated;
- legal/compliance implications are reviewed.

## Re-entry rule

A future feature needs:

- validated user need;
- threat model;
- typed backend contract;
- authorization model;
- UI owner;
- accessibility requirements;
- test plan;
- operational runbook;
- evidence that it cannot be served by an existing MVP surface.
