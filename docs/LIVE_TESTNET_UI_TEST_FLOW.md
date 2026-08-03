# Live Testnet UI Test Journal

Evidence date: 2026-08-03

This file is the chronological record of the current UI-driven acceptance run. It
contains no passwords, provider secrets, cookies, private keys, or unredacted tokens.
The runtime path under test is browser → typed SDK → API → MongoDB/outbox → worker →
live providers.

## Safety boundaries

- Ethereum Sepolia `11155111` only; Ethereum mainnet remains prohibited.
- Aether performs GitHub reads only. The live GitHub App is currently over-privileged
  with `contents: write` and must be reduced to read-only by its owner.
- OpenAI output remains advisory and cannot authorize execution.
- A blockchain submission is not successful until independently verified.
- Unknown outcomes lock resubmission; confirmed writes use forward correction, never
  fictional rollback.

## Chronological run

### Step 1 — Reset the acceptance journal

Status: **passed**

The historical checklist was replaced by this live journal before beginning browser
testing, as requested. Credentials supplied for the run are used only in the browser
and are not persisted in this document or repository.

### Step 2 — Establish the local runtime

Status: **passed**

MongoDB replica set, Redis, and Mailpit report healthy. The Next.js web application,
NestJS API, and standalone NestJS worker are running. `GET /v1/health` returned the
API health payload without exposing configuration.

### Step 3 — Verify anonymous landing and authenticate through the UI

Status: **passed after repair**

The anonymous landing exposed only Sign in/Create account actions and no demo/testnet
control. UI login succeeded with the supplied Aether account. The session endpoint
returned the persisted owner membership and dashboard destination without returning a
token.

Initial Overview loading failed because dashboard hooks trusted stale persisted Zustand
tenant IDs instead of the authenticated session. The hooks were repaired to use the
session-bound organization/protocol and to defer dashboard requests until that context
exists. The focused frontend test and TypeScript check passed. After reload, the UI
showed `my org / my protocol`, owner role, connected realtime state, live resource
counts, 100% desired alignment, and healthy GitHub/KeeperHub connections.

### Step 4 — Verify Protocol Setup and connected GitHub provenance

Status: **passed after repair**

All five setup steps were opened in the browser. General retained the protocol,
environment, and governance values. Networks retained Ethereum Sepolia `11155111`.
Contracts retained the validated proxy resource. GitHub retained installation
`150938893`, repository `daniel-oluwadunsin/aether-demo-protocol`, branch `main`, and
path `aether/desired-state.yaml`. Aether used only read endpoints, but the final provider
doctor proved the GitHub App itself currently grants `contents: write`; that external
least-privilege correction is recorded in Step 11. KeeperHub reported a
funded wallet, correction role, Sepolia support, and simulation readiness; the live
validation action completed.

The Network and Contract tables had empty evidence columns. They now expose RPC
verification freshness and scannable proxy, implementation, ABI, and owner evidence.

### Step 5 — Verify GitHub-backed Desired State

Status: **passed after implementation**

The product previously persisted only repository metadata and did not load desired
state content from GitHub. A tenant-bound API/SDK/UI flow now mints a short-lived
installation token, resolves `main` to exact commit
`f3c7955181aaad913e3cf6bdf6b875d311fe53a7`, fetches and validates the YAML, maps the
repository resource `arcadia-market` to the tenant contract, and compares its
canonical manifest hash with the active version.

The UI showed the pinned repository/branch/path/commit and mapping. The repository
version already matched the active approved version, so the action was correctly
disabled rather than creating a duplicate version.

### Step 6 — Run a real Sepolia observation scan

Status: **passed after repair**

The first UI scan exposed a permanent idempotency-key bug: every deliberate scan used
the same BullMQ job ID, so later scans were acknowledged but never rerun. Scan actions
now use a fresh operation key while HTTP retries preserve the same key.

The next scan exposed the RPC provider's free-tier ten-block `eth_getLogs` limit. Log
reads are now provider-safe and configurable. A fresh scan then pinned Sepolia block
`11410671` and persisted a critical oracle drift finding. The drawer showed both the
observed and GitHub-approved oracle addresses plus the pinned block.

### Step 7 — Run advisory investigation

Status: **blocked externally, failure handling passed after repair**

The OpenAI request exhausted the configured provider quota with HTTP `429`. This is an
external account/quota blocker, not authorization to synthesize an answer. The run
also exposed that provider-job failures were invisible and could not be deliberately
retried. Worker jobs now persist sanitized running/completed/failed state, and the
Drift drawer visibly reports `Advisory investigation failed` while preserving the
fact-versus-analysis boundary.

### Step 8 — Generate, simulate, and approve the correction

Status: **passed after repair**

The UI generated immutable operation
`op_6588ec40-bd52-49d5-b79f-85ab1540836e` from persisted evidence. KeeperHub exact
request simulation succeeded with simulation ID `keeperhub-sim-c3cb34c99a6a`, plan
hash `0xc3cb34c99a6ae652a3aeba13af20025b624080688d96591a803eb17550853609`,
and gas estimate `39115`. The owner approval bound that exact plan/simulation pair.

Persisting the new execution exposed raw internal status `new` at the UI schema
boundary. Execution states are now normalized before dashboard parsing, preventing a
successful mutation from invalidating every product route.

### Step 9 — Execute, reconcile an unknown outcome, and verify independently

Status: **passed safety behavior; final postcondition is partial**

The initial worker attempt stopped before broadcast because a valid successful
simulation had persisted `errorCode: null`; the schema now normalizes provider nulls
and has regression coverage. A safe retry then reached KeeperHub, but the provider
response outcome was unknown. Aether locked resubmission and entered reconciliation.

Independent RPC evidence proved that the approved correction landed:

- transaction: `0x6faa2bded91ead5b71f34771ad0f14466f8f23be8127274e8f112840f513b421`;
- Sepolia block: `11410736`;
- emitted oracle: the exact GitHub-approved address;
- emitted actor: the configured KeeperHub executor;
- canonical receipt observed with 58 confirmations.

Reconciliation now recovers unknown submissions only from the exact contract event,
desired value, configured executor, bounded provider-safe log history, and canonical
receipt. Worker restart recovery promotes retry-locked reconciliation jobs without
resubmitting the write.

Independent verification found the approved oracle address but `fresh: false`.
Aether correctly persisted `partial`, kept retry locked, and displayed Forward
correction required instead of claiming convergence or rollback.

### Step 10 — Verify drift, dashboard, and audit after the partial outcome

Status: **passed; protocol-specific forward correction remains required**

A final scan pinned block `11410822`. The observed and desired oracle addresses match,
but oracle freshness remains false, so the critical finding is retained as `Oracle
freshness violation` instead of being incorrectly resolved.

The desktop Overview reports 35% protocol health, zero of one resources aligned, one
critical open finding, the active operation as `correction required`, and the recovered
execution as `partial`. Its execution link retains the transaction hash and forward-
correction state. The Audit Log exposes the correlated operation, execution, actor,
resource, and transaction evidence in its inspection drawer.

The authenticated landing now uses `Go to dashboard` in the header, hero, campaign
sections, and closing call to action; no lower section sends an authenticated user to
signup. Logout cleared the session, a direct visit to `/app/overview` redirected to
`/login?returnTo=%2Fapp%2Foverview`, and UI login returned to Overview. Per the current
acceptance scope, no additional mobile-specific testing was performed.

The remaining product action is a protocol-specific forward correction that refreshes
the connected repository's approved oracle. The repository-local contract deployment
registry targets a different fixture, so its correction script was not run against this
contract. Aether correctly refuses to resubmit or pretend that the confirmed write can
be rolled back.

### Step 11 — Run automated quality and provider gates

Status: **product gates passed; GitHub least privilege blocked externally**

Formatting, lint, TypeScript, unit tests, Foundry unit/fuzz/invariant tests, the isolated
MongoDB replica-set integration suite, worker recovery tests, security checks, runtime-
import enforcement, desktop Chromium accessibility, nine desktop visual baselines,
seven non-live desktop E2E checks, the production build, and the production dependency
audit passed. The live Playwright case remained opt-in and skipped. No quality command
broadcast a transaction.

Environment, KeeperHub, chain, and OpenAI doctors passed. GitHub App authentication and
identity passed, but `github:doctor` failed closed because GitHub reports
`contents: write`. The owner must change Repository permissions → Contents to Read-only
and approve the installation permission update. The doctor now reports the actual
observed level in its error instead of an ambiguous missing-permission message.
