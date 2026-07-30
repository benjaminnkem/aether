# Aether UI/UX Specification

## 1. Design intent

Aether should feel like a precision control room for protocol operations: restrained, dark, technical, fast, and trustworthy. Use the provided `reference/DESIGN.md` as a foundation, not a template to clone. Preserve its strongest principles—near-black surfaces, tight Inter typography, hairline geometry, compact controls, and one functional acid-lime action—while creating an original Aether brand, information architecture, iconography, motion language, and product composition.

The UI must communicate four ideas:

1. **State:** what the protocol should be and what it currently is.
2. **Divergence:** where those two states differ.
3. **Control:** what action is proposed and who may authorize it.
4. **Convergence:** whether KeeperHub execution returned the protocol to a verified state.

---

## 2. Visual system

### Core palette

```text
Canvas / Void        #08090A
Primary surface      #0F1011
Elevated surface     #161718
Border / Graphite    #23252A
Strong divider       #383B3F
Muted text           #8A8F98
Secondary text       #D0D6E0
Primary text         #FFFFFF
Primary action       #E4F222
```

Use status colors only for semantic states. Do not turn the dashboard into a multicolor monitoring product. The acid-lime action remains scarce: generally one primary filled action per view.

### Typography

- Inter Variable for UI and marketing.
- JetBrains Mono or IBM Plex Mono for addresses, hashes, IDs, code, blocks, and timestamps.
- Avoid 700+ weights.
- Tight negative tracking on display headings.
- Use tabular numbers for metrics and block/execution data.

### Geometry

- Cards: 12px radius.
- Inputs/buttons: 6px radius.
- Badges: 4px.
- Pills: full radius.
- Surface separation through 0.5–1px hairlines and subtle inset edges, not glowing shadows.

### Motion language

Aether motion should resemble state being observed, diverging, routed, and reconciled:

- thin orbital traces;
- nodes aligning into a stable graph;
- pulses moving through execution paths;
- before/after values converging;
- restrained scan lines and marker sweeps.

Avoid generic crypto coins, rotating Ethereum logos, neon cyberpunk effects, excessive glassmorphism, floating blobs, and uncontrolled particle clouds.

---

## 3. Logo and identity task

Codex must create the original logo assets before building pages. Do not use an external AI image service or copyrighted logo.

### Concept

Create an SVG mark formed from:

- a central protocol/state node;
- two or three incomplete orbital arcs representing continuous observation;
- one acid-lime alignment point representing verified convergence;
- geometric negative space that remains recognizable at 16px.

### Deliverables

- `public/brand/aether-mark.svg`
- `public/brand/aether-wordmark.svg`
- `public/brand/aether-lockup.svg`
- light/dark-safe monochrome variants;
- `app/icon.svg` or generated favicon assets;
- social/OG composition using the product UI rather than stock art.

### Constraints

- Original, simple, reproducible SVG.
- No gradients required in the mark.
- Works at favicon, sidebar, nav, loading screen, empty state, and document header sizes.
- Include a short `docs/BRAND.md` explaining geometry and usage.

---

## 4. Landing page

### 4.1 Navigation

Fixed or softly sticky top navigation:

- Aether lockup;
- Product;
- Security;
- How it works;
- Docs;
- GitHub link where configured;
- Sign in;
- one primary CTA: **Open control plane** or **Try the demo**.

Use a compact 1200px container and an unobtrusive border after scroll.

### 4.2 Hero

Primary copy:

> **Keep protocols in their intended onchain state.**

Supporting copy:

> Aether observes deployed contracts, detects dangerous drift, plans safe corrections, executes approved actions through KeeperHub, and verifies the result.

Trust line:

> Execution reliability powered by KeeperHub.

CTAs:

- primary acid-lime: **Try the live demo**;
- secondary ghost/link: **See how it works**.

### 4.3 Hero motion/background

Build a local, original animated state field:

- a sparse Three.js point/node field or 2D canvas fallback;
- nodes represent deployed resources;
- a small subset drifts out of alignment;
- a pulse routes through them and resolves alignment;
- subtle cursor influence, never distracting;
- no remote asset dependency;
- optional locally bundled Lottie-style pulse JSON only when it adds value;
- static SVG fallback;
- full reduced-motion fallback;
- lazy-load WebGL and avoid blocking LCP.

The hero must include a real product interface composition, not only abstract animation: show a protocol overview with a drift alert, operation graph, and KeeperHub run strip.

### 4.4 Landing sections

1. **Desired versus observed state** — sticky scroll showing YAML/form intent on one side and live contract state on the other.
2. **Detect what changed** — product view of drift investigation and transaction evidence.
3. **Plan safely** — operation graph with policy and invariant checkpoints.
4. **Execute reliably** — KeeperHub simulation, execution, node logs, transaction, and gas evidence.
5. **Verify the outcome** — before/after comparison and green convergence state.
6. **Built for protocol teams** — engineers, security, operations, governance, auditors.
7. **Integration strip** — GitHub, Safe/governance, EVM networks, KeeperHub, alerts; use neutral marks and text.
8. **Security model** — “AI proposes; policy authorizes; KeeperHub executes; Aether verifies.”
9. **Final CTA** with full-width product frame.
10. **Footer** with the word **AETHER** enormous, cropped across the width, plus concise navigation and status.

### 4.5 Landing implementation details

- Tailwind CSS for layout and tokens.
- Framer Motion for component transitions and reveal sequences.
- GSAP ScrollTrigger only for complex sticky/timeline sections.
- Lenis for desktop smooth scrolling, disabled for reduced motion and contexts where native scrolling is safer.
- Three.js isolated in a client-only, dynamically imported component.
- Central motion utility to prevent competing animation systems.
- Cleanup all GSAP contexts, observers, RAF loops, and WebGL resources.
- Responsive: mobile simplifies sticky sections into stacked sequences.

---

## 5. Authentication and onboarding

### Authentication screens

- Login.
- Signup.
- Forgot/reset password.
- Invite acceptance.
- Optional wallet linking after account creation, not mandatory to explore mock mode.

### First-run onboarding wizard

1. Create organization.
2. Choose **Demo protocol** or **Existing protocol**.
3. Import from GitHub or configure manually.
4. Choose networks.
5. Review discovered contracts.
6. Select monitoring templates.
7. Select execution mode:
   - read only;
   - plan and require approval;
   - allow low-risk automation.
8. Initial scan with progressive results.
9. Enter dashboard.

Persist wizard progress and make every step resumable.

---

## 6. Dashboard shell

### Sidebar

Desktop sidebar sections:

```text
Overview

PROTOCOL
Protocols
Desired State
Deployments
Contracts

OPERATIONS
Drift
Incidents
Operations
Approvals
Invariants
Policies

SYSTEM
KeeperHub Runs
Audit Log
Integrations
Team
Settings
```

Features:

- collapse to icon rail;
- active indicator is restrained acid-lime line/dot;
- organization/protocol switcher at top;
- environment badge;
- connection health at bottom;
- member identity and sign-out.

### Top bar

- breadcrumbs;
- freshness/last scan indicator;
- environment and chain filter;
- global search/command palette;
- notifications;
- context primary action.

### Mobile

Use a sheet navigation, not a squeezed desktop sidebar. Tables become cards or controlled horizontal regions. The operation graph has a readable vertical fallback.

---

## 7. Dashboard pages

### 7.1 Overview

- protocol health score with explanation, not a mysterious number;
- critical findings;
- desired/observed alignment summary;
- deployment matrix;
- open drift by severity;
- active operation timeline;
- KeeperHub success/failure/retry summary;
- invariant status;
- recent audit activity;
- quick actions.

### 7.2 Protocols

- organization-wide protocol grid/table;
- environment, chains, health, open drift, last scan, current release;
- create/edit/archive modals;
- strong empty state with demo protocol option.

### 7.3 Protocol detail

Header with health, environment, release, connected repository, governance, last observed block, and main actions. Tabs/sections for summary, deployments, resources, desired state, operations, and audit.

### 7.4 Desired State

- split form/code mode;
- version list and status;
- GitHub provenance;
- semantic diff between versions;
- validation issues;
- “impact preview” showing likely drift created/resolved;
- activation approval flow;
- YAML editor with schema errors and safe canonical preview.

### 7.5 Deployments

- chain cards/table;
- RPC health and latest block;
- release parity;
- contract count;
- gas/executor balance;
- last successful scan;
- add/edit deployment modal;
- chain detail drawer.

### 7.6 Contracts

- resource registry with name, role, address, proxy, implementation, ABI status, owner, and health;
- copy/open explorer controls;
- add/import modal;
- large drawer with reads, roles, recent admin events, bytecode/ABI provenance, desired values, and related drift.

### 7.7 Drift

- severity/status filters;
- dense but readable table;
- desired and observed values;
- classification and first/last seen;
- bulk acknowledge only where policy permits;
- right drawer with evidence, transaction, source, AI analysis, invariant impact, and actions.

### 7.8 Incidents

- grouped critical findings;
- incident status, blast radius, value at risk if available, affected deployments;
- investigation timeline;
- evidence graph;
- linked operation/correction.

### 7.9 Operations

- list and board/timeline views;
- status, risk, requester, approvals, affected chains, KeeperHub status;
- create operation modal;
- operation detail page with immutable plan version, graph, policy result, simulation, approvals, execution, verification, and correction.

### 7.10 Operation graph

Use React Flow with custom Aether nodes:

- read;
- check/invariant;
- simulation;
- approval;
- contract write;
- wait/finality;
- verification;
- notification;
- correction.

Graph requirements:

- status encoded by icon, text, border and color;
- current node pulse is subtle;
- keyboard accessible list fallback;
- clicking opens details drawer;
- mobile vertical stepper fallback;
- no decorative spaghetti edges.

### 7.11 Approvals

- pending approvals prioritized by risk and expiry;
- exact plan hash and revision;
- before/after values;
- simulation summary;
- policy reasons;
- approve, reject, request changes;
- wallet signature where configured;
- history and invalidation reason.

### 7.12 Invariants

- template gallery;
- active invariant table;
- recent evaluations and failure trend;
- create/edit modal;
- detail drawer with expression, dependencies, current inputs, evaluation version, and affected operations.

### 7.13 Policies

- policy sets and versions;
- plain-language summary plus structured editor;
- contract/function allowlists;
- limits, approvals, canary, and mainnet settings;
- dry-run evaluation against sample operations;
- diff and activation flow.

### 7.14 KeeperHub Runs

- execution ID, workflow/action, protocol, status, created time, gas, transaction count;
- provider health and configured wallet status;
- right drawer with node-level timeline, inputs/outputs with redaction, logs, errors, transaction hashes, explorer links, retry/reconcile actions subject to policy;
- distinguish simulation, direct action, and workflow.

### 7.15 Audit Log

- append-only timeline/table;
- actor, action, resource, source, request/correlation ID, timestamp;
- before/after metadata drawer;
- export controls;
- clear redaction indicators.

### 7.16 Integrations

Cards for:

- KeeperHub;
- GitHub;
- RPC providers;
- Safe/governance;
- OpenAI;
- Slack/Discord/Telegram/email/webhooks.

Each card shows mock/live mode, connection health, last successful call, permissions/scopes, and setup action. Never show secret values after creation.

### 7.17 Team and settings

- members and invites;
- effective roles;
- service accounts;
- general organization settings;
- security/session settings;
- API keys with one-time reveal;
- execution mode and mainnet lock;
- notification rules;
- retention settings placeholders.

---

## 8. Modal and drawer behavior

### Modals

Use for short create/edit decisions:

- protocol;
- deployment;
- contract;
- invariant;
- policy;
- operation objective;
- approval action.

Do not put a 20-field protocol import into one modal; use a full wizard.

### Large right-side drawers

Use 520–720px responsive drawers for contextual detail while preserving the list:

- drift;
- incident evidence;
- contract details;
- KeeperHub execution;
- audit record;
- graph step.

Drawers must support direct URL state or route interception where practical, focus management, deep links, and mobile full-screen mode.

---

## 9. Required UI states

Every important route and component must include:

- skeleton loading;
- no-data/first-run empty state;
- filtered-empty state;
- recoverable error with retry;
- permission denied;
- integration not configured;
- stale data;
- partial provider failure;
- offline/reconnecting realtime;
- long-running action;
- successful mutation;
- archived/read-only resource;
- mock mode indicator in development/demo;
- reduced-motion behavior.

Use realistic addresses, hashes, blocks, timestamps, failures, and execution logs. Do not fill the product with lorem ipsum.

---

## 10. Mock scenario engine

The frontend-first build must simulate complete state transitions, not static JSON only.

### Scenario: unauthorized oracle drift

1. Healthy overview.
2. User triggers **Simulate drift** in demo controls.
3. Protocol health drops.
4. New critical drift and incident appear.
5. Investigation progresses through queued states.
6. Plan becomes ready.
7. Approval modal works.
8. KeeperHub simulation and execution nodes animate through statuses.
9. Verification succeeds.
10. Drift resolves and health returns.

### Other scenarios

- GitHub release creates expected drift.
- Simulation fails due to missing role.
- Approval expires.
- KeeperHub returns rate limit and retries later.
- Partial execution requires correction.
- RPC provider is stale.
- Viewer cannot approve.
- Empty organization onboarding.

Use MSW, deterministic timers, and test hooks. Avoid random flaky delays.

---

## 11. Charts and visualizations

Use charts sparingly and only when they answer operational questions:

- drift count over time;
- invariant pass/fail history;
- scan/execution latency;
- deployment parity matrix;
- operation outcomes;
- gas usage trend.

Do not make the dashboard a generic analytics template. Operational lists, evidence, and state comparison are more important.

---

## 12. Accessibility and performance requirements

- Skip links and semantic landmarks.
- Proper table captions/headers.
- Status announced through text and ARIA live regions for critical operation transitions.
- Focus management for command palette, modal, drawer, and nested confirmation.
- No motion required to understand state.
- Dynamic import Three.js, React Flow, YAML editor, and heavy charting.
- Respect `prefers-reduced-motion` and low-power/mobile conditions.
- Use responsive images/SVGs; no huge remote videos.
- Keep primary app routes fast even if marketing motion is elaborate.

---

## 13. Frontend acceptance bar

The frontend phase is accepted only when:

- every route in the PRD is implemented;
- all data comes through the typed SDK and mock handlers;
- the complete incident-to-verification flow works without backend;
- all modals and large drawers are functional;
- desktop, tablet, and mobile layouts are intentional;
- reduced motion works;
- no placeholder stock imagery or generic SaaS card grid dominates the design;
- the logo and favicon are original and used consistently;
- lint, typecheck, tests, and production build pass;
- Codex provides screenshots or a route-by-route visual review record.
