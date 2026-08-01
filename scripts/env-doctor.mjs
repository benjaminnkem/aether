import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const envPath = join(root.pathname, ".env");
if (!existsSync(envPath)) throw new Error(".env is required.");

const source = readFileSync(envPath, "utf8");
const values = new Map();
for (const line of source.split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator > 0 && !line.trimStart().startsWith("#")) {
    values.set(
      line.slice(0, separator).trim(),
      line.slice(separator + 1).trim(),
    );
  }
}

const backupDirectory = join(root.pathname, ".env.backups");
mkdirSync(backupDirectory, { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-");
copyFileSync(envPath, join(backupDirectory, `.env.${stamp}.bak`));

const generated = new Set();
const derived = new Set();
const migrated = new Set();

if (
  !values.get("NEXT_PUBLIC_AETHER_EXPLORER_URL") &&
  values.has("NEXT_PUBLIC_BASE_SEPOLIA_EXPLORER_URL")
) {
  values.set("NEXT_PUBLIC_AETHER_EXPLORER_URL", "https://sepolia.etherscan.io");
  migrated.add("NEXT_PUBLIC_AETHER_EXPLORER_URL");
}
if (values.get("AETHER_CHAIN_ID") === "84532") {
  values.set("AETHER_CHAIN_ID", "11155111");
  migrated.add("AETHER_CHAIN_ID");
}
if (
  values.get("AETHER_DEPLOYMENT_REGISTRY_PATH") ===
  "packages/contracts/deployments/84532.json"
) {
  values.set(
    "AETHER_DEPLOYMENT_REGISTRY_PATH",
    "packages/contracts/deployments/11155111.json",
  );
  migrated.add("AETHER_DEPLOYMENT_REGISTRY_PATH");
}
const localDefaults = {
  NEXT_PUBLIC_AETHER_API_URL: "http://localhost:4000/v1",
  NEXT_PUBLIC_AETHER_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_AETHER_EXPLORER_URL: "https://sepolia.etherscan.io",
  GITHUB_CALLBACK_URL: "http://localhost:4000/v1/github/callback",
  AETHER_WEB_ORIGINS: "http://localhost:3000",
  MONGODB_URI: "mongodb://127.0.0.1:27017/aether?replicaSet=rs0",
  REDIS_URL: "redis://127.0.0.1:6379",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
  SMTP_FROM: "Aether Local <aether@localhost>",
  AUTH_EMAIL_VERIFICATION_REQUIRED: "true",
  AETHER_ACCESS_TOKEN_TTL_SECONDS: "900",
  AETHER_REFRESH_TOKEN_TTL_SECONDS: "2592000",
  AETHER_CHAIN_ID: "11155111",
  AETHER_DEPLOYMENT_REGISTRY_PATH:
    "packages/contracts/deployments/11155111.json",
  AETHER_MAINNET_DISABLED: "true",
  AETHER_FINALITY_CONFIRMATIONS: "12",
  AETHER_MAX_ORACLE_AGE: "3600",
  KEEPERHUB_BASE_URL: "https://app.keeperhub.com/api",
  KEEPERHUB_REQUEST_TIMEOUT_MS: "10000",
  OPENAI_MODEL: "gpt-5.6-terra",
  OPENAI_REQUEST_TIMEOUT_MS: "20000",
};
for (const [name, value] of Object.entries(localDefaults)) {
  if (!values.get(name)) {
    values.set(name, value);
    generated.add(name);
  }
}
for (const name of [
  "AETHER_ACCESS_TOKEN_SECRET",
  "AETHER_REFRESH_TOKEN_SECRET",
  "AETHER_COOKIE_SECRET",
  "AETHER_CSRF_SECRET",
]) {
  if (!values.get(name)) {
    values.set(name, randomBytes(48).toString("base64url"));
    generated.add(name);
  }
}
if (!values.get("AETHER_CREDENTIAL_ENCRYPTION_KEY")) {
  values.set(
    "AETHER_CREDENTIAL_ENCRYPTION_KEY",
    randomBytes(32).toString("base64"),
  );
  generated.add("AETHER_CREDENTIAL_ENCRYPTION_KEY");
}
if (!values.get("GITHUB_WEBHOOK_SECRET")) {
  values.set("GITHUB_WEBHOOK_SECRET", randomBytes(32).toString("base64url"));
  generated.add("GITHUB_WEBHOOK_SECRET");
}
if (
  !values.get("KEEPERHUB_API_KEY") &&
  values.get("KEEPERHUB_API_TOKEN")?.startsWith("kh_")
) {
  values.set("KEEPERHUB_API_KEY", values.get("KEEPERHUB_API_TOKEN"));
  derived.add("KEEPERHUB_API_KEY");
}

const remove = new Set([
  "NEXT_PUBLIC_AETHER_DATA_MODE",
  "AETHER_PROVIDER_MODE",
  "AETHER_PERSISTENCE_MODE",
  "AETHER_AUTH_MODE",
  "AETHER_AI_ENABLED",
  "AETHER_OPENAI_ENABLED",
  "AETHER_JWT_SECRET",
  "AETHER_ORGANIZATION_ID",
  "AETHER_PROTOCOL_ID",
  "KEEPERHUB_API_TOKEN",
  "KEEPERHUB_WORKFLOW_ID",
  "GITHUB_READ_TOKEN",
  "NEXT_PUBLIC_BASE_SEPOLIA_EXPLORER_URL",
  "NEXT_PUBLIC_AETHER_GITHUB_URL",
]);
const preserved = source
  .split(/\r?\n/)
  .filter((line) => {
    const separator = line.indexOf("=");
    return separator <= 0 || !remove.has(line.slice(0, separator).trim());
  })
  .map((line) => {
    const separator = line.indexOf("=");
    if (separator <= 0 || line.trimStart().startsWith("#")) return line;
    const name = line.slice(0, separator).trim();
    return values.has(name) ? `${name}=${values.get(name)}` : line;
  });
const existingNames = new Set(
  preserved
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter(Boolean),
);
for (const [name, value] of values) {
  if (!existingNames.has(name) && !remove.has(name))
    preserved.push(`${name}=${value}`);
}
writeFileSync(envPath, `${preserved.join("\n").replace(/\n+$/, "")}\n`, {
  mode: 0o600,
});

const external = [
  "AETHER_RPC_URL",
  "KEEPERHUB_API_KEY",
  "GITHUB_APP_ID",
  "GITHUB_APP_SLUG",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_PRIVATE_KEY_BASE64",
  "OPENAI_API_KEY",
  "AETHER_CONTRACT_ADMIN_ADDRESS",
  "AETHER_EXECUTOR_ADDRESS",
  "AETHER_DRIFT_ACTOR_ADDRESS",
  "AETHER_FIXTURE_ADMIN_ADDRESS",
];
for (const name of [...new Set([...values.keys(), ...external])].sort()) {
  if (remove.has(name)) continue;
  const status = generated.has(name)
    ? "generated"
    : migrated.has(name)
      ? "migrated_from_base_sepolia"
      : derived.has(name)
        ? "derived"
        : values.get(name)
          ? "ready"
          : external.includes(name)
            ? "missing_external_action"
            : "optional";
  console.log(`${name}: ${status}`);
}
