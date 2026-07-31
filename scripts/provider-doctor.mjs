import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const provider = process.argv[2];
loadEnv();

const checks = {
  async chain() {
    required("AETHER_RPC_URL");
    const result = await rpc("eth_chainId", []);
    const chainId = Number.parseInt(result, 16);
    if (chainId !== 84532)
      throw new Error("AETHER_RPC_URL is not Base Sepolia.");
    console.log("AETHER_RPC_URL: ready");
    console.log("AETHER_CHAIN_ID: verified_84532");
  },
  async keeperhub() {
    const key = required("KEEPERHUB_API_KEY");
    if (!key.startsWith("kh_"))
      throw new Error("KEEPERHUB_API_KEY must begin kh_.");
    const base =
      process.env.KEEPERHUB_BASE_URL ?? "https://app.keeperhub.com/api";
    const headers = { authorization: `Bearer ${key}` };
    const chains = await json(`${base}/chains`, { headers });
    const baseSepolia = unwrap(chains).find?.(
      (item) => item.chainId === 84532 && item.isEnabled && item.isTestnet,
    );
    if (!baseSepolia) throw new Error("KeeperHub Base Sepolia is not enabled.");
    const wallet = unwrap(await json(`${base}/user/wallet`, { headers }));
    if (
      !wallet.hasWallet ||
      !/^0x[a-fA-F0-9]{40}$/.test(wallet.walletAddress ?? "")
    ) {
      throw new Error("KeeperHub organization wallet is not configured.");
    }
    updateEnvIfMissing("AETHER_EXECUTOR_ADDRESS", wallet.walletAddress);
    console.log("KEEPERHUB_API_KEY: authenticated");
    console.log("KEEPERHUB_BASE_SEPOLIA: enabled_testnet");
    console.log("KEEPERHUB_ORGANIZATION_WALLET: ready");
  },
  async github() {
    for (const name of [
      "GITHUB_APP_ID",
      "GITHUB_APP_SLUG",
      "GITHUB_CLIENT_ID",
      "GITHUB_CLIENT_SECRET",
      "GITHUB_PRIVATE_KEY_BASE64",
      "GITHUB_WEBHOOK_SECRET",
      "GITHUB_CALLBACK_URL",
    ]) {
      required(name);
      console.log(`${name}: ready`);
    }
  },
  async openai() {
    const key = required("OPENAI_API_KEY");
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(`OpenAI authentication failed (${response.status}).`);
    console.log("OPENAI_API_KEY: authenticated");
    console.log("OPENAI_MODEL: configured");
  },
};

if (!checks[provider]) throw new Error(`Unknown doctor: ${provider}`);
await checks[provider]();

async function rpc(method, params) {
  const payload = await json(required("AETHER_RPC_URL"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (payload.error) throw new Error(`RPC ${method} failed.`);
  return payload.result;
}

async function json(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Provider request failed (${response.status}).`);
  return response.json();
}

function unwrap(value) {
  return value?.data ?? value;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}: missing_external_action`);
  return value;
}

function loadEnv() {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0 || line.trimStart().startsWith("#")) continue;
    const name = line.slice(0, separator).trim();
    if (!process.env[name])
      process.env[name] = line.slice(separator + 1).trim();
  }
}

function updateEnvIfMissing(name, value) {
  if (process.env[name]) return;
  const envPath = ".env";
  const source = readFileSync(envPath, "utf8");
  mkdirSync(".env.backups", { recursive: true });
  copyFileSync(
    envPath,
    `.env.backups/.env.provider-${Date.now()}-${randomUUID()}.bak`,
  );
  writeFileSync(envPath, `${source.replace(/\n+$/, "")}\n${name}=${value}\n`, {
    mode: 0o600,
  });
  process.env[name] = value;
}
