# Test Results

Observed during this pass:

- TypeScript/Foundry type gate: passed.
- Formatting and lint: passed.
- Foundry: 15 passed.
- backend unit: 6 passed.
- worker unit/provider: 16 passed.
- API contract/security: 3 passed in the full suite; focused security gate passed.
- API Mongo replica-set integration: 2 passed using an isolated local replica set and
  test-only SMTP sink.
- frontend unit: 9 passed.
- production build: passed for all eight build targets.
- production dependency audit: no known vulnerabilities.
- Playwright: 8 passed on Chromium desktop/mobile; 2 protected `@live` cases skipped
  because live acceptance was not enabled.
- live acceptance: not run; the chain/provider prerequisites are incomplete.

This file is updated only from actual command output.
