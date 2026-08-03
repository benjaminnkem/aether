# Aether MVP UI/UX Specification

## 1. Experience principles

- Evidence first: facts and inference are visually and semantically separate.
- Calm control plane: compact, legible, low-glow, and operational rather than theatrical.
- Scarce lime: `#E4F222` is reserved for primary actions and verified convergence.
- Safe ambiguity: partial and unknown execution outcomes cannot look successful.
- Context over modules: approvals, policy, simulation, and verification live where used.

## 2. Visual system

- Canvas `#08090A`; surfaces `#0F1011`, `#161718`, `#23252A`.
- Crisp white and restrained gray type; no weights above 600.
- Inter Variable and an open-source monospaced font.
- Radius: cards 12px, controls 6px, badges 4px.
- Hairline/inset borders instead of large shadows.
- Status combines icon, text, and semantic color.
- Focus-visible treatment has at least 3:1 contrast.

## 3. Shell

Desktop sidebar:

1. Overview
2. Protocol Setup
3. Desired State
4. Drift
5. Audit Log

The sidebar includes Aether identity, compact organization/protocol context, environment
badge, durable realtime state, and current user. The top bar contains breadcrumb, mobile
navigation trigger, and realtime state. There is no global command palette or dedicated
notification center in the MVP.

On mobile, the sidebar becomes an overlay. Content is single-column, drawers become
full-screen, tables become cards, and operation graphs use the vertical step fallback.

## 4. Landing

The landing page retains:

- product promise and supporting operational copy;
- original local state-field hero animation with static/reduced-motion fallback;
- real product composition;
- desired-versus-observed explanation;
- evidence, safe planning, KeeperHub execution, and verification sequence;
- explicit KeeperHub trust line;
- security responsibility model;
- audience/integration strip;
- strong demo CTA and cropped AETHER footer word.

Product, Security, and How it works are landing anchors, not separate pages.

## 5. Authentication and onboarding

Login and optional signup share the Aether mark and direct copy. Onboarding resumes from
local UI state and has eight steps:

1. Organization
2. Protocol
3. Setup method
4. Network
5. Contract
6. KeeperHub
7. Initial scan
8. Overview

No live secret is requested.

## 6. Overview

Show protocol/environment/status, last observation, health, network count, contract
count, open drift, critical finding or aligned empty state, active operation, active
KeeperHub execution, and network health. Every card links to the relevant retained page.

## 7. Protocol Setup

Tabs:

- General: name, environment, governance authority.
- Networks: chain, block freshness, RPC status, executor balance.
- Contracts: names, addresses, proxy/ABI/owner context.
- GitHub: read-only release provenance and permission explanation.
- KeeperHub: execution adapter status and trust boundary.

Create/edit actions use focused dialogs. Destructive actions require confirmation when
introduced by the backend phase.

## 8. Desired State

The main editor supports form and YAML modes with one schema. It includes explicit
addresses, roles, versions, pause state, basis-point fee, native-token gas floor,
maximum automatic transaction value, release, and source. It shows:

- unsaved/validated state;
- accessible validation summary;
- human-readable unit previews;
- semantic diff;
- active version and provenance;
- compact policy/invariant summary;
- version history.

Saving requires validation and clear confirmation.

## 9. Drift

The list supports search, severity filter, status/network-ready layout, desktop table,
and mobile cards. The right drawer includes severity/status/network, block-pinned fact,
observed address, desired address, source version, evidence provenance, clearly marked
analysis, and Generate correction plan action.

An aligned protocol shows a useful empty state.

## 10. Operation detail

Header: title, immutable plan version/hash, risk, and status.

Content:

- evidence facts;
- AI-assisted inference warning;
- target/function/value policy checks;
- exact-request simulation;
- approval bound to exact plan;
- custom React Flow graph;
- keyboard-accessible vertical fallback;
- step detail drawer;
- contextual KeeperHub execution link.

Approve and reject actions only appear in valid states and must have explicit labels.

## 11. KeeperHub execution

Show direct execution ID, network, realtime state, current step, lifecycle timeline, simulation,
gas, transaction hash, and verification. Special states:

- simulation failure: no transaction exists;
- partial: confirmed write plus forward-correction requirement;
- unknown: RPC/provider uncertainty, reconciliation state, automatic retry locked;
- complete: independent postcondition verified.

Progress changes are announced politely. Status is never inferred from color.

## 12. Audit Log

Search and filter by event text, actor category, and date. Desktop uses a table; mobile
uses cards. Event drawer shows actor/context, status, correlation reference, evidence,
timestamp, and structured redacted payload.

## 13. Components retained

Buttons, icon buttons, inputs, selects, textareas, fields, validation summaries, tabs,
badges, statuses, cards, tables/mobile lists, dialogs, drawers, empty/error/loading
states, tooltips, toasts, chain values, copy/explorer controls, code/YAML, diff,
timeline, metrics, and custom operation nodes.

Broad command palette, notification-center UI, generic settings navigation, standalone
approval queues, generic data-module pages, and unused enterprise primitives are out.

## 14. Motion and performance

Framer Motion handles reveals and interface transitions. GSAP ScrollTrigger is limited
to the marketing comparison sequence. Lenis is marketing-only and disabled for reduced
motion and smaller screens. Three.js is dynamically imported after primary content,
cleans up RAF/WebGL resources, and falls back to static SVG.

No element stacks multiple animation systems. Deterministic initial rendering prevents
hydration mismatch.

## 15. Accessibility acceptance

- Logical headings, landmarks, labels, and error associations.
- Keyboard support for navigation, tables, cards, dialogs, drawers, tabs, and graph fallback.
- Escape closes overlays and focus returns to trigger.
- Reduced motion removes smooth scroll, parallax, pulses, and nonessential transitions.
- Critical status always includes readable text and icon.
- Touch targets remain usable at 320px width.
- Unknown/partial execution language is explicit and safety preserving.
- Sonner announcements use accessible live regions and reduced motion.
- React Flow always has a complete keyboard-readable vertical fallback.
- Three.js failure, mobile, and reduced-motion contexts use the static state-field asset.
- Unauthorized states explain that no action occurred and provide a clear recovery path.

## 16. Unified editorial direction

Marketing and the authenticated product share the updated editorial design language:
white and soft-cloud canvases, black pill actions, flat hairline-separated surfaces,
large campaign hierarchy, and chromatic restraint. Product screens retain semantic
danger, warning, information, and verified-convergence colors so operational safety is
never reduced to visual fashion. Product motion remains shorter and state-driven than
marketing motion.
