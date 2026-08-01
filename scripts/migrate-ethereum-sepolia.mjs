import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const requireFromApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const mongoose = requireFromApi("mongoose");

loadEnv();
const apply = process.argv.includes("--apply");
const selectedProtocol = argumentValue("--source-protocol-id");
const registryPath =
  process.env.AETHER_DEPLOYMENT_REGISTRY_PATH ??
  "packages/contracts/deployments/11155111.json";
if (!existsSync(registryPath))
  throw new Error("Deployment registry is missing.");
const deployment = JSON.parse(readFileSync(registryPath, "utf8"));
if (deployment.chainId !== 11155111) {
  throw new Error("Migration registry must target Ethereum Sepolia 11155111.");
}
if (apply && deployment.deployed !== true) {
  throw new Error(
    "Apply is blocked until an authorized Ethereum Sepolia deployment is recorded.",
  );
}

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
await mongoose.connect(process.env.MONGODB_URI);
const database = mongoose.connection.db;
if (!database) throw new Error("MongoDB connection is unavailable.");

const baseNetworks = await database
  .collection("networks")
  .find({
    chainId: 84532,
    ...(selectedProtocol ? { protocolId: selectedProtocol } : {}),
  })
  .toArray();
const candidates = [];
for (const baseNetwork of baseNetworks) {
  const source = await database.collection("protocols").findOne({
    organizationId: baseNetwork.organizationId,
    protocolId: baseNetwork.protocolId,
  });
  if (!source) continue;
  const suffix = createHash("sha256")
    .update(`${source.organizationId}:${source.protocolId}:11155111`)
    .digest("hex")
    .slice(0, 16);
  const protocolId = `pro_ethsep_${suffix}`;
  const exists = await database.collection("protocols").findOne({
    organizationId: source.organizationId,
    protocolId,
  });
  candidates.push({
    organizationId: source.organizationId,
    sourceProtocolId: source.protocolId,
    protocolId,
    alreadyMigrated: Boolean(exists),
  });
  if (!apply || exists) continue;

  const now = new Date();
  await database.collection("protocols").insertOne({
    organizationId: source.organizationId,
    protocolId,
    sourceProtocolId: source.protocolId,
    name: `${source.name || "Aether Demo Protocol"} — Ethereum Sepolia`,
    environment: "Ethereum Sepolia",
    governance: source.governance ?? "",
    status: "setup_required",
    health: 0,
    createdAt: now,
    updatedAt: now,
  });
  await database.collection("networks").insertOne({
    organizationId: source.organizationId,
    protocolId,
    networkId: "ethereum-sepolia",
    name: "Ethereum Sepolia",
    chainId: 11155111,
    rpcMetadata: {
      migratedFromChainId: 84532,
      validationRequired: true,
    },
    createdAt: now,
    updatedAt: now,
  });
  await database.collection("contracts").insertOne({
    organizationId: source.organizationId,
    protocolId,
    contractId: `ctr_${randomUUID()}`,
    networkId: "ethereum-sepolia",
    chainId: 11155111,
    name: "ArcadiaMarket",
    address: deployment.marketProxy,
    proxyType: "ERC1967",
    implementationAddress: deployment.implementation,
    abiProvenance: "generated-foundry-artifact",
    createdAt: now,
    updatedAt: now,
  });
}

await mongoose.disconnect();
console.log(
  JSON.stringify(
    {
      applied: apply,
      sourceChainId: 84532,
      targetChainId: 11155111,
      historicalRecordsRewritten: false,
      candidates,
      desiredStateAction:
        "Create a new version through the authenticated API after RPC/contract validation and GitHub provenance synchronization.",
    },
    null,
    2,
  ),
);

function loadEnv() {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0 || line.trimStart().startsWith("#")) continue;
    const name = line.slice(0, separator).trim();
    if (!process.env[name])
      process.env[name] = line.slice(separator + 1).trim();
  }
}

function argumentValue(name) {
  const argument = process.argv.find((value) => value.startsWith(`${name}=`));
  return argument?.slice(name.length + 1);
}
