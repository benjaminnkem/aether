---
name: aether-web3
description: Implement Aether demo contracts, blockchain observation, KeeperHub execution safety, simulation, idempotency, finality, verification, and forward correction.
---

# Aether Web3 Skill

Read the PRD, architecture, current KeeperHub docs/action schemas, and contract requirements before work.

## Rules

- Use Foundry and established OpenZeppelin patterns.
- Do not write Demo contract, this project needs to be up and running for preoduction testnet.
- Verify chain ID, code, ABI/proxy evidence, units, roles, and oracle freshness.
- Simulate the exact semantic request before KeeperHub execution.
- Use stable idempotency keys and reconcile unknown outcomes before retry.
- Treat Safe sender-context differences explicitly.
- A confirmed transaction is not success until independent postconditions/invariants pass.
- Never claim rollback of confirmed writes; build forward-correction operations.
- Mainnet is disabled by default and cannot be enabled by AI.
