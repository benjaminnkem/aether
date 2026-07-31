# Environment Validation

`pnpm env:doctor` creates a timestamped ignored backup, removes obsolete runtime-mode
variables, preserves non-empty values, generates local cryptographic secrets, supplies
Compose/Mailpit defaults, and reports variable names/status only.

Provider checks are read-only:

```bash
pnpm chain:doctor
pnpm keeperhub:doctor
pnpm github:doctor
pnpm openai:doctor
```

`keeperhub:doctor` authenticates, confirms enabled Base Sepolia support, reads the
organization wallet, and writes its public address to `AETHER_EXECUTOR_ADDRESS` only
when that variable is empty. It never simulates or broadcasts.

Observed on 2026-07-31:

- KeeperHub organization key: authenticated;
- KeeperHub Base Sepolia: enabled testnet;
- KeeperHub organization wallet: configured and public executor address derived;
- RPC: rejected because the configured endpoint did not report chain `84532`;
- GitHub App: missing;
- OpenAI key: missing;
- Foundry operator keystore: missing.

No secret value is included in this document.
