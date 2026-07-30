# Testing

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm test:e2e
pnpm build
```

Coverage targets design-system focus/Escape behavior, eight-step onboarding resume,
desired-state form/YAML validation, six deterministic scenarios, complete oracle
correction, unknown-outcome retry safety, reduced motion, landing/overview smoke, and
mobile operation fallback.

Playwright 1.62.1 is configured. Its Chromium binary is not installed because the user
deferred the network download. Do not claim browser execution until the binary exists;
run `pnpm --filter @aether/web test:e2e` when it becomes available.
