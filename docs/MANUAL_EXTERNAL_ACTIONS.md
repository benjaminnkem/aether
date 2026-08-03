# Manual External Actions

Evidence date: 2026-08-03. This list contains only actions that require an external
account owner or an explicitly authorized testnet write. Never paste secrets into
chat, source control, browser storage, screenshots, or audit records.

## 1. Correct the GitHub App repository permission

The configured GitHub App authenticates and its App ID/slug match, but the live App
currently reports `contents: write`. Aether therefore fails the least-privilege gate
even though the already-installed repository can be read. As the GitHub App owner:

1. Open **GitHub → Settings → Developer settings → GitHub Apps → Aether**.
2. Under **Repository permissions**, set **Contents** to **Read-only**.
3. Keep **Metadata** and **Pull requests** read-only. Do not grant any write or
   administration permission.
4. Subscribe only to installation, installation repositories, push, release, and
   pull-request events.
5. Set **Post installation → Setup URL** to
   `http://localhost:4000/v1/github/callback` locally (or the HTTPS API equivalent)
   and enable **Redirect on update**.
6. Save. GitHub may require the installation owner to approve the changed permission.
7. Install/update the App for only `daniel-oluwadunsin/aether-demo-protocol`, then run
   `pnpm github:doctor` until it reports `verified_read_only`.

After the doctor passes, use **Protocol Setup → GitHub** to choose the repository,
default branch, and desired-state path. Aether mints installation tokens only on
demand and does not persist them.

## 2. Live Ethereum Sepolia acceptance

The RPC, deployed fixture, KeeperHub balance/role/simulation, and OpenAI provider
checks currently pass. A normal quality command never broadcasts a transaction.
Only an operator who controls the designated drift authority should run the full
flow in `docs/LIVE_TESTNET_UI_TEST_FLOW.md`, then explicitly opt into the write suite:

```bash
LIVE_TESTNET_ACCEPTANCE=1 pnpm test:live
```

Review the generated redacted evidence before treating the release as live-accepted.

## 3. Hosted deployment values

For a hosted release, replace localhost app/API/callback origins with HTTPS values,
configure a real SMTP sender for password recovery, update the GitHub Setup URL and
webhook URL, and store all secrets in the deployment secret manager.
