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
