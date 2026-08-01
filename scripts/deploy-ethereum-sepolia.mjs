import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

loadEnv();
const broadcast = process.argv.includes("--broadcast");
const rpcUrl = required("AETHER_RPC_URL");
if (required("AETHER_CHAIN_ID") !== "11155111") {
  throw new Error("AETHER_CHAIN_ID must be 11155111 for deployment.");
}
if (process.env.AETHER_MAINNET_DISABLED !== "true") {
  throw new Error("AETHER_MAINNET_DISABLED must be true for deployment.");
}
for (const name of [
  "AETHER_CONTRACT_ADMIN_ADDRESS",
  "AETHER_EXECUTOR_ADDRESS",
  "AETHER_DRIFT_ACTOR_ADDRESS",
  "AETHER_FIXTURE_ADMIN_ADDRESS",
]) {
  const value = required(name);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a public EVM address.`);
  }
}
const chainResponse = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_chainId",
    params: [],
  }),
  signal: AbortSignal.timeout(10_000),
});
const chainPayload = await chainResponse.json();
if (Number.parseInt(chainPayload.result ?? "0x0", 16) !== 11155111) {
  throw new Error(
    "Deployment is locked to Ethereum Sepolia chain ID 11155111.",
  );
}

const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).stdout.trim();
const account =
  process.env.AETHER_FOUNDRY_ACCOUNT ?? "aether-ethereum-sepolia-deployer";
const arguments_ = [
  "--filter",
  "@aether/contracts",
  "exec",
  "forge",
  "script",
  "script/DeployArcadia.s.sol:DeployArcadia",
  "--rpc-url",
  rpcUrl,
  "--account",
  account,
];
if (broadcast) arguments_.push("--broadcast");
const result = spawnSync("pnpm", arguments_, {
  stdio: "inherit",
  env: {
    ...process.env,
    AETHER_SOURCE_COMMIT: sourceCommit,
    AETHER_RECORD_DEPLOYMENT: broadcast ? "true" : "false",
  },
});
if (result.status !== 0) process.exit(result.status ?? 1);
if (broadcast) recordBroadcastTransactions();

function recordBroadcastTransactions() {
  const broadcastPath =
    "packages/contracts/broadcast/DeployArcadia.s.sol/11155111/run-latest.json";
  const deploymentPath = "packages/contracts/deployments/11155111.json";
  if (!existsSync(broadcastPath) || !existsSync(deploymentPath)) {
    throw new Error("Foundry broadcast or deployment registry is missing.");
  }
  const broadcastRecord = JSON.parse(readFileSync(broadcastPath, "utf8"));
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
  const receiptsByHash = new Map(
    (broadcastRecord.receipts ?? []).map((receipt) => [
      String(receipt.transactionHash ?? receipt.hash ?? "").toLowerCase(),
      receipt,
    ]),
  );
  deployment.deploymentTransactions = (broadcastRecord.transactions ?? [])
    .filter((transaction) => /^0x[a-fA-F0-9]{64}$/.test(transaction.hash ?? ""))
    .map((transaction) => {
      const receipt = receiptsByHash.get(transaction.hash.toLowerCase());
      const rawBlock = receipt?.blockNumber;
      return {
        transactionHash: transaction.hash,
        transactionType: transaction.transactionType ?? "unknown",
        contractName: transaction.contractName ?? null,
        contractAddress: transaction.contractAddress ?? null,
        blockNumber:
          typeof rawBlock === "string" ? Number.parseInt(rawBlock, 16) : null,
      };
    });
  deployment.roleAssignments = {
    DEFAULT_ADMIN_ROLE: [deployment.admin],
    ORACLE_ADMIN_ROLE: [deployment.executor],
    DRIFT_FIXTURE_ROLE: [deployment.driftActor],
    FIXTURE_ADMIN: [deployment.fixtureAdmin],
  };
  deployment.active = true;
  writeFileSync(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(
    "Ethereum Sepolia deployment registry updated from Foundry broadcast evidence.",
  );
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function loadEnv() {
  if (!existsSync(".env")) throw new Error(".env is required.");
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0 || line.trimStart().startsWith("#")) continue;
    const name = line.slice(0, separator).trim();
    if (!process.env[name]) {
      process.env[name] = line.slice(separator + 1).trim();
    }
  }
}
