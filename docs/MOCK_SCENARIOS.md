# Mock Scenarios

Open **Demo controls** at the bottom-right of an authenticated route.

1. `healthy` — 100% aligned with independent verification evidence.
2. `unauthorized-oracle` — critical oracle address drift.
3. `approval-execution` — plan at approval boundary, then successful execution.
4. `missing-role` — exact-request simulation reverts; no transaction is submitted.
5. `partial-execution` — write confirms but verification requires forward correction.
6. `unknown-outcome` — receipt is uncertain; automatic retry is locked during reconciliation.

The primary showcase advances:

`investigate → plan → approve → simulate → execute → independently verify`

Each transition updates protocol health, metrics, drift, operation graph, execution,
contextual updates, and audit events through one in-memory state machine. Components
never import fixtures directly. Direct mock transport and MSW implement the same SDK
HTTP contract with deterministic 180ms latency.
