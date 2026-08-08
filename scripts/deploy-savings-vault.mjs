import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const broadcast = process.argv.includes("--broadcast");
if (broadcast && process.env.LIVE_SEPOLIA_TESTS !== "true") {
  fail("Live deployment requires LIVE_SEPOLIA_TESTS=true.");
}

const rpcUrl = broadcast
  ? required("SEPOLIA_RPC_PRIMARY_URL")
  : process.env.SEPOLIA_RPC_PRIMARY_URL?.trim();
const executor = required("SAVINGS_KEEPERHUB_EXECUTOR_ADDRESS");
const privateKey = required("PRIVATE_KEY");

if (rpcUrl) {
  let parsedRpc;
  try {
    parsedRpc = new URL(rpcUrl);
  } catch {
    fail("SEPOLIA_RPC_PRIMARY_URL must be a valid HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(parsedRpc.protocol))
    fail("SEPOLIA_RPC_PRIMARY_URL must use HTTP or HTTPS.");
}
if (!/^0x[a-fA-F0-9]{40}$/.test(executor))
  fail("SAVINGS_KEEPERHUB_EXECUTOR_ADDRESS must be a 20-byte 0x address.");
if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey))
  fail("PRIVATE_KEY must be a 32-byte 0x private key.");

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const contractsRoot = resolve(repositoryRoot, "packages/contracts");
const scriptTarget = `${resolve(contractsRoot, "script/DeployAetherSavings.s.sol")}:DeployAetherSavings`;
const result = spawnSync(
  "forge",
  [
    "script",
    "--root",
    contractsRoot,
    scriptTarget,
    ...(rpcUrl ? ["--rpc-url", rpcUrl] : []),
    ...(broadcast ? ["--broadcast"] : []),
  ],
  { cwd: repositoryRoot, env: process.env, stdio: "inherit" },
);
if (result.error) fail(`Unable to start Foundry: ${result.error.message}`);
process.exitCode = result.status ?? 1;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required.`);
  return value;
}
function fail(message) {
  console.error(`savings-deployment: ${message}`);
  process.exit(1);
}
