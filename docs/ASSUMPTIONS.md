# Assumptions and decisions

1. Chain `11155111` is the only hosted/live chain. Chain `31337` is test infrastructure.
2. The existing Arcadia fixture remains unaudited and testnet-only.
3. KeeperHub Direct Execution, not workflows, is the canonical correction path.
4. The organization KeeperHub wallet receives only the oracle correction role.
5. GitHub App installation is the preferred provenance connection and is read-only.
6. OpenAI Responses structured output is advisory evidence, never authority.
7. A Foundry keystore or hardware signer stays outside the application.
8. Hosted SMTP requires a verified sender; local verification uses Mailpit.
9. A second RPC is optional but, when set, is an independent observation source.
10. External credentials and funds are manual authority boundaries and are listed only
    in `MANUAL_EXTERNAL_ACTIONS.md`.
11. RPC event-log history reads use `AETHER_RPC_LOG_BLOCK_RANGE` (10 blocks by
    default) so free-tier Sepolia providers can run scans. The pinned current state
    remains authoritative; origin attribution is included only when its log is inside
    the provider-supported window.
12. Unknown KeeperHub outcomes may recover transaction evidence from at most
    `AETHER_RPC_RECOVERY_MAX_BLOCKS` (500 by default), queried in provider-safe
    chunks. Recovery requires the desired onchain postcondition, the exact emitted
    event, and the configured KeeperHub executor as transaction actor before
    verification continues.
