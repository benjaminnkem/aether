# Frontend Architecture

The frontend has one transport: credentialed Axios through `@aether/sdk` to `/v1`.
TanStack Query owns server cache; Zustand owns only ephemeral selection/navigation and
stores generated onboarding IDs. It never stores access or refresh tokens.

All server mutations use CSRF headers read from the non-HttpOnly double-submit cookie.
Queries render loading, empty, unavailable, and persisted states without fixtures.
Detail URLs contain real database IDs and reload through the dashboard aggregate.

Sonner owns all toast notifications. Toast surfaces use restrained backdrop blur and
short motion; reduced-motion preferences remove nonessential transitions. Framer
Motion/GSAP are not used for routine dashboard state changes.
