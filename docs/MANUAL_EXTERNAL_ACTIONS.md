# Manual External Actions

This list contains only external authority or credentials that the current local
environment still lacks. Never paste these values into chat, source control, browser
storage, screenshots, or audit records. Put them directly in `.env` or the hosted
secret manager, then run the named doctor.

## 1. Replace the RPC with Base Sepolia

The configured `AETHER_RPC_URL` answered successfully but reported a chain other than
`84532`, so it is rejected.

1. Create a Base Sepolia HTTPS endpoint with Alchemy, Infura, QuickNode, your own node,
   or another trusted provider.
2. Copy the full HTTPS URL into `AETHER_RPC_URL`.
3. Keep mainnet disabled and do not reuse a chain-1 endpoint.
4. Verify with:

```bash
pnpm chain:doctor
```

Expected format: `https://...` JSON-RPC URL. Expected result:
`AETHER_CHAIN_ID: verified_84532`.

## 2. Create the read-only GitHub App

Open [GitHub App registration](https://github.com/settings/apps/new).

- Homepage URL: `http://localhost:3000` locally; use the final HTTPS application URL
  when hosted.
- Callback URL: `http://localhost:4000/v1/github/callback`.
- Webhook URL: `http://localhost:4000/v1/github/webhooks` locally through a trusted
  HTTPS tunnel; use the hosted HTTPS API URL in deployment.
- Webhook secret: use the already generated `GITHUB_WEBHOOK_SECRET`.
- Repository permissions: Metadata `read`, Contents `read`, Pull requests `read`.
- Subscribe only to installation, installation repositories, push, release, and pull
  request events needed for provenance.
- Request access only to the repository used by the testnet desired state.

Set:

- `GITHUB_APP_ID` — numeric App ID;
- `GITHUB_APP_SLUG` — the public URL slug shown on the App settings page;
- `GITHUB_CLIENT_ID` — GitHub App client ID;
- `GITHUB_CLIENT_SECRET` — generated client secret;
- `GITHUB_PRIVATE_KEY_BASE64` — base64 of the downloaded PEM, encoded locally;
- `GITHUB_CALLBACK_URL` — exact callback above or the hosted equivalent.

Verify names/configuration with:

```bash
pnpm github:doctor
```

GitHub documentation: [registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app) and [minimum permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).

## 3. Create an OpenAI API key

Open [OpenAI API keys](https://platform.openai.com/api-keys), create a project-scoped
server key, and set `OPENAI_API_KEY`. Ensure the project has billing/usage limits and
access to the configured `OPENAI_MODEL`.

Expected format: an OpenAI project/server API key stored server-side only.

Verify with:

```bash
pnpm openai:doctor
```

The integration uses the Responses API with strict structured output and
`advisoryOnly: true`; it never signs, approves, submits, or verifies a transaction.

## 4. Create and fund an authorized Base Sepolia deployer

No Foundry keystore is available. Create one locally or connect a hardware wallet.
Never put the private key in `.env`.

```bash
cast wallet import aether-base-sepolia-deployer --interactive
cast wallet address --account aether-base-sepolia-deployer
```

Fund the displayed public address with Base Sepolia ETH. Set only the public address
as `AETHER_CONTRACT_ADMIN_ADDRESS`. Select separate authorized public addresses for
`AETHER_DRIFT_ACTOR_ADDRESS` and `AETHER_FIXTURE_ADMIN_ADDRESS`.

The KeeperHub organization key is authenticated, Base Sepolia is enabled, and the
organization wallet was derived into `AETHER_EXECUTOR_ADDRESS`. Fund that public wallet
with Base Sepolia ETH and grant it only `ORACLE_ADMIN_ROLE`.

After `pnpm chain:doctor` passes, dry-run:

```bash
pnpm chain:deploy:dry
```

After reviewing the exact dry run, broadcast and record the live registry:

```bash
pnpm chain:deploy
```

Both commands load `.env` without printing it and refuse any chain other than `84532`.
The broadcast command merges real Foundry transaction hashes into the deployment
registry. Do not run either command against chain ID `1`.

## 5. Hosted SMTP only

Local development uses Mailpit on ports `1025` and `8025`, so no external email key is
required locally. Before hosting, obtain SMTP credentials and a verified sender from
your chosen provider and replace `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASSWORD`, and `SMTP_FROM`. Keep `AUTH_EMAIL_VERIFICATION_REQUIRED=true`.

## 6. Create the protected live-acceptance account

After the stack and hosted/local SMTP are running, create and verify a dedicated
Base-Sepolia-only account through `/signup`, complete onboarding, and set its
credentials locally as `LIVE_TEST_EMAIL` and `LIVE_TEST_PASSWORD`. These are not
provider keys and must not be committed. The account must own the test organization,
deployed fixture protocol, desired state, and connected GitHub App installation.

Create the real drift with the exact Testnet Lab command shown in the UI, then verify
the complete protected path with:

```bash
pnpm test:live
```
