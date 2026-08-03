import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createSign, randomUUID } from "node:crypto";

const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;
const ETHEREUM_SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";
const PROXY_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const provider = process.argv[2];
loadEnv();

const checks = {
  async chain() {
    required("AETHER_RPC_URL");
    if (required("AETHER_CHAIN_ID") !== String(ETHEREUM_SEPOLIA_CHAIN_ID)) {
      throw new Error("AETHER_CHAIN_ID must be Ethereum Sepolia (11155111).");
    }
    if (process.env.AETHER_MAINNET_DISABLED !== "true") {
      throw new Error("AETHER_MAINNET_DISABLED must be true.");
    }
    if (
      required("NEXT_PUBLIC_AETHER_EXPLORER_URL") !== ETHEREUM_SEPOLIA_EXPLORER
    ) {
      throw new Error(
        "NEXT_PUBLIC_AETHER_EXPLORER_URL is not Sepolia Etherscan.",
      );
    }
    const result = await rpc("eth_chainId", []);
    const chainId = Number.parseInt(result, 16);
    if (chainId !== ETHEREUM_SEPOLIA_CHAIN_ID)
      throw new Error("AETHER_RPC_URL is not Ethereum Sepolia.");
    const latestBlock = await rpc("eth_blockNumber", []);
    if (
      !/^0x[0-9a-f]+$/i.test(latestBlock) ||
      Number.parseInt(latestBlock, 16) <= 0
    ) {
      throw new Error("Ethereum Sepolia latest block is unavailable.");
    }
    console.log("AETHER_RPC_URL: ready");
    console.log("AETHER_CHAIN_ID: verified_11155111");
    console.log("AETHER_MAINNET_DISABLED: verified");
    console.log("NEXT_PUBLIC_AETHER_EXPLORER_URL: verified");
    console.log("ETHEREUM_SEPOLIA_LATEST_BLOCK: ready");

    const deployment = loadDeployment();
    if (!deployment.deployed) {
      throw new Error(
        "AETHER_DEPLOYMENT_REGISTRY_PATH: ethereum_sepolia_not_deployed",
      );
    }
    assertDeploymentAddresses(deployment);
    const blockTag = latestBlock;
    for (const address of [
      deployment.marketProxy,
      deployment.implementation,
      deployment.approvedOracle,
      deployment.unauthorizedOracle,
    ]) {
      const code = await rpc("eth_getCode", [address, blockTag]);
      if (!/^0x[0-9a-f]+$/i.test(code) || code === "0x") {
        throw new Error("Ethereum Sepolia deployment bytecode is missing.");
      }
    }
    const proxySlot = await rpc("eth_getStorageAt", [
      deployment.marketProxy,
      PROXY_IMPLEMENTATION_SLOT,
      blockTag,
    ]);
    if (
      `0x${proxySlot.slice(-40)}`.toLowerCase() !==
      deployment.implementation.toLowerCase()
    ) {
      throw new Error("ERC-1967 implementation does not match the registry.");
    }
    const artifact = loadArtifact();
    const oracleResult = await rpc("eth_call", [
      {
        to: deployment.marketProxy,
        data: `0x${artifact.methodIdentifiers["oracleStatus()"]}`,
      },
      blockTag,
    ]);
    if (!/^0x[0-9a-f]{192}$/i.test(oracleResult)) {
      throw new Error("oracleStatus() returned malformed ABI data.");
    }
    console.log("AETHER_DEPLOYMENT_REGISTRY_PATH: deployed");
    console.log("ETHEREUM_SEPOLIA_CONTRACT_BYTECODE: verified");
    console.log("ETHEREUM_SEPOLIA_PROXY_IMPLEMENTATION: verified");
    console.log("ETHEREUM_SEPOLIA_ORACLE_STATUS: decoded");
  },
  async keeperhub() {
    const key = required("KEEPERHUB_API_KEY");
    if (!key.startsWith("kh_"))
      throw new Error("KEEPERHUB_API_KEY must begin kh_.");
    const base =
      process.env.KEEPERHUB_BASE_URL ?? "https://app.keeperhub.com/api";
    const headers = { authorization: `Bearer ${key}` };
    const chains = await json(`${base}/chains`, { headers });
    const ethereumSepolia = unwrap(chains).find?.(
      (item) =>
        item.chainId === ETHEREUM_SEPOLIA_CHAIN_ID &&
        item.isEnabled &&
        item.isTestnet,
    );
    if (!ethereumSepolia)
      throw new Error("KeeperHub Ethereum Sepolia is not enabled.");
    const wallet = unwrap(await json(`${base}/user/wallet`, { headers }));
    if (
      !wallet.hasWallet ||
      !/^0x[a-fA-F0-9]{40}$/.test(wallet.walletAddress ?? "")
    ) {
      throw new Error("KeeperHub organization wallet is not configured.");
    }
    updateEnvIfMissing("AETHER_EXECUTOR_ADDRESS", wallet.walletAddress);

    const rpcChainId = Number.parseInt(await rpc("eth_chainId", []), 16);
    if (rpcChainId !== ETHEREUM_SEPOLIA_CHAIN_ID) {
      throw new Error("KeeperHub readiness requires an Ethereum Sepolia RPC.");
    }
    const balance = await rpc("eth_getBalance", [
      wallet.walletAddress,
      "latest",
    ]);
    if (BigInt(balance) === 0n) {
      throw new Error("KeeperHub organization wallet has no Sepolia ETH.");
    }

    const deployment = loadDeployment();
    if (!deployment.deployed) {
      throw new Error(
        "KeeperHub role/simulation check requires a live deployment.",
      );
    }
    assertDeploymentAddresses(deployment);
    const artifact = loadArtifact();
    const role = await rpc("eth_call", [
      {
        to: deployment.marketProxy,
        data: `0x${artifact.methodIdentifiers["ORACLE_ADMIN_ROLE()"]}`,
      },
      "latest",
    ]);
    const hasRoleData = `0x${artifact.methodIdentifiers["hasRole(bytes32,address)"]}${role.slice(2).padStart(64, "0")}${wallet.walletAddress.slice(2).padStart(64, "0")}`;
    const hasRole = await rpc("eth_call", [
      { to: deployment.marketProxy, data: hasRoleData },
      "latest",
    ]);
    if (BigInt(hasRole) !== 1n) {
      throw new Error(
        "KeeperHub wallet is missing Ethereum Sepolia ORACLE_ADMIN_ROLE.",
      );
    }

    const simulation = unwrap(
      await json(`${base}/execute/contract-call`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "x-request-id": `doctor-${randomUUID()}`,
        },
        body: JSON.stringify({
          contractAddress: deployment.marketProxy,
          chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
          functionName: "setOracle",
          functionArgs: JSON.stringify([deployment.approvedOracle]),
          abi: JSON.stringify(artifact.abi),
          value: "0",
          simulate: true,
        }),
      }),
    );
    if (!simulation?.success || simulation.wouldRevert !== false) {
      throw new Error("KeeperHub Ethereum Sepolia simulation is not ready.");
    }
    console.log("KEEPERHUB_API_KEY: authenticated");
    console.log("KEEPERHUB_ETHEREUM_SEPOLIA: enabled_testnet");
    console.log("KEEPERHUB_ORGANIZATION_WALLET: ready");
    console.log("KEEPERHUB_SEPOLIA_ETH: funded");
    console.log("KEEPERHUB_ORACLE_ADMIN_ROLE: verified");
    console.log("KEEPERHUB_SIMULATION: passed_no_broadcast");
  },
  async github() {
    for (const name of [
      "GITHUB_APP_ID",
      "GITHUB_APP_SLUG",
      "GITHUB_PRIVATE_KEY_BASE64",
      "GITHUB_WEBHOOK_SECRET",
      "GITHUB_SETUP_URL",
    ]) {
      required(name);
    }
    const now = Math.floor(Date.now() / 1_000);
    const appId = required("GITHUB_APP_ID");
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64Url(
      JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }),
    );
    const signingInput = `${header}.${payload}`;
    const signer = createSign("RSA-SHA256");
    signer.update(signingInput);
    const privateKey = Buffer.from(
      required("GITHUB_PRIVATE_KEY_BASE64"),
      "base64",
    ).toString("utf8");
    const jwt = `${signingInput}.${signer.sign(privateKey, "base64url")}`;
    const app = await json("https://api.github.com/app", {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${jwt}`,
        "user-agent": "aether-environment-doctor",
        "x-github-api-version": "2022-11-28",
      },
    });
    if (String(app.id) !== appId || app.slug !== required("GITHUB_APP_SLUG")) {
      throw new Error(
        "GitHub App identity does not match the configured values.",
      );
    }
    const permissions = app.permissions ?? {};
    for (const permission of ["metadata", "contents", "pull_requests"]) {
      if (permissions[permission] !== "read") {
        throw new Error(
          `GitHub App permission ${permission} is ${String(permissions[permission] ?? "not granted")}; it must be configured as read-only.`,
        );
      }
    }
    const writePermission = Object.entries(permissions).find(([, level]) =>
      ["write", "admin"].includes(String(level)),
    );
    if (writePermission) {
      throw new Error(
        `GitHub App permission ${writePermission[0]} is ${writePermission[1]}; Aether requires read-only provenance.`,
      );
    }
    console.log("GITHUB_APP_CREDENTIALS: authenticated");
    console.log("GITHUB_APP_IDENTITY: verified");
    console.log("GITHUB_APP_PERMISSIONS: verified_read_only");
    const setupUrl = new URL(required("GITHUB_SETUP_URL"));
    if (!setupUrl.pathname.endsWith("/v1/github/callback")) {
      throw new Error(
        "GITHUB_SETUP_URL must end with /v1/github/callback for the installation flow.",
      );
    }
    console.log("GITHUB_SETUP_URL: configured");
  },
  async openai() {
    const key = required("OPENAI_API_KEY");
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(`OpenAI authentication failed (${response.status}).`);
    const payload = await response.json();
    const model = required("OPENAI_MODEL");
    if (
      !Array.isArray(payload.data) ||
      !payload.data.some((item) => item.id === model)
    ) {
      throw new Error(
        "OPENAI_MODEL is not available to the configured project.",
      );
    }
    console.log("OPENAI_API_KEY: authenticated");
    console.log("OPENAI_MODEL: available");
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

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function loadDeployment() {
  const path =
    process.env.AETHER_DEPLOYMENT_REGISTRY_PATH ??
    "packages/contracts/deployments/11155111.json";
  if (!existsSync(path)) {
    throw new Error("AETHER_DEPLOYMENT_REGISTRY_PATH: missing");
  }
  const deployment = JSON.parse(readFileSync(path, "utf8"));
  if (deployment.chainId !== ETHEREUM_SEPOLIA_CHAIN_ID) {
    throw new Error("Deployment registry is not Ethereum Sepolia.");
  }
  return deployment;
}

function loadArtifact() {
  const path = "packages/contracts/artifacts/server/ArcadiaMarket.json";
  if (!existsSync(path)) throw new Error("ArcadiaMarket artifact is missing.");
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertDeploymentAddresses(deployment) {
  for (const name of [
    "marketProxy",
    "implementation",
    "approvedOracle",
    "unauthorizedOracle",
  ]) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(deployment[name] ?? "")) {
      throw new Error(`Deployment ${name} is missing or invalid.`);
    }
  }
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
