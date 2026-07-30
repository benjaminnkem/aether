# Environment

Browser-safe variables:

| Variable                          | Values        | Purpose                                    |
| --------------------------------- | ------------- | ------------------------------------------ |
| `NEXT_PUBLIC_AETHER_DATA_MODE`    | `mock`, `api` | Defaults to mock; only `api` enables HTTP. |
| `NEXT_PUBLIC_AETHER_API_URL`      | URL/path      | API base URL; defaults to `/v1`.           |
| `NEXT_PUBLIC_AETHER_GITHUB_URL`   | Public URL    | Optional repository link.                  |
| `NEXT_PUBLIC_AETHER_EXPLORER_URL` | Public URL    | Explorer links.                            |

Server variables:

| Variable                      | Purpose                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| `PORT`                        | API port, default `4000`.                                                   |
| `AETHER_AUTH_MODE`            | `development` supplies the fixed local owner; any other value requires JWT. |
| `AETHER_JWT_SECRET`           | JWT verification secret; required and at least 32 characters in production. |
| `AETHER_PERSISTENCE_MODE`     | `mongo` by default; `memory` is restricted to API tests and smoke startup.  |
| `MONGODB_URI`                 | MongoDB replica-set URI used by API and worker.                             |
| `REDIS_URL`                   | Redis URI used by BullMQ.                                                   |
| `AETHER_WEB_ORIGINS`          | Comma-separated exact CORS origins.                                         |
| `AETHER_ORGANIZATION_ID`      | Fixed MVP organization identifier, default `org-arcadia`.                   |
| `AETHER_PROTOCOL_ID`          | Fixed MVP protocol identifier, default `arcadia`.                           |
| `AETHER_PROVIDER_MODE`        | `mock` or `live`, independent from browser data mode.                       |
| `AETHER_RPC_URL`              | Server-only EVM RPC URL in live provider mode.                              |
| `AETHER_ORACLE_READ_CALLDATA` | Calldata for the configured oracle getter.                                  |
| `KEEPERHUB_BASE_URL`          | KeeperHub API origin.                                                       |
| `KEEPERHUB_API_TOKEN`         | Server-only KeeperHub bearer credential.                                    |
| `GITHUB_READ_TOKEN`           | Optional server-only read token for release provenance.                     |

No server variable may use a `NEXT_PUBLIC_` prefix. Provider tokens, RPC credentials,
and signing material must not be passed through protocol setup payloads. A production
deployment should source secrets from its secret manager and rotate them independently
of application images.
