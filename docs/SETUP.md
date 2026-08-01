# Setup

## 1. Install

```bash
pnpm install
pnpm --filter @aether/web exec playwright install chromium
test -f .env || cp .env.example .env
docker compose up -d
```

Compose starts the Mongo replica set, Redis, and Mailpit. `pnpm env:doctor` generates
safe local values and never creates product records.

## 2. Fill the environment

Run:

```bash
pnpm env:doctor
```

The command must print variable **names and status only**, never values. It should classify:

- ready;
- generated;
- invalid;
- missing external action;
- optional.

Complete `docs/MANUAL_EXTERNAL_ACTIONS.md`.

If this database predates the live migration, inspect and then remove only legacy
fixed sample records:

```bash
pnpm migrate:legacy
pnpm migrate:legacy -- --apply
```

Historical Base Sepolia records are never relabelled. After the Ethereum deployment
registry exists, preview and optionally create a parallel persisted environment:

```bash
pnpm migrate:ethereum-sepolia
pnpm migrate:ethereum-sepolia -- --apply --source-protocol-id=<PERSISTED_PROTOCOL_ID>
```

## 3. Start the application

```bash
pnpm dev
```

Expected services:

- web: `http://localhost:3000`;
- API: `http://localhost:4000`;
- Swagger: `http://localhost:4000/v1/docs`;
- Mailpit: local URL defined by Compose;
- MongoDB replica set;
- Redis;
- worker.

There is no frontend-only mock command.

## 4. Local Anvil validation

Anvil remains a local integration environment, not a runtime mock.

```bash
anvil --chain-id 31337
pnpm --filter @aether/contracts exec forge test
```

The application must use the real API, database, queues, RPC, and onchain fixture.

## 5. Ethereum Sepolia deployment

1. Confirm `AETHER_CHAIN_ID=11155111`.
2. Confirm a reliable RPC URL.
3. Create/select a Foundry keystore or hardware wallet.
4. Fund the deployer.
5. Obtain the KeeperHub organization wallet and fund it.
6. Set the KeeperHub wallet as the narrow `ORACLE_ADMIN_ROLE` executor.
7. Run the deployment dry run.
8. Review exact transactions.
9. Broadcast.
10. write the real deployment registry.
11. verify contracts where possible.
12. run provider health checks.

Run `pnpm chain:deploy:dry`, review the output, then run `pnpm chain:deploy`. Both
commands validate chain `11155111`; the broadcast command records Foundry transaction
evidence in the deployment registry. Before deployment, `pnpm chain:doctor` is
expected to stop at `ethereum_sepolia_not_deployed` after all RPC/chain checks pass;
run it again after broadcast for bytecode, proxy, and `oracleStatus()` verification.

## 6. GitHub App

Codex must generate `docs/MANUAL_EXTERNAL_ACTIONS.md` with exact callback and webhook URLs based on the configured web/API origins.

Minimum GitHub App permissions:

- Repository metadata: read;
- Contents: read;
- Pull requests: read;
- Webhooks/events required for installation and push/release/PR provenance.

Do not request write permissions.

## 7. KeeperHub

The user must:

- create or select a KeeperHub organization;
- configure its organization wallet;
- generate an organization API key beginning with `kh_`;
- fund the organization wallet with Ethereum Sepolia ETH.

Then run:

```bash
pnpm keeperhub:doctor
```

The command must:

- validate authentication;
- fetch chains;
- confirm Ethereum Sepolia support;
- read the organization wallet;
- verify balance;
- perform a read-only or simulation-only health check;
- never broadcast during the doctor command.

## 8. Live acceptance

```bash
LIVE_TESTNET_ACCEPTANCE=1 pnpm test:live
```

This protected test never invents evidence and requires an already deployed fixture,
running hosted/local services, and an authenticated live-test account.

Then follow `docs/LIVE_TESTNET_UI_TEST_FLOW.md`.
