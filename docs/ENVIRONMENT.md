# Environment

Aether has one runtime mode: **live application mode**. Local development may use local infrastructure such as MongoDB, Redis, Mailpit, and Anvil, but the application never fabricates provider success.

## Rules

- `.env` is never committed.
- Codex must read the existing `.env` without printing secret values.
- Existing non-empty user values must be preserved unless invalid.
- Codex may generate local cryptographic secrets.
- Codex must create `.env.example` with names and descriptions only.
- Startup validates the environment with a strict schema.
- Production and testnet startup fail on missing required variables.
- Secrets must be redacted from logs, errors, audit records, screenshots, and final reports.

## Values Codex may generate automatically

Codex may safely generate and write these when absent:

- `AETHER_ACCESS_TOKEN_SECRET`
- `AETHER_REFRESH_TOKEN_SECRET`
- `AETHER_COOKIE_SECRET`
- `AETHER_CSRF_SECRET`
- `AETHER_CREDENTIAL_ENCRYPTION_KEY`
- `GITHUB_WEBHOOK_SECRET`
- local database names
- local service URLs
- local Mailpit settings
- cryptographically random internal IDs

Use suitable lengths and encodings. Never print generated values in the final response.

## Browser-safe variables

| Variable                          | Purpose                    |
| --------------------------------- | -------------------------- |
| `NEXT_PUBLIC_AETHER_API_URL`      | NestJS API URL.            |
| `NEXT_PUBLIC_AETHER_APP_URL`      | Canonical web URL.         |
| `NEXT_PUBLIC_AETHER_EXPLORER_URL` | Transaction/address links. |

There is no browser mock-mode variable.
`NEXT_PUBLIC_BASE_SEPOLIA_EXPLORER_URL` is obsolete and is removed by `env:doctor`
after writing a timestamped local backup.

Next.js runs from `apps/web`, so its configuration explicitly loads the repository-root
`.env` before compilation and validates all three browser-safe URLs. These values are
embedded into the browser bundle at build time; restart `pnpm dev` after changing one.
An injected shell or CI value takes precedence over the file.

## Core server variables

| Variable                           | Purpose                                                 |
| ---------------------------------- | ------------------------------------------------------- |
| `NODE_ENV`                         | `development`, `test`, or `production`.                 |
| `PORT`                             | API port.                                               |
| `AETHER_WEB_ORIGINS`               | Exact comma-separated CORS origins.                     |
| `MONGODB_URI`                      | MongoDB replica-set URI.                                |
| `REDIS_URL`                        | BullMQ Redis URI.                                       |
| `AETHER_ACCESS_TOKEN_SECRET`       | Access JWT signing secret.                              |
| `AETHER_REFRESH_TOKEN_SECRET`      | Refresh JWT signing secret.                             |
| `AETHER_COOKIE_SECRET`             | Cookie signing/encryption secret.                       |
| `AETHER_CSRF_SECRET`               | CSRF token secret.                                      |
| `AETHER_CREDENTIAL_ENCRYPTION_KEY` | Base64 32-byte AES-256-GCM key.                         |
| `AETHER_ACCESS_TOKEN_TTL_SECONDS`  | Short access-token lifetime.                            |
| `AETHER_REFRESH_TOKEN_TTL_SECONDS` | Refresh-session lifetime.                               |
| `AETHER_FINALITY_CONFIRMATIONS`    | Ethereum Sepolia confirmation threshold.                |
| `AETHER_MAX_ORACLE_AGE`            | Oracle freshness invariant and deployment fixture.      |
| `AETHER_MAINNET_DISABLED`          | Must be `true` for this release.                        |
| `AETHER_SECONDARY_RPC_URL`         | Optional independent Ethereum Sepolia verification RPC. |

For local Compose, use `mongodb://127.0.0.1:27018/aether?replicaSet=rs0`. The MongoDB
container and its published host port both use `27018`, so the replica-set member is
reachable during transactions without colliding with a separate local Mongo install.
API and worker startup locate the repository-root `.env` even though Turbo runs them
from their package directories. Existing process variables override file values.

Remove fixed organization and protocol IDs from runtime configuration. IDs are created in MongoDB through onboarding.

## KeeperHub variables

| Variable                       | Purpose                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `KEEPERHUB_BASE_URL`           | Must be `https://app.keeperhub.com/api` unless explicitly using an approved alternative. |
| `KEEPERHUB_API_KEY`            | Organization key beginning with `kh_`.                                                   |
| `KEEPERHUB_REQUEST_TIMEOUT_MS` | Bounded provider timeout.                                                                |

The canonical MVP uses KeeperHub Direct Execution and therefore does not require `KEEPERHUB_WORKFLOW_ID`.

Codex must validate the key with real KeeperHub calls and derive/store the KeeperHub organization wallet address through the supported API. It must not infer an executor address.

## Chain variables

| Variable                          | Purpose                                                              |
| --------------------------------- | -------------------------------------------------------------------- |
| `AETHER_CHAIN_ID`                 | Must be `11155111`.                                                  |
| `AETHER_RPC_URL`                  | Reliable Ethereum Sepolia RPC.                                       |
| `AETHER_DEPLOYMENT_REGISTRY_PATH` | Generated live deployment artifact.                                  |
| `AETHER_CONTRACT_ADMIN_ADDRESS`   | Address receiving admin authority.                                   |
| `AETHER_EXECUTOR_ADDRESS`         | KeeperHub organization wallet receiving the narrow correction role.  |
| `AETHER_DRIFT_ACTOR_ADDRESS`      | Test-fixture actor authorized only to create an out-of-policy state. |
| `AETHER_FIXTURE_ADMIN_ADDRESS`    | Test-fixture freshness controller.                                   |

Signing keys must not be plain `.env` variables. Use Foundry keystore, hardware wallet, or an explicitly approved secret-manager signer.

## GitHub App variables

| Variable                    | Purpose                                |
| --------------------------- | -------------------------------------- |
| `GITHUB_APP_ID`             | GitHub App numeric ID.                 |
| `GITHUB_PRIVATE_KEY_BASE64` | Base64-encoded GitHub App private key. |
| `GITHUB_WEBHOOK_SECRET`     | Webhook signature secret.              |
| `GITHUB_SETUP_URL`          | Post-installation Setup URL.           |

Aether does not request a GitHub user OAuth token, so a Client ID, Client Secret, and
OAuth Callback URL are not runtime requirements. In the GitHub App registration,
configure `GITHUB_SETUP_URL` under **Post installation → Setup URL** and enable
**Redirect on update**. The webhook URL remains a separate endpoint.

For a temporary single-user testnet deployment, Codex may support a server-only fine-grained read token only when the GitHub App cannot be configured, but the UI must state that this is an operator-managed connection and must not pretend to perform OAuth.

`pnpm env:doctor` creates an ignored backup before normalization, removes obsolete
runtime-mode variables, generates safe local cryptographic values, and reports names
and readiness only. Provider doctors are read-only or simulation-only and never
broadcast. The GitHub doctor verifies App identity, callback shape, and read-only
permissions; KeeperHub and chain doctors fail before simulation when the RPC is not
Ethereum Sepolia.

## OpenAI variables

| Variable                    | Purpose                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`            | Server-only API key.                                                             |
| `OPENAI_MODEL`              | Supported structured-output model selected after checking current official docs. |
| `OPENAI_REQUEST_TIMEOUT_MS` | Provider timeout.                                                                |

AI remains advisory-only. Deterministic code builds calldata and controls authorization.

## Email variables

| Variable        | Purpose                          |
| --------------- | -------------------------------- |
| `SMTP_HOST`     | SMTP provider or local Mailpit.  |
| `SMTP_PORT`     | SMTP port.                       |
| `SMTP_USER`     | Provider username when required. |
| `SMTP_PASSWORD` | Provider password when required. |
| `SMTP_FROM`     | Verified sender.                 |

Signup creates an authenticated cookie session immediately and returns the short-lived
access token in the response. Email delivery is retained only for password recovery;
the browser does not persist tokens in local storage.

## External values the user must obtain

Codex cannot fabricate these:

1. KeeperHub account, organization API key, configured organization wallet, and testnet wallet funds.
2. Reliable Ethereum Sepolia RPC URL.
3. Foundry deployer keystore or hardware-wallet access and Ethereum Sepolia funds.
4. GitHub App credentials, or an explicitly approved temporary fine-grained read token.
5. OpenAI API key.
6. SMTP provider credentials and verified sender for hosted email.
7. WalletConnect project ID only when browser-wallet test tooling is retained.
8. Hosted URLs and DNS/TLS configuration.

Codex must list only missing items in `docs/MANUAL_EXTERNAL_ACTIONS.md`.
