import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "artifacts", "server");
const contractNames = ["ArcadiaMarket", "MockOracle"];

fs.mkdirSync(output, { recursive: true });

const deployments = {};
const deploymentDirectory = path.join(root, "deployments");
if (fs.existsSync(deploymentDirectory)) {
  for (const name of fs.readdirSync(deploymentDirectory)) {
    if (!/^\d+\.json$/.test(name)) continue;
    const deployment = JSON.parse(
      fs.readFileSync(path.join(deploymentDirectory, name), "utf8"),
    );
    if (deployment.deployed === true)
      deployments[String(deployment.chainId)] = deployment;
  }
}

const generated = {};
for (const contractName of contractNames) {
  const source = path.join(
    root,
    "out",
    `${contractName}.sol`,
    `${contractName}.json`,
  );
  const artifact = JSON.parse(fs.readFileSync(source, "utf8"));
  generated[contractName] = {
    contractName,
    abi: artifact.abi,
    methodIdentifiers: artifact.methodIdentifiers,
    deployments,
  };
  fs.writeFileSync(
    path.join(output, `${contractName}.json`),
    `${JSON.stringify(generated[contractName], null, 2)}\n`,
  );
}

const moduleSource = `"use strict";
const ArcadiaMarket = require("./ArcadiaMarket.json");
const MockOracle = require("./MockOracle.json");
module.exports = {
  arcadiaMarketArtifact: ArcadiaMarket,
  mockOracleArtifact: MockOracle,
};
`;
fs.writeFileSync(path.join(output, "index.js"), moduleSource);
fs.writeFileSync(
  path.join(output, "index.d.ts"),
  `export interface ServerContractArtifact {
  contractName: string;
  abi: readonly Record<string, unknown>[];
  methodIdentifiers: Readonly<Record<string, string>>;
  deployments: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}
export const arcadiaMarketArtifact: ServerContractArtifact;
export const mockOracleArtifact: ServerContractArtifact;
`,
);
