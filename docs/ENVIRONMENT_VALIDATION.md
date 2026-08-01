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

`keeperhub:doctor` authenticates, confirms enabled Ethereum Sepolia support, reads the
organization wallet, and writes its public address to `AETHER_EXECUTOR_ADDRESS` only
when that variable is empty. After deployment it also verifies Sepolia ETH, the narrow
role, and an exact simulation-only request. It never broadcasts.

Observed on 2026-08-01:

- KeeperHub organization key: authenticated;
- KeeperHub Ethereum Sepolia: enabled testnet;
- KeeperHub organization wallet: configured and public executor address derived;
- RPC: rejected because the configured endpoint did not report chain `11155111`;
- GitHub App: authenticated and configured identity verified;
- OpenAI key: authenticated and configured model available;
- KeeperHub balance, role, and simulation: not reached because RPC failed closed;
- usable Foundry operator keystore matching the configured administrator: missing.

No secret value is included in this document.
