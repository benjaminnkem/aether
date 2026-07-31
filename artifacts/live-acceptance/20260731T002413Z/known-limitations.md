# Known limitations

1. The configured RPC is not Base Sepolia.
2. The unaudited fixture has not been deployed to chain `84532`.
3. No authorized funded Foundry signer is installed.
4. The KeeperHub wallet funding and narrow onchain role are unverified.
5. GitHub App and OpenAI credentials are absent.
6. Hosted SMTP is not configured; local email uses Mailpit.
7. No live transaction or browser acceptance evidence exists.
8. API/worker/Redis process-restart recovery has unit coverage for idempotency,
   reconciliation, and unknown outcomes, but a complete multi-process restart exercise
   has not run against the undeployed live fixture.
