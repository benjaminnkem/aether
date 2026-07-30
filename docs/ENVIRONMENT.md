# Environment

Browser-safe variables:

| Variable                          | Values        | Purpose                                    |
| --------------------------------- | ------------- | ------------------------------------------ |
| `NEXT_PUBLIC_AETHER_DATA_MODE`    | `mock`, `api` | Defaults to mock; only `api` enables HTTP. |
| `NEXT_PUBLIC_AETHER_API_URL`      | URL/path      | API base URL; defaults to `/v1`.           |
| `NEXT_PUBLIC_AETHER_GITHUB_URL`   | Public URL    | Optional repository link.                  |
| `NEXT_PUBLIC_AETHER_EXPLORER_URL` | Public URL    | Explorer links.                            |

Server variables:

| Variable                           | Purpose                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `PORT`                             | API port, default `4000`.                                                    |
| `AETHER_AUTH_MODE`                 | `development` supplies the fixed local owner; any other value requires JWT.  |
| `AETHER_JWT_SECRET`                | JWT verification secret; required and at least 32 characters in production.  |
| `AETHER_PERSISTENCE_MODE`          | `mongo` by default; `memory` is restricted to API tests and smoke startup.   |
| `MONGODB_URI`                      | MongoDB replica-set URI used by API and worker.                              |
| `REDIS_URL`                        | Redis URI used by BullMQ.                                                    |
| `AETHER_WEB_ORIGINS`               | Comma-separated exact CORS origins.                                          |
| `AETHER_ORGANIZATION_ID`           | Fixed MVP organization identifier, default `org-arcadia`.                    |
| `AETHER_PROTOCOL_ID`               | Fixed MVP protocol identifier, default `arcadia`.                            |
| `AETHER_PROVIDER_MODE`             | `mock` or `live`, independent from browser data mode.                        |
| `AETHER_RPC_URL`                   | Server-only EVM RPC URL in live provider mode.                               |
| `AETHER_ORACLE_READ_CALLDATA`      | Optional `oracleStatus()` calldata override; defaults to generated selector. |
| `KEEPERHUB_BASE_URL`               | KeeperHub API origin.                                                        |
| `KEEPERHUB_API_TOKEN`              | Server-only KeeperHub bearer credential.                                     |
| `KEEPERHUB_WORKFLOW_ID`            | Pre-reviewed testnet workflow receiving the exact authorized request.        |
| `GITHUB_READ_TOKEN`                | Optional server-only read token for release provenance.                      |
| `AETHER_OPENAI_ENABLED`            | `true` enables the optional advisory assistant in live provider mode.        |
| `OPENAI_API_KEY`                   | Server-only OpenAI credential; required only when the assistant is enabled.  |
| `OPENAI_MODEL`                     | Optional Responses API model override; defaults to `gpt-5.6-sol`.            |
| `AETHER_CREDENTIAL_ENCRYPTION_KEY` | Base64-encoded 32-byte AES-256-GCM key for stored credentials.               |

Foundry script variables are public configuration, not secrets:

| Variable                        | Purpose                                                     |
| ------------------------------- | ----------------------------------------------------------- |
| `AETHER_CONTRACT_ADMIN_ADDRESS` | Default admin receiving role-administration authority.      |
| `AETHER_EXECUTOR_ADDRESS`       | KeeperHub executor receiving `ORACLE_ADMIN_ROLE`.           |
| `AETHER_DRIFT_ACTOR_ADDRESS`    | Fixture actor able to create an out-of-policy oracle state. |
| `AETHER_FIXTURE_ADMIN_ADDRESS`  | Fixture-only freshness writer.                              |
| `AETHER_UNPRIVILEGED_ADDRESS`   | Caller used by the missing-role simulation.                 |
| `AETHER_MAX_ORACLE_AGE`         | Freshness window in seconds; defaults to `3600`.            |
| `AETHER_RECORD_DEPLOYMENT`      | Writes the selected chain deployment artifact when `true`.  |

No server variable may use a `NEXT_PUBLIC_` prefix. Provider tokens, RPC credentials,
and signing material must not be passed through protocol setup payloads. A production
deployment should source secrets from its secret manager and rotate them independently
of application images.

`KEEPERHUB_BASE_URL` must include the documented `/api` prefix, for example
`https://app.keeperhub.com/api`. Mainnet chain ID `1` remains prohibited regardless of
provider configuration.

The contract scripts deliberately define no private-key environment variable. Use
Foundry's keystore, hardware-wallet, or unlocked local-account CLI options. Generated
deployment files contain public addresses only.
