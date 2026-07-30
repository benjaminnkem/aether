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
- `/app/operations/op-oracle-restoration` graph, fallback, approval, and step drawer
- `/app/executions/exec-kh-8314` success, failure, partial, and unknown states
- `/app/audit-log` filters, mobile cards, and event drawer
- not-found and error states

Review at desktop and 390 × 844, with keyboard-only and reduced-motion settings.

## Deferred browser automation

Playwright smoke tests are present. Browser binaries remain uninstalled at the user's
request because of network conditions. Current implementation status must record
manual or automated review evidence separately and must not reuse the pre-reduction
32-route audit.
