import { spawnSync } from "node:child_process";
if (process.env.LIVE_SEPOLIA_TESTS !== "true")
  throw new Error("Live Sepolia acceptance requires LIVE_SEPOLIA_TESTS=true.");
for (const name of [
  "SEPOLIA_RPC_PRIMARY_URL",
  "SEPOLIA_RPC_SECONDARY_URL",
  "KEEPERHUB_API_KEY",
  "DEMO_VAULT_ADDRESS",
  "LIVE_TEST_EMAIL",
  "LIVE_TEST_PASSWORD",
])
  if (!process.env[name]) throw new Error(`${name} is required.`);
const result = spawnSync(
  "pnpm",
  ["--filter", "@aether/web", "exec", "playwright", "test", "--grep", "@live"],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
