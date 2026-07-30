# Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm dev
```

Open `http://localhost:3000`; the API listens on `http://localhost:4000`.

For frontend-only mock work:

```bash
NEXT_PUBLIC_AETHER_DATA_MODE=mock pnpm --filter @aether/web dev
```

For the live backend transport:

```bash
NEXT_PUBLIC_AETHER_DATA_MODE=api \
NEXT_PUBLIC_AETHER_API_URL=http://localhost:4000/v1 \
pnpm --filter @aether/web dev
```

Start the API and worker separately when inspecting logs:

```bash
pnpm --filter @aether/api dev
pnpm --filter @aether/worker dev
```

Build and test the chain fixture:

```bash
pnpm --filter @aether/contracts build
pnpm --filter @aether/contracts test
```

For a local lifecycle, start Anvil with chain ID `31337`, deploy with an unlocked
development account, then run the seed/drift/correction scripts from
`docs/OPERATIONS.md`. Base Sepolia (`84532`) is the sole supported testnet. Testnet
broadcasting requires an operator-supplied Foundry keystore or hardware wallet and RPC
URL; no key variable is defined by this repository.

The default server provider mode is deterministic mock mode; it still uses real
MongoDB, outbox, Redis, queues, authorization, and verification state transitions.
Live provider mode additionally requires the server-only variables in
`docs/ENVIRONMENT.md`.

KeeperHub live mode requires one pre-reviewed testnet workflow ID. Aether sends the
immutable plan hash and exact transaction as workflow input, uses KeeperHub's dry-run
contract-call endpoint before approval/submission, and reads execution status and step
logs afterward. OpenAI remains disabled unless `AETHER_OPENAI_ENABLED=true`.
