# Frontend Routes

- `/` — product narrative.
- `/signup`, `/login`, `/forgot-password`, `/reset-password`.
- `/onboarding` — persist organization and protocol.
- `/app/overview`.
- `/app/protocol-setup`.
- `/app/desired-state`.
- `/app/drift`.
- `/app/operations/:operationId`.
- `/app/executions/:executionId`.
- `/app/audit-log`.

Operation and execution IDs are generated MongoDB record identifiers. Unknown or stale
deep links render an honest not-found state; no fixed redirect aliases exist.
