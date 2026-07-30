import { arcadiaMarketArtifact } from "@aether/contracts/server";
import { z } from "zod";
import type { TransactionRequest } from "./contracts";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const deploymentSchema = z.object({
  chainId: z.number().int().positive(),
  deployed: z.literal(true),
  implementation: addressSchema,
  marketProxy: addressSchema,
  approvedOracle: addressSchema,
  unauthorizedOracle: addressSchema,
  admin: addressSchema,
  executor: addressSchema,
  driftActor: addressSchema,
  fixtureAdmin: addressSchema,
  maxOracleAge: z.number().int().positive(),
});

export type ArcadiaDeployment = z.infer<typeof deploymentSchema>;

function selector(signature: string): string {
  const value = arcadiaMarketArtifact.methodIdentifiers[signature];
  if (!value || !/^[a-fA-F0-9]{8}$/.test(value)) {
    throw new Error(
      `Generated ArcadiaMarket artifact is missing ${signature}.`,
    );
  }
  return `0x${value.toLowerCase()}`;
}

export const arcadiaSelectors = Object.freeze({
  oracle: selector("oracle()"),
  oracleStatus: selector("oracleStatus()"),
  setOracle: selector("setOracle(address)"),
});

export function encodeSetOracleCalldata(oracle: string): string {
  const parsed = addressSchema.parse(oracle).slice(2).toLowerCase();
  return `${arcadiaSelectors.setOracle}${parsed.padStart(64, "0")}`;
}

export function buildSetOracleTransactionRequest(input: {
  chainId: number;
  market: string;
  desiredOracle: string;
}): TransactionRequest {
  return {
    chainId: z.number().int().positive().parse(input.chainId),
    target: addressSchema.parse(input.market),
    functionSignature: "setOracle(address)",
    calldata: encodeSetOracleCalldata(input.desiredOracle),
    valueWei: "0",
    desiredOracle: addressSchema.parse(input.desiredOracle),
  };
}

export function getArcadiaDeployment(
  chainId: number,
): ArcadiaDeployment | undefined {
  const deployment = arcadiaMarketArtifact.deployments[String(chainId)];
  if (!deployment) return undefined;
  return deploymentSchema.parse(deployment);
}

export const arcadiaMarketAbi = arcadiaMarketArtifact.abi;
