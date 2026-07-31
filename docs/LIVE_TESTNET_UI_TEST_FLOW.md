# Aether Live Testnet UI Test Flow

This guide validates the complete product using real API, database, queues, providers, and Base Sepolia transactions.

## Preconditions

Before opening the UI:

- all services are healthy;
- no runtime mock flag exists;
- MongoDB and Redis are running;
- Base Sepolia fixture contracts are deployed;
- KeeperHub organization key is valid;
- KeeperHub organization wallet is funded;
- GitHub is connected;
- OpenAI is enabled;
- the user can sign in;
- `pnpm env:doctor` passes;
- `pnpm keeperhub:doctor` passes.

Record the starting time and current Git commit.

---

## Stage 1 — Create a real account

1. Open `/signup`.
2. Enter a real test email and strong password.
3. Submit.

Expected:

- API creates the user in MongoDB.
- Password is never returned.
- Verification email is sent through the configured SMTP provider/Mailpit.
- UI asks for email verification.
- Audit contains `auth.user_registered`.
- Reloading does not lose the user.

4. Verify the email.
5. Sign in.

Expected:

- Secure authentication cookies are set.
- `/app/overview` is protected.
- Refreshing the page keeps the session.
- Signing out revokes the refresh session.

---

## Stage 2 — Onboard an organization and protocol

1. Create an organization.
2. Create the protocol.
3. Choose Base Sepolia.
4. Enter the live deployed proxy/market address.
5. Allow the server to load the generated ABI or verified ABI.
6. Complete onboarding.

Expected:

- Organization, membership, protocol, network, and contract records exist in MongoDB.
- IDs are generated records, not `org-arcadia`/`arcadia` constants.
- Wrong chain or invalid address is rejected.
- Contract bytecode is checked.
- Overview is empty/healthy based on real observation, not seeded cards.

---

## Stage 3 — Connect GitHub

1. Open Protocol Setup → GitHub.
2. Select **Connect GitHub**.
3. Complete the GitHub App installation/authorization.
4. Select the repository and desired-state path.
5. Synchronize.

Expected:

- Connection status comes from GitHub.
- Repository, default branch, installation ID, and exact commit SHA are persisted.
- Desired-state provenance links to a real commit.
- No token is displayed in the browser.
- Webhook signature validation succeeds.
- Replaying the same webhook delivery does not duplicate audit events.

---

## Stage 4 — Connect KeeperHub

1. Open Protocol Setup → KeeperHub.
2. Click **Test connection**.

Expected:

- API calls real KeeperHub.
- UI shows the real organization/wallet status.
- Base Sepolia is reported as supported.
- Wallet balance is shown or summarized without exposing credentials.
- Missing wallet or low balance produces an actionable error.
- No transaction is sent by the health check.

---

## Stage 5 — Define desired state

1. Open Desired State.
2. Select the market contract.
3. Set the approved oracle address.
4. Set the expected version/implementation.
5. Set paused state to false.
6. Configure the freshness invariant.
7. Save.

Expected:

- Validation uses the real chain and generated ABI.
- A versioned desired-state record is stored.
- The active version references the user and GitHub commit when available.
- Audit contains `desired_state.created` or `desired_state.updated`.
- Reloading shows the saved version.

---

## Stage 6 — Run a healthy scan

1. Open Overview or Protocol Setup.
2. Click **Run scan**.

Expected:

- API creates a scan job.
- Worker reads Base Sepolia at a pinned block.
- SSE shows progress.
- Observed oracle matches desired oracle.
- No critical drift exists.
- Audit contains scan start/completion.
- Reloading keeps the scan and result.

---

## Stage 7 — Create real testnet drift

Use the repository’s approved Base Sepolia fixture tool. This may be:

- a protected Testnet Lab UI action signed by a connected test wallet; or
- the exact Foundry script shown by the UI.

Do not use a mock scenario selector.

Create a real change from the approved oracle to the designated stale/out-of-policy oracle.

Expected:

- A real Base Sepolia transaction is produced.
- The explorer shows the changed state.
- The transaction is not the correction transaction.
- The application does not update until it observes the chain.

---

## Stage 8 — Detect the drift

1. Click **Run scan**, or wait for the configured scheduled/event scan.
2. Open Drift.

Expected:

- A critical oracle drift appears.
- Desired and observed addresses are real.
- Evidence includes chain ID, block, transaction hash, actor, and timestamp.
- The stale freshness invariant fails.
- The health score changes based on persisted findings.
- No field comes from a demo scenario.

---

## Stage 9 — Investigate with AI

1. Open the drift drawer.
2. Click **Investigate**.

Expected:

- Backend sends bounded redacted evidence to OpenAI.
- UI distinguishes facts, inferences, confidence, and recommendation.
- AI output is persisted as advisory.
- AI cannot approve or execute.
- Invalid AI output produces a real error, not a canned answer.
- Audit contains the provider/model/request correlation without exposing prompts containing secrets.

---

## Stage 10 — Generate the correction operation

1. Click **Generate correction plan**.
2. Open Operation Detail.

Expected:

- Deterministic code produces only `setOracle(approvedAddress)`.
- Target, chain, function, args, value, calldata hash, and plan hash are visible.
- Preconditions and postconditions are explicit.
- Safety checks validate allowlisted chain/contract/function and zero value.
- AI prose is not used as calldata.
- Operation is immutable after approval begins.

---

## Stage 11 — Simulate with KeeperHub

1. Click **Simulate exact request**.

Expected:

- Real `POST /api/execute/contract-call` is sent with `simulate: true`.
- The request uses chain ID `84532`, exact contract, exact ABI/function/args, and zero value.
- Response shows real sender, gas estimate, and `wouldRevert`.
- Simulation evidence is bound to the operation.
- A failed/reverting simulation blocks execution.
- No transaction hash exists yet.

---

## Stage 12 — Approve

1. After the immutable simulation is healthy, click **Approve exact plan** as an
   authorized reviewer.

Expected:

- Server checks role, threshold, distinct identity, expiry, plan hash, and simulation binding.
- Approval is persisted and auditable.
- A viewer cannot approve.
- Editing desired state or plan invalidates prior approval.
- CSRF and authentication checks are enforced.

---

## Stage 13 — Execute with KeeperHub

1. Review the final confirmation.
2. Click **Execute with KeeperHub** once.

Expected:

- The exact simulated request is submitted without `simulate`.
- A unique idempotency key is used.
- The intent is already durable before the network call.
- A real KeeperHub direct execution ID is shown.
- Double-click/reload does not create a second transaction.
- UI transitions from submitted to confirming based on real status.
- A real Base Sepolia transaction hash and explorer link appear.

Record:

- operation ID;
- KeeperHub execution ID;
- transaction hash;
- transaction URL.

---

## Stage 14 — Independent verification

Wait for the configured finality threshold.

Expected:

- Aether verifies receipt status.
- It verifies canonical block hash.
- It reads `oracleStatus()` at a pinned post-finality block.
- Approved oracle and freshness both pass.
- Operation becomes `verified`.
- Drift becomes `resolved`.
- Health returns to healthy.
- Transaction confirmation alone is not sufficient without postcondition verification.

---

## Stage 15 — Audit

Open Audit Log.

Expected chronological events:

1. user/organization/protocol created;
2. GitHub connected/synchronized;
3. desired state saved;
4. healthy scan;
5. drift observed;
6. investigation requested/completed;
7. plan generated;
8. safety checks completed;
9. KeeperHub simulation completed;
10. approval granted;
11. execution intent persisted;
12. KeeperHub execution submitted;
13. transaction observed/confirmed;
14. independent verification passed;
15. drift resolved.

Every event must reference real database records. Related IDs must correlate across drift, operation, execution, provider, transaction, and verification.

---

## Stage 16 — Recovery tests

### Browser refresh

Refresh during execution.

Expected: state resumes from API/SSE; no duplicated write.

### Worker restart

Restart worker after submission.

Expected: durable intent and outbox recover; no duplicated write.

### Provider timeout

Inject a timeout after submit in the controlled acceptance environment.

Expected: status becomes `unknown/reconciling`; automatic submit retry stays locked.

### Verification failure

Make the approved oracle stale after the pointer write.

Expected: execution becomes partial; Aether creates a forward-correction operation and never claims rollback.

---

## Pass criteria

The flow passes only when:

- every stage uses real runtime services;
- no demo controls or scenario IDs are involved;
- at least one correction transaction was executed through KeeperHub on Base Sepolia;
- the transaction is independently verified;
- audit correlation is complete;
- refresh/restart does not duplicate the transaction;
- Playwright reproduces the critical path;
- the evidence bundle contains no secrets.
