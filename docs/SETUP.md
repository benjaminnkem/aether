# Setup

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @aether/web dev
```

Open `http://localhost:3000`. The MSW service worker is generated at `apps/web/public/mockServiceWorker.js`.
