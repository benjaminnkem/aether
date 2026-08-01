# Manual External Actions

Evidence date: 2026-08-01. This list contains only remaining external authority
boundaries. Do not paste secrets into chat, source control, browser storage,
screenshots, or audit records. Write them directly to `.env` or a hosted secret
manager.

The existing KeeperHub organization key/wallet, GitHub App credentials, OpenAI key and
model are configured. GitHub App authentication and OpenAI model availability passed.
Do not replace those credentials for this migration.

## 1. Replace the RPC with Ethereum Sepolia

The current `AETHER_RPC_URL` responds, but it does not report Ethereum Sepolia
`11155111` (`0xaa36a7`). Obtain an HTTPS Ethereum Sepolia endpoint from your selected
RPC provider (Alchemy, Infura, QuickNode, a self-hosted node, or equivalent) and set:

```env
AETHER_RPC_URL=https://your-provider.example/your-private-path
```

Keep `AETHER_CHAIN_ID=11155111` and `AETHER_MAINNET_DISABLED=true`. Do not use an
Ethereum mainnet or Base Sepolia endpoint. Verify:

```bash
pnpm chain:doctor
```

Before deployment the doctor should pass RPC, chain, latest-block, explorer, and
mainnet checks, then stop honestly at `ethereum_sepolia_not_deployed`.

## 2. Authorize and fund an Ethereum Sepolia deployer

No usable Foundry keystore matching the configured contract administrator was found.
Create an operator-controlled keystore locally, or use an approved hardware signer.
Never put its private key or password in `.env`.

```bash
cast wallet import aether-ethereum-sepolia-deployer --interactive
cast wallet address --account aether-ethereum-sepolia-deployer
```

Fund that public address with Sepolia ETH from a faucet linked by the Ethereum
Sepolia network documentation or your RPC provider. Put only its public address in
`AETHER_CONTRACT_ADMIN_ADDRESS`. Confirm the public addresses in
`AETHER_DRIFT_ACTOR_ADDRESS` and `AETHER_FIXTURE_ADMIN_ADDRESS` are wallets you
control for the fixture; do not provide their private keys to Aether.

Dry-run, review, then broadcast:

```bash
pnpm chain:deploy:dry
pnpm chain:deploy
```

Both commands reject every chain except `11155111`. The broadcast creates new
Ethereum Sepolia contracts and populates
`packages/contracts/deployments/11155111.json`; it never rewrites the historical Base
registry.

## 3. Fund and verify the KeeperHub Ethereum Sepolia wallet

The KeeperHub key is an organization key beginning with `kh_`; `/api/chains` reported
Ethereum Sepolia enabled/testnet and the organization wallet is configured. Once the
RPC is corrected, send Sepolia ETH to that existing organization wallet if its
Ethereum Sepolia balance is zero. Base Sepolia ETH is not usable on Ethereum Sepolia.

The deployment initializer grants that wallet only `ORACLE_ADMIN_ROLE`. The separate
drift wallet receives `DRIFT_FIXTURE_ROLE`; KeeperHub does not receive admin or drift
authority. Verify balance, role, and a simulation-only contract call—without a
broadcast—with:

```bash
pnpm keeperhub:doctor
```

## 4. Install the configured GitHub App and select provenance

The GitHub App credentials authenticate successfully. If it is not already installed
on the desired-state repository, open the configured App’s installation page under
[GitHub Apps](https://github.com/settings/apps), install it for only the selected
repository, and keep permissions read-only:

- Metadata: read;
- Contents: read;
- Pull requests: read;
- events: installation, installation repositories, push, release, pull request.

Local callback: `http://localhost:4000/v1/github/callback`.
Hosted callback: `<HTTPS_API_ORIGIN>/v1/github/callback`.
Hosted webhook: `<HTTPS_API_ORIGIN>/v1/github/webhooks`.

Complete **Protocol Setup → GitHub** and select the repository, default branch, and
new Ethereum Sepolia desired-state path/commit. Historical Base commits remain
historical. Reverify credentials with `pnpm github:doctor`.

## 5. Hosted email and URLs, only when deploying off localhost

Local email uses Mailpit and needs no external SMTP credential. For a hosted release,
obtain SMTP host/port/user/password and a verified sender from your email provider;
set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` for password
recovery. Also replace local app/API/callback origins with their final HTTPS values and
update the GitHub App settings exactly.

## 6. Create the live-acceptance account and continue

After deployment and all doctors pass, create a dedicated account through `/signup`,
onboard a new Ethereum Sepolia protocol/environment, connect GitHub, and
store its credentials locally as `LIVE_TEST_EMAIL` and `LIVE_TEST_PASSWORD`. These
are application test credentials, not provider keys, and must not be committed.

Apply the additive data migration only if historical Base protocol records need a new
parallel Ethereum Sepolia environment:

```bash
pnpm migrate:ethereum-sepolia
pnpm migrate:ethereum-sepolia -- --apply --source-protocol-id=<PERSISTED_PROTOCOL_ID>
```

Then run:

```bash
LIVE_TESTNET_ACCEPTANCE=1 pnpm test:live
```
