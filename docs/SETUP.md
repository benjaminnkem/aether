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

The default server provider mode is deterministic mock mode; it still uses real
MongoDB, outbox, Redis, queues, authorization, and verification state transitions.
Live provider mode additionally requires the server-only variables in
`docs/ENVIRONMENT.md`.
