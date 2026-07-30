# Frontend Architecture

## Boundaries

```text
React components
  → TanStack Query hooks
    → @aether/sdk
      → /v1 HTTP contract
        → MSW now / NestJS later
```

- Components do not import fixtures or branch on mock/API mode.
- `@aether/shared` owns browser-safe Zod contracts.
- `@aether/sdk` parses responses before records enter the UI.
- `@aether/mock-data` owns deterministic server-shaped state and mutations.
- TanStack Query owns canonical remote state. Zustand stores tenant/protocol selection, navigation, demo-panel visibility, and resumable wizard progress only.
- URL paths own feature location; modal and drawer state remains transient in Phase 1.

## Rendering and Performance

- Marketing and application share tokens but have separate shells.
- Three.js is client-only and dynamically imported with static SVG/reduced-motion/mobile fallback.
- Lenis runs only on desktop marketing pages and is disabled for reduced motion.
- React Flow and the desired-state editor load dynamically.
- Mobile replaces dense tables with cards and the graph with a vertical stepper.

## Adapter Switch

`NEXT_PUBLIC_AETHER_DATA_MODE=mock` installs the deterministic browser transport
and starts the MSW worker before React Query renders. The transport keeps local
development resilient when service-worker interception is unavailable, while MSW
implements the same `/v1` HTTP contract for contract and browser tests. `api`
installs neither mock adapter; the SDK uses Axios against the same endpoints.

## Selected Versions

Next.js 16.2.12, React 19.2.8, TypeScript 5.9.2, Tailwind CSS 4.3.3, Motion 12.43.0, GSAP 3.15.0, Lenis 1.3.25, Three.js 0.185.1, Axios 1.19.0, TanStack Query 5.101.4, Zustand 5.0.14, React Hook Form 7.82.0, Zod 4.4.3, React Flow 12.11.2, MSW 2.15.0, Vitest 4.1.10, and Playwright 1.62.1.
