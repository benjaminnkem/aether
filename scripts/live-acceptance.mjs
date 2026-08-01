import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

loadEnv();

const deploymentPath = "packages/contracts/deployments/11155111.json";
if (!existsSync(deploymentPath)) {
  throw new Error("Ethereum Sepolia deployment registry is missing.");
}
const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
if (deployment.deployed !== true) {
  throw new Error(
    "Ethereum Sepolia fixture is not deployed. Live acceptance will not manufacture evidence.",
  );
}
for (const name of [
  "AETHER_RPC_URL",
  "KEEPERHUB_API_KEY",
  "OPENAI_API_KEY",
  "GITHUB_APP_ID",
  "GITHUB_PRIVATE_KEY_BASE64",
  "LIVE_TEST_EMAIL",
  "LIVE_TEST_PASSWORD",
]) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
}
const result = spawnSync(
  "pnpm",
  ["--filter", "@aether/web", "exec", "playwright", "test", "--grep", "@live"],
  {
    stdio: "inherit",
    env: { ...process.env, LIVE_TESTNET_ACCEPTANCE: "1" },
  },
);
process.exit(result.status ?? 1);

function loadEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0 || line.trimStart().startsWith("#")) continue;
    const name = line.slice(0, separator).trim();
    if (!process.env[name]) {
      process.env[name] = line.slice(separator + 1).trim();
    }
  }
}
