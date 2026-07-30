# Visual Review

Reviewed in the in-app browser on July 30, 2026 with
`NEXT_PUBLIC_AETHER_DATA_MODE=mock`.

## Route Audit

All 32 routes in `docs/FRONTEND_ROUTES.md` rendered their expected primary
heading without browser console errors. The audit covered every public,
authentication, onboarding, application, and settings route.

## Focused Reviews

- Landing hero and full marketing narrative at desktop and 390 × 844.
- Overview metrics, alignment, operation timeline, findings, and deployment parity.
- Desired-state form, YAML, semantic diff, provenance, and chain overrides.
- Operation graph on desktop and the complete vertical-step fallback at 390 × 844.
- Unauthorized oracle scenario, drift responsive card, and evidence drawer.
- Demo scenario controller and deterministic scenario mutation.
- Responsive app top bar, action stacking, context wrapping, and mobile navigation.

## Overlay Review

- Drift evidence drawer exposes a dialog name, close control, evidence, confidence,
  transaction copy/explorer actions, and audit timeline.
- Demo controller exposes a named complementary landmark, labelled scenario select,
  close control, and lifecycle action.
- Dialog, command palette, notification drawer, and graph-step drawer behavior is
  additionally covered by component tests.

## Deferred Browser Automation

The Playwright configuration and smoke tests are present. Browser binaries are not
installed because the user deferred the download due network conditions.
