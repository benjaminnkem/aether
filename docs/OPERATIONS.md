# Operations

The demo operation uses this lifecycle: observe → investigate → plan → policy →
approve → simulate → KeeperHub execute → finality → independently verify → audit.
Partial writes produce a linked forward-correction state, never a fictional rollback.
Unknown outcomes lock retry while reconciliation checks KeeperHub and independent RPC
providers. The development scenario controller provides deterministic rehearsal.
