# Environment

Browser-safe variables only:

| Variable                          | Values        | Purpose                                    |
| --------------------------------- | ------------- | ------------------------------------------ |
| `NEXT_PUBLIC_AETHER_DATA_MODE`    | `mock`, `api` | Defaults to mock; only `api` enables HTTP. |
| `NEXT_PUBLIC_AETHER_API_URL`      | URL/path      | Future API reverse-proxy documentation.    |
| `NEXT_PUBLIC_AETHER_GITHUB_URL`   | Public URL    | Optional repository link.                  |
| `NEXT_PUBLIC_AETHER_EXPLORER_URL` | Public URL    | Explorer links.                            |

No secret variables belong in `apps/web`.
