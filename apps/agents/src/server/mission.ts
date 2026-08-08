import { createHash } from "node:crypto";
import { createMissionSchema, type MissionDefinition } from "@aether/shared";
import {
  getAddress,
  keccak256,
  parseUnits,
  stringToHex,
  type Address,
} from "viem";
import { configuration } from "./config";

const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const savingsVaultAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operationKey", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "beneficiary", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "depositAmount",
    stateMutability: "view",
    inputs: [{ name: "operationKey", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type SavingsIntent = {
  beneficiary: Address;
  displayAmount: string;
  amount: string;
  operationKey: `0x${string}`;
  clientRequestId: string;
};

export function resolveIntent(
  beneficiary: Address,
  displayAmount: string,
  clientRequestId: string,
): SavingsIntent {
  const config = configuration();
  const amount = parseUnits(displayAmount, config.tokenDecimals);
  const minimum = parseUnits(config.minimumAmount, config.tokenDecimals);
  const maximum = parseUnits(config.maximumAmount, config.tokenDecimals);
  if (amount < minimum || amount > maximum) {
    throw new SavingsInputError(
      `Amount must be between ${config.minimumAmount} and ${config.maximumAmount} ${config.tokenSymbol}.`,
    );
  }
  return {
    beneficiary: getAddress(beneficiary),
    displayAmount,
    amount: amount.toString(),
    operationKey: keccak256(
      stringToHex(
        `aether-savings:${clientRequestId}:${beneficiary.toLowerCase()}`,
      ),
    ),
    clientRequestId,
  };
}

export function missionFor(intent: SavingsIntent) {
  const config = configuration();
  const definition: MissionDefinition = {
    schemaVersion: 1,
    objective: `Deposit ${intent.displayAmount} ${config.tokenSymbol} for ${intent.beneficiary} in the configured Sepolia savings vault.`,
    steps: [
      {
        id: "authorize-savings-vault",
        name: "Authorize the exact savings amount",
        dependsOn: [],
        retryClass: "SEMANTICALLY_IDEMPOTENT",
        action: {
          chainId: 11155111,
          contractAddress: config.tokenAddress,
          functionName: "approve",
          functionArgs: [config.vaultAddress, intent.amount],
          abi: [...erc20ApproveAbi],
          valueWei: "0",
        },
        proof: {
          kind: "ERC20_ALLOWANCE",
          token: config.tokenAddress,
          owner: config.executorAddress,
          spender: config.vaultAddress,
          operator: "EQ",
          amount: intent.amount,
        },
        compensation: {
          id: "revoke-savings-vault",
          action: {
            chainId: 11155111,
            contractAddress: config.tokenAddress,
            functionName: "approve",
            functionArgs: [config.vaultAddress, "0"],
            abi: [...erc20ApproveAbi],
            valueWei: "0",
          },
          proof: {
            kind: "ERC20_ALLOWANCE",
            token: config.tokenAddress,
            owner: config.executorAddress,
            spender: config.vaultAddress,
            operator: "EQ",
            amount: "0",
          },
        },
      },
      {
        id: "deposit-savings",
        name: "Deposit into the beneficiary savings balance",
        dependsOn: ["authorize-savings-vault"],
        retryClass: "PROVABLE_EFFECT",
        action: {
          chainId: 11155111,
          contractAddress: config.vaultAddress,
          functionName: "deposit",
          functionArgs: [
            intent.operationKey,
            config.tokenAddress,
            intent.beneficiary,
            intent.amount,
          ],
          abi: [...savingsVaultAbi],
          valueWei: "0",
        },
        proof: {
          kind: "CONTRACT_READ",
          address: config.vaultAddress,
          functionName: "depositAmount",
          args: [intent.operationKey],
          abi: [...savingsVaultAbi],
          operator: "EQ",
          expected: intent.amount,
        },
      },
    ],
    invariants: [
      {
        id: "sepolia-only",
        kind: "CHAIN_ID",
        severity: "CRITICAL",
        parameters: {},
      },
      {
        id: "fixed-targets",
        kind: "TARGET_ALLOWLIST",
        severity: "CRITICAL",
        parameters: {},
      },
      {
        id: "fixed-functions",
        kind: "FUNCTION_ALLOWLIST",
        severity: "CRITICAL",
        parameters: {},
      },
      {
        id: "bounded-writes",
        kind: "MAX_WRITES",
        severity: "CRITICAL",
        parameters: { maximum: "3" },
      },
      {
        id: "known-outcomes-only",
        kind: "NO_UNKNOWN_ATTEMPTS",
        severity: "CRITICAL",
        parameters: {},
      },
    ],
    recoveryPolicy: {
      maxRecoverySpendWei: "0",
      terminalSafeStates: ["NO_STRANDED_ALLOWANCE"],
      onKnownFailure: "COMPENSATE",
      onUnknownOutcome: "RECONCILE",
      onIndeterminateOutcome: "ESCALATE",
    },
    authorityPolicy: {
      autoApproveForward: true,
      autoApproveRecovery: true,
      maximumValueWei: "0",
      allowedTargets: [config.tokenAddress, config.vaultAddress],
      allowedFunctions: ["approve", "deposit"],
    },
  };
  return createMissionSchema.parse({
    name: `Save ${intent.displayAmount} ${config.tokenSymbol}`,
    description: `Fixed Sepolia deposit for ${short(intent.beneficiary)}. Operation ${intent.operationKey}.`,
    definition,
  });
}

export function idempotencyKey(prefix: "mission" | "run", value: unknown) {
  const hash = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return `savings-${prefix}-${hash}`;
}

function short(address: Address) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export class SavingsInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavingsInputError";
  }
}
