# Visual Review

## Required route audit

- `/`
- `/login`
- `/signup`
- `/onboarding`
- `/app/overview`
- `/app/protocol-setup` and all five tabs
- `/app/desired-state` form and YAML
- `/app/drift` aligned, finding, filter, mobile card, and evidence drawer
- `/app/operations/:operationId` graph, simulation, approval, and step drawer
- `/app/executions/:executionId` pending, failure, partial, unknown, and verified states
- `/app/audit-log` filters, mobile cards, and event drawer
- not-found and error states

Review at desktop and 390 × 844, with keyboard-only and reduced-motion settings.

## Browser automation status

Playwright smoke and protected live tests are present. A fresh Chromium install and
final desktop/mobile/reduced-motion/keyboard run are required before release. Earlier
mock screenshots do not count as live evidence.
