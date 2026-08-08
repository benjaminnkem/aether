import { existsSync, readFileSync } from "node:fs";
import Groq from "groq-sdk";

loadEnv();
const provider = process.argv[2];
if (provider === "chain") {
  if ((process.env.AETHER_ALLOWED_CHAIN_IDS ?? "11155111") !== "11155111")
    throw new Error("Only Ethereum Sepolia (11155111) may be allowlisted.");
  for (const name of ["SEPOLIA_RPC_PRIMARY_URL", "SEPOLIA_RPC_SECONDARY_URL"]) {
    const chain = Number.parseInt(
      await rpc(required(name), "eth_chainId", []),
      16,
    );
    if (chain !== 11155111) throw new Error(`${name} is not Ethereum Sepolia.`);
    console.log(`${name}: verified_11155111`);
  }
} else if (provider === "keeperhub") {
  const key = required("KEEPERHUB_API_KEY");
  if (!key.startsWith("kh_"))
    throw new Error("KEEPERHUB_API_KEY must begin kh_.");
  const base =
    process.env.KEEPERHUB_BASE_URL ?? "https://app.keeperhub.com/api";
  const response = await fetch(`${base}/chains`, {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`KeeperHub authentication failed (${response.status}).`);
  const payload = await response.json();
  const items = payload?.data ?? payload;
  if (
    !Array.isArray(items) ||
    !items.some(
      (item) => item.chainId === 11155111 && item.isEnabled && item.isTestnet,
    )
  )
    throw new Error("KeeperHub Sepolia execution is not enabled.");
  console.log("KEEPERHUB_SEPOLIA: authenticated_and_enabled");
  console.log("No transaction was broadcast.");
} else if (provider === "groq") {
  const key = required("GROQ_API_KEY");
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const allowlist = (
    process.env.GROQ_MODEL_ALLOWLIST ?? "llama-3.3-70b-versatile"
  ).split(",");
  if (!allowlist.includes(model))
    throw new Error("GROQ_MODEL is not allowlisted.");
  const payload = await new Groq({
    apiKey: key,
    timeout: 10_000,
    maxRetries: 0,
  }).models.list();
  if (!payload.data?.some((item) => item.id === model))
    throw new Error("Configured Groq model is unavailable.");
  console.log("GROQ_MODEL: authenticated_and_available");
  console.warn(
    "llama-3.3-70b-versatile has an announced August 16, 2026 shutdown; configure an allowlisted replacement explicitly.",
  );
} else throw new Error(`Unknown doctor: ${provider}`);

async function rpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`RPC returned ${response.status}.`);
  const payload = await response.json();
  if (payload.error || payload.result === undefined)
    throw new Error(`RPC ${method} failed.`);
  return payload.result;
}
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
function loadEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0 || line.trimStart().startsWith("#")) continue;
    const name = line.slice(0, separator).trim();
    if (!process.env[name])
      process.env[name] = line.slice(separator + 1).trim();
  }
}
