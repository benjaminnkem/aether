import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

if (!existsSync(".env"))
  throw new Error(".env is required. Copy .env.example first.");
const source = readFileSync(".env", "utf8");
const entries = new Map(
  source
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
copyFileSync(".env", `.env.${Date.now()}.bak`);
const generated = [];
for (const name of [
  "AETHER_ACCESS_TOKEN_SECRET",
  "AETHER_REFRESH_TOKEN_SECRET",
  "AETHER_COOKIE_SECRET",
  "AETHER_CSRF_SECRET",
])
  if (!entries.get(name)) {
    entries.set(name, randomBytes(48).toString("base64url"));
    generated.push(name);
  }
if (!entries.get("AETHER_CREDENTIAL_ENCRYPTION_KEY")) {
  entries.set(
    "AETHER_CREDENTIAL_ENCRYPTION_KEY",
    randomBytes(32).toString("base64"),
  );
  generated.push("AETHER_CREDENTIAL_ENCRYPTION_KEY");
}
const retired =
  /^(REDIS_URL|GITHUB_|OPENAI_|AETHER_ORACLE_|AETHER_PROTOCOL_|AETHER_ORGANIZATION_|AETHER_CHAIN_ID|AETHER_RPC_URL|AETHER_SECONDARY_RPC_URL)/;
const preserved = source
  .split(/\r?\n/)
  .filter((line) => !retired.test(line))
  .filter((line) => !generated.some((name) => line.startsWith(`${name}=`)));
for (const name of generated) preserved.push(`${name}=${entries.get(name)}`);
writeFileSync(".env", `${preserved.join("\n").replace(/\n+$/, "")}\n`, {
  mode: 0o600,
});
for (const name of [
  "MONGODB_URI",
  "SEPOLIA_RPC_PRIMARY_URL",
  "SEPOLIA_RPC_SECONDARY_URL",
  "KEEPERHUB_API_KEY",
  "GROQ_API_KEY",
  "DEMO_VAULT_ADDRESS",
])
  console.log(
    `${name}: ${entries.get(name) ? "configured" : "external_configuration_required"}`,
  );
console.warn(
  "GROQ_MODEL llama-3.3-70b-versatile has an announced shutdown date of August 16, 2026. Configure an allowlisted replacement explicitly before that date.",
);
