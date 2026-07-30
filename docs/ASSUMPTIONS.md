# Assumptions

1. The requested `11_ENVIRONMENT_AND_SETUP.md` and `12_MCP_SKILLS_AND_CODEX_CONFIG.md` do not exist in this repository. Phase 1 follows the mode switches in `docs/02_AETHER_SYSTEM_ARCHITECTURE.md`: browser data mode is `mock|api`, while server/provider modes remain future backend concerns.
2. Authentication is represented as complete frontend flows without selecting a live identity provider. This preserves the provider boundary for the backend phase.
3. Base Sepolia, Ethereum Sepolia, and Arbitrum Sepolia provide realistic frontend network context; no live RPC is called.
4. KeeperHub wording describes an integration and never implies endorsement. All current execution data is deterministic mock evidence.
5. MSW state is browser-memory state and resets on full worker restart. Onboarding progression persists locally; canonical server records remain React Query owned.
6. The complete route list is implemented through a typed catch-all App Router boundary and feature-aware rendering, avoiding duplicated page wrappers while preserving stable URLs.
7. Chart requirements are satisfied through operational metrics, parity, health, and graph visualizations; generic analytics charts were intentionally avoided.
8. `NEXT_PUBLIC_AETHER_API_URL` is documented for the backend phase. The Phase 1 SDK defaults to `/v1`; deployment can reverse-proxy that path to the API without component changes.
