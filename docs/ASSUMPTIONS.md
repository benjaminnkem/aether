# Assumptions

1. The requested `11_ENVIRONMENT_AND_SETUP.md` and `12_MCP_SKILLS_AND_CODEX_CONFIG.md` do not exist in this repository. Phase 1 follows the mode switches in `docs/02_AETHER_SYSTEM_ARCHITECTURE.md`: browser data mode is `mock|api`, while server/provider modes remain future backend concerns.
2. Authentication is represented as complete frontend flows without selecting a live identity provider. This preserves the provider boundary for the backend phase.
3. Base Sepolia and Ethereum Sepolia provide realistic frontend network context; no live RPC is called.
4. KeeperHub wording describes an integration and never implies endorsement. All current execution data is deterministic mock evidence.
5. MSW state is browser-memory state and resets on full worker restart. Onboarding progression persists locally; canonical server records remain React Query owned.
6. The seven authenticated areas use a validated catch-all App Router boundary. Known legacy paths redirect to retained context; unrelated removed paths return not found.
7. Chart requirements are satisfied through operational metrics, parity, health, and graph visualizations; generic analytics charts were intentionally avoided.
8. `NEXT_PUBLIC_AETHER_API_URL` is documented for the backend phase. The Phase 1 SDK defaults to `/v1`; deployment can reverse-proxy that path to the API without component changes.
9. The reduced MVP demonstrates one organization, one protocol, and one selected
   environment. Multi-tenant identifiers remain in query keys and service
   contracts, but enterprise multi-protocol administration is post-MVP.
10. Product, security, and lifecycle marketing content remains on the landing
    page; separate public content routes are removed.
11. Operation and execution detail routes remain dynamic even though mock mode
    seeds one primary oracle-restoration flow.
12. Backend scope remains exactly one seeded organization (`org-arcadia`) and protocol
    (`arcadia`). Tenant identifiers are retained to enforce isolation, not to expose a
    portfolio or administration surface.
13. Local API tests use an in-memory state repository. The deployable API defaults to
    MongoDB, and canonical mutations require replica-set transactions.
14. Browser data mode and server provider mode are independent. `mock|api` selects the
    browser transport; `AETHER_PROVIDER_MODE=mock|live` selects server adapters.
15. KeeperHub's concrete external API specification was not present in the repository.
    The live adapter therefore uses the documented Aether-side typed contract:
    `POST /workflows`, `POST /simulations`, and correlation lookup. Deployment must map
    or replace this adapter if the provider contract differs; deterministic safety is
    upstream and unchanged.
16. The configured oracle getter calldata is deployment-specific and supplied by
    `AETHER_ORACLE_READ_CALLDATA`. The MVP only generates `setOracle(address)` writes.
17. JWT issuance/revocation is an external authentication boundary. This phase verifies
    signed issuer/audience/tenant claims and deliberately does not add a team or identity
    administration module.
