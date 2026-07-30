# Security

Phase 1 contains no private keys or provider secrets. Browser inputs and mock API outputs are parsed with shared Zod schemas. The UI communicates immutable plan hashes, exact simulation intent, deterministic policy, role-based approval, mainnet lock, stable idempotency intent, independent verification, and forward correction. Server enforcement is deferred to the backend phase and must never rely on browser state.
