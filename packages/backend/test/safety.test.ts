import { describe, expect, it } from "vitest";
import { ExecutionSafety, SafetyViolation } from "../src/safety";
import { validateRuntimeChainEnvironment } from "../src/chains";
import {
  arcadiaSelectors,
  buildSetOracleTransactionRequest,
  encodeSetOracleCalldata,
  getArcadiaDeployment,
} from "../src/contract-artifacts";
import { CredentialCipher } from "../src/security";
import { simulationResultSchema } from "../src/contracts";
import { activeLiveChain } from "@aether/shared";

const request = buildSetOracleTransactionRequest({
  chainId: activeLiveChain.chainId,
  market: "0x7D4A3AfF7c4C51B1726a91c738ACb6F227127C3f",
  desiredOracle: "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311",
});

const safety = new ExecutionSafety();
const planHash = ExecutionSafety.planHash(request, "dsv-1");
const simulation = {
  simulationId: "sim-1",
  planHash,
  success: true,
  gasEstimate: "284211",
  postconditionMatched: true,
  blockNumber: 17_924_118,
};
const policy = {
  allowedChainIds: [activeLiveChain.chainId],
  allowedTargets: [request.target],
  allowedFunctions: ["setOracle(address)" as const],
  maximumValueWei: "0",
  requireSimulation: true as const,
  requireIndependentVerification: true as const,
  approvalThreshold: 1,
  prohibitSelfApproval: false,
};

describe("ExecutionSafety", () => {
  it("normalizes a provider null error code on successful simulations", () => {
    expect(
      simulationResultSchema.parse({ ...simulation, errorCode: null }),
    ).toEqual(simulation);
  });

  it("uses generated selectors and exposes the deterministic Anvil deployment", () => {
    expect(arcadiaSelectors.setOracle).toBe("0x7adbf973");
    expect(arcadiaSelectors.oracleStatus).toBe("0x994c821d");
    expect(getArcadiaDeployment(31337)?.marketProxy).toBe(
      "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    );
  });

  it("authorizes only the exact simulated and approved request", () => {
    expect(() =>
      safety.authorize({
        request,
        policy,
        planHash,
        simulation,
        approvals: [
          {
            actorId: "user-owner",
            planHash,
            simulationId: "sim-1",
            decision: "approve",
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects an approval bound to another plan", () => {
    expect(() =>
      safety.authorize({
        request,
        policy,
        planHash,
        simulation,
        approvals: [
          {
            actorId: "user-owner",
            planHash: `0x${"1".repeat(64)}`,
            simulationId: "sim-1",
            decision: "approve",
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        ],
      }),
    ).toThrowError(SafetyViolation);
  });

  it("rejects Base Sepolia as an active execution chain", () => {
    expect(() =>
      safety.authorize({
        request: { ...request, chainId: 84532 },
        policy,
        planHash,
        simulation,
        approvals: [],
      }),
    ).toThrowError(/not allowlisted/);
  });

  it("rejects mainnet even when all other request fields are valid", () => {
    expect(() =>
      safety.authorize({
        request: { ...request, chainId: 1 },
        policy,
        planHash,
        simulation,
        approvals: [],
      }),
    ).toThrowError(/not allowlisted/);
  });

  it("cannot reuse a Base simulation or approval for Ethereum Sepolia", () => {
    const baseRequest = { ...request, chainId: 84532 };
    const basePlanHash = ExecutionSafety.planHash(baseRequest, "dsv-base");
    expect(() =>
      safety.authorize({
        request,
        policy,
        planHash,
        simulation: { ...simulation, planHash: basePlanHash },
        approvals: [
          {
            actorId: "user-owner",
            planHash: basePlanHash,
            simulationId: "sim-1",
            decision: "approve",
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        ],
      }),
    ).toThrowError(/exact-request simulation/);
  });

  it("changes the immutable plan hash when chain or deployment address changes", () => {
    const basePlanHash = ExecutionSafety.planHash(
      { ...request, chainId: 84532 },
      "dsv-1",
    );
    const newAddressPlanHash = ExecutionSafety.planHash(
      {
        ...request,
        target: "0x1111111111111111111111111111111111111111",
      },
      "dsv-1",
    );
    expect(basePlanHash).not.toBe(planHash);
    expect(newAddressPlanHash).not.toBe(planHash);
  });

  it("rejects value transfer even if a wider policy is supplied", () => {
    expect(() =>
      safety.authorize({
        request: { ...request, valueWei: "1" },
        policy: { ...policy, maximumValueWei: "2" },
        planHash,
        simulation,
        approvals: [],
      }),
    ).toThrowError(/zero value/);
  });

  it("rejects calldata that does not encode the desired oracle", () => {
    expect(() =>
      safety.authorize({
        request: {
          ...request,
          calldata: encodeSetOracleCalldata(
            "0x91A6D4bF5c0A8dF0E9F12D78771133796a33B741",
          ),
        },
        policy,
        planHash,
        simulation,
        approvals: [],
      }),
    ).toThrowError(/exact approved/);
  });
});

describe("runtime chain environment", () => {
  const valid = {
    AETHER_CHAIN_ID: "11155111",
    AETHER_MAINNET_DISABLED: "true",
    AETHER_RPC_URL: "https://rpc.example.invalid",
  } as NodeJS.ProcessEnv;

  it("accepts only the canonical Ethereum Sepolia live configuration", () => {
    expect(() => validateRuntimeChainEnvironment(valid)).not.toThrow();
    expect(() =>
      validateRuntimeChainEnvironment({ ...valid, AETHER_CHAIN_ID: "84532" }),
    ).toThrow(/Ethereum Sepolia/);
    expect(() =>
      validateRuntimeChainEnvironment({ ...valid, AETHER_CHAIN_ID: "1" }),
    ).toThrow(/prohibited/);
  });
});

describe("CredentialCipher", () => {
  const scope = {
    organizationId: "org-arcadia",
    protocolId: "arcadia",
    provider: "keeperhub",
  };

  it("encrypts credentials with tenant/provider-bound authenticated data", () => {
    const cipher = new CredentialCipher(Buffer.alloc(32, 7).toString("base64"));
    const encrypted = cipher.encrypt("kh_server_only", scope);
    expect(encrypted).not.toContain("kh_server_only");
    expect(cipher.decrypt(encrypted, scope)).toBe("kh_server_only");
    expect(() =>
      cipher.decrypt(encrypted, { ...scope, protocolId: "other-protocol" }),
    ).toThrow();
  });
});
