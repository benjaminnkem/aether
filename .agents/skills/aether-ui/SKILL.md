---
name: aether-ui
description: Build and audit the complete Aether frontend, design system, marketing site, dashboard, mock API scenarios, accessibility, responsive behavior, and frontend tests.
---

# Aether UI Skill

Read `01_AETHER_PRD.md`, `03_AETHER_UI_UX_SPEC.md`, and `reference/DESIGN.md` before work. Use the original Aether visual identity and preserve the frontend-first architecture.

## Rules

- Build all routes and overlays, not a dashboard sample.
- Use the typed SDK and MSW; never read fixtures directly in pages.
- Keep one scarce acid-lime primary action per view.
- Use modals for create/edit and large right drawers for contextual detail.
- Use React Query for server state, Zustand for ephemeral UI state, RHF/Zod for forms.
- Build reduced-motion and mobile alternatives for Three.js, GSAP, Lenis, tables, and React Flow.
- Create realistic Web3 operational copy and evidence.
- Run lint, typecheck, tests, Playwright smoke tests, and production build.
- Record assumptions and update implementation status.
