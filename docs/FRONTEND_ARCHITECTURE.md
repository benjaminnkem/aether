# Frontend Architecture

## Boundaries

```text
Route component
  → feature/query hook
    → @aether/sdk
      → direct mock transport or Axios /v1
        → deterministic mock/MSW now, NestJS later
```

- `apps/web` owns route composition and frontend-only interaction.
- `packages/ui` owns keyboard-accessible Aether primitives.
- `packages/shared` owns browser-safe Zod contracts and inferred types.
- `packages/sdk` owns transport-neutral methods and query keys.
- `packages/mock-data` owns six scenarios, transitions, HTTP handlers, and event bus.
- TanStack Query owns canonical server data.
- Zustand owns sidebar, selected organization/protocol, demo visibility, and onboarding progress.
- React Hook Form owns desired-state and setup forms.

No page imports fixtures or branches on data mode.

## Routes

The authenticated catch-all validates exactly five static areas and two dynamic detail
areas. Known legacy paths redirect to retained context; unrelated legacy paths return
not found. See `docs/FRONTEND_ROUTES.md`.

## Mode switch

`NEXT_PUBLIC_AETHER_DATA_MODE=mock` installs the direct transport before Query renders
and also makes the equivalent MSW handlers available. `api` removes the mock transport
and Axios calls `NEXT_PUBLIC_AETHER_API_URL`. Omitting data mode defaults safely to mock.

## Rendering and weight

- Marketing and app shells share tokens but not scroll behavior.
- Three.js is dynamically loaded with static, mobile, failure, and reduced-motion fallback.
- Lenis is marketing-only and disabled for reduced motion and small screens.
- React Flow and the desired-state editor are dynamically imported.
- Desktop tables have mobile card alternatives.
- The graph has an accessible vertical operation-step list.

## Selected versions

Next.js 16.2.12; React 19.2.8; TypeScript 5.9.2; Tailwind CSS 4.3.3;
Motion 12.43.0; GSAP 3.15.0; Lenis 1.3.25; Three.js 0.185.1; Axios 1.19.0;
TanStack Query 5.101.4; Zustand 5.0.14; React Hook Form 7.82.0; Zod 4.4.3;
React Flow 12.11.2; MSW 2.15.0; Vitest 4.1.10; Playwright 1.62.1.
