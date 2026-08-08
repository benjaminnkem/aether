import { createMissionSchema, type MissionDefinition } from "@aether/shared";
import { getAddress, parseUnits, type Address } from "viem";
import { configuration } from "./config";

const approveAbi = [
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

const poolAbi = [
  {
    type: "function",
    name: "supply",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "referralCode", type: "uint16" },
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
const MAX_UINT256 =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

export class LendingConfigurationError extends Error {}

export type LendingScenario = "NORMAL" | "BLOCKED_BORROWING";

export function lendingMissionFor(
  requester: Address,
  displayAmount: string,
  displayBorrowAmount: string,
  requestId: string,
  scenario: LendingScenario = "NORMAL",
) {
  const c = configuration();
  if (
    !c.lendingPoolAddress ||
    !c.lendingCollateralTokenAddress ||
    !c.lendingBorrowTokenAddress ||
    !c.lendingATokenAddress ||
    !c.lendingVariableDebtTokenAddress ||
    c.lendingCollateralDecimals === undefined ||
    c.lendingBorrowDecimals === undefined ||
    !c.lendingMinimumCollateral ||
    !c.lendingMaximumCollateral ||
    !c.lendingBorrowAmount ||
    !c.lendingMinimumBorrow ||
    !c.lendingMaximumBorrow
  ) {
    throw new LendingConfigurationError(
      "The Sepolia lending integration is not fully configured.",
    );
  }
  const amount = parseUnits(displayAmount, c.lendingCollateralDecimals);
  const minimum = parseUnits(
    c.lendingMinimumCollateral,
    c.lendingCollateralDecimals,
  );
  const maximum = parseUnits(
    c.lendingMaximumCollateral,
    c.lendingCollateralDecimals,
  );
  if (amount < minimum || amount > maximum)
    throw new LendingConfigurationError(
      `Collateral must be between ${c.lendingMinimumCollateral} and ${c.lendingMaximumCollateral} ${c.lendingCollateralSymbol}.`,
    );
  const borrowAmount = parseUnits(displayBorrowAmount, c.lendingBorrowDecimals);
  const minimumBorrow = parseUnits(
    c.lendingMinimumBorrow,
    c.lendingBorrowDecimals,
  );
  const maximumBorrow = parseUnits(
    c.lendingMaximumBorrow,
    c.lendingBorrowDecimals,
  );
  if (borrowAmount < minimumBorrow || borrowAmount > maximumBorrow)
    throw new LendingConfigurationError(
      `Borrow amount must be between ${c.lendingMinimumBorrow} and ${c.lendingMaximumBorrow} ${c.lendingBorrowSymbol}.`,
    );
  const borrowAmountString = borrowAmount.toString();
  const executor = getAddress(c.executorAddress);
  const sameAsset =
    c.lendingCollateralTokenAddress.toLowerCase() ===
    c.lendingBorrowTokenAddress.toLowerCase();
  const zeroCollateralAllowance = {
    kind: "ERC20_ALLOWANCE" as const,
    token: c.lendingCollateralTokenAddress,
    owner: executor,
    spender: c.lendingPoolAddress,
    operator: "EQ" as const,
    amount: "0",
  };
  const zeroRepaymentAllowance = {
    kind: "ERC20_ALLOWANCE" as const,
    token: c.lendingBorrowTokenAddress,
    owner: executor,
    spender: c.lendingPoolAddress,
    operator: "EQ" as const,
    amount: "0",
  };
  const zeroCollateralPosition = {
    kind: "ERC20_BALANCE" as const,
    token: c.lendingATokenAddress,
    account: executor,
    operator: "EQ" as const,
    amount: "0",
  };
  const zeroBorrowDebt = {
    kind: "ERC20_BALANCE" as const,
    token: c.lendingVariableDebtTokenAddress,
    account: executor,
    operator: "EQ" as const,
    amount: "0",
  };
  const revokeCollateral = {
    chainId: 11155111 as const,
    contractAddress: c.lendingCollateralTokenAddress,
    functionName: "approve",
    functionArgs: [c.lendingPoolAddress, "0"],
    abi: [...approveAbi],
    valueWei: "0",
  };
  const revokeRepayment = {
    chainId: 11155111 as const,
    contractAddress: c.lendingBorrowTokenAddress,
    functionName: "approve",
    functionArgs: [c.lendingPoolAddress, "0"],
    abi: [...approveAbi],
    valueWei: "0",
  };
  const withdrawAllCollateral = {
    chainId: 11155111 as const,
    contractAddress: c.lendingPoolAddress,
    functionName: "withdraw",
    functionArgs: [c.lendingCollateralTokenAddress, MAX_UINT256, executor],
    abi: [...poolAbi],
    valueWei: "0",
  };
  const repayAllDebt = {
    chainId: 11155111 as const,
    contractAddress: c.lendingPoolAddress,
    functionName: "repay",
    functionArgs: [c.lendingBorrowTokenAddress, MAX_UINT256, "2", executor],
    abi: [...poolAbi],
    valueWei: "0",
  };
  const approvalCleanupSteps: MissionDefinition["steps"] = sameAsset
    ? [
        {
          id: "revoke-repayment-approval",
          name: "Revoke remaining pool approval",
          dependsOn: ["withdraw-collateral"],
          retryClass: "SEMANTICALLY_IDEMPOTENT",
          action: revokeRepayment,
          proof: zeroRepaymentAllowance,
        },
      ]
    : [
        {
          id: "revoke-collateral-approval",
          name: "Revoke collateral approval",
          dependsOn: ["withdraw-collateral"],
          retryClass: "SEMANTICALLY_IDEMPOTENT",
          action: revokeCollateral,
          proof: zeroCollateralAllowance,
        },
        {
          id: "revoke-repayment-approval",
          name: "Revoke repayment approval",
          dependsOn: ["revoke-collateral-approval"],
          retryClass: "SEMANTICALLY_IDEMPOTENT",
          action: revokeRepayment,
          proof: zeroRepaymentAllowance,
        },
      ];
  const steps: MissionDefinition["steps"] = [
    {
      id: "approve-collateral",
      name: "Approve collateral",
      dependsOn: [],
      retryClass: "SEMANTICALLY_IDEMPOTENT",
      action: {
        chainId: 11155111,
        contractAddress: c.lendingCollateralTokenAddress,
        functionName: "approve",
        functionArgs: [c.lendingPoolAddress, amount.toString()],
        abi: [...approveAbi],
        valueWei: "0",
      },
      proof: {
        kind: "ERC20_ALLOWANCE",
        token: c.lendingCollateralTokenAddress,
        owner: executor,
        spender: c.lendingPoolAddress,
        operator: "EQ",
        amount: amount.toString(),
      },
      compensation: {
        id: "revoke-collateral",
        action: revokeCollateral,
        proof: zeroCollateralAllowance,
      },
    },
    {
      id: "supply-collateral",
      name: "Supply collateral",
      dependsOn: ["approve-collateral"],
      retryClass: "PROVABLE_EFFECT",
      action: {
        chainId: 11155111,
        contractAddress: c.lendingPoolAddress,
        functionName: "supply",
        functionArgs: [
          c.lendingCollateralTokenAddress,
          amount.toString(),
          executor,
          "0",
        ],
        abi: [...poolAbi],
        valueWei: "0",
      },
      proof: {
        kind: "ERC20_BALANCE",
        token: c.lendingATokenAddress,
        account: executor,
        operator: "GTE",
        amount: amount.toString(),
      },
      compensation: {
        id: "withdraw-collateral",
        action: withdrawAllCollateral,
        proof: zeroCollateralPosition,
      },
    },
    {
      id: "authorize-repayment",
      name: "Authorize debt repayment",
      dependsOn: ["supply-collateral"],
      retryClass: "SEMANTICALLY_IDEMPOTENT",
      action: {
        chainId: 11155111,
        contractAddress: c.lendingBorrowTokenAddress,
        functionName: "approve",
        functionArgs: [c.lendingPoolAddress, MAX_UINT256],
        abi: [...approveAbi],
        valueWei: "0",
      },
      proof: {
        kind: "ERC20_ALLOWANCE",
        token: c.lendingBorrowTokenAddress,
        owner: executor,
        spender: c.lendingPoolAddress,
        operator: "EQ",
        amount: MAX_UINT256,
      },
      compensation: {
        id: "revoke-repayment",
        action: revokeRepayment,
        proof: zeroRepaymentAllowance,
      },
    },
    {
      id: "borrow-asset",
      name: "Borrow configured asset",
      dependsOn: ["authorize-repayment"],
      retryClass: "NON_REPLAYABLE",
      action: {
        chainId: 11155111,
        contractAddress: c.lendingPoolAddress,
        functionName: "borrow",
        functionArgs: [
          c.lendingBorrowTokenAddress,
          borrowAmountString,
          "2",
          "0",
          executor,
        ],
        abi: [...poolAbi],
        valueWei: "0",
      },
      proof: {
        kind: "ERC20_BALANCE",
        token: c.lendingVariableDebtTokenAddress,
        account: executor,
        operator: "GTE",
        amount: borrowAmountString,
      },
      compensation: {
        id: "repay-borrowed-asset",
        action: repayAllDebt,
        proof: zeroBorrowDebt,
      },
      ...(scenario === "BLOCKED_BORROWING"
        ? {
            executionGate: {
              kind: "BLOCKED" as const,
              reason:
                "Borrowing was blocked before simulation. No borrow transaction was broadcast.",
            },
          }
        : {}),
    },
    {
      id: "repay-asset",
      name: "Repay the full variable debt",
      dependsOn: ["borrow-asset"],
      retryClass: "PROVABLE_EFFECT",
      action: repayAllDebt,
      proof: zeroBorrowDebt,
    },
    {
      id: "withdraw-collateral",
      name: "Withdraw supplied collateral",
      dependsOn: ["repay-asset"],
      retryClass: "PROVABLE_EFFECT",
      action: withdrawAllCollateral,
      proof: zeroCollateralPosition,
    },
    ...approvalCleanupSteps,
  ];
  return createMissionSchema.parse({
    name:
      scenario === "BLOCKED_BORROWING"
        ? `Borrow ${displayBorrowAmount} ${c.lendingBorrowSymbol} against ${displayAmount} ${c.lendingCollateralSymbol}`
        : `Borrow ${displayBorrowAmount} ${c.lendingBorrowSymbol} against ${displayAmount} ${c.lendingCollateralSymbol}`,
    description: `Requested by ${getAddress(requester)}. Fixed Sepolia lending integration request ${requestId}.${
      scenario === "BLOCKED_BORROWING"
        ? " Borrowing is deterministically blocked before simulation so the previously verified effects must be recovered."
        : ""
    }`,
    definition: {
      schemaVersion: 1,
      objective: `Supply ${displayAmount} ${c.lendingCollateralSymbol}, borrow ${displayBorrowAmount} ${c.lendingBorrowSymbol}, repay the debt, withdraw the collateral, and revoke approvals.`,
      steps,
      invariants: [
        {
          id: "sepolia",
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
          id: "known-outcomes",
          kind: "NO_UNKNOWN_ATTEMPTS",
          severity: "CRITICAL",
          parameters: {},
        },
        {
          id: "no-collateral-position",
          kind: "ERC20_BALANCE",
          severity: "CRITICAL",
          parameters: {
            token: c.lendingATokenAddress,
            account: executor,
            operator: "EQ",
            amount: "0",
          },
        },
        {
          id: "no-variable-debt",
          kind: "ERC20_BALANCE",
          severity: "CRITICAL",
          parameters: {
            token: c.lendingVariableDebtTokenAddress,
            account: executor,
            operator: "EQ",
            amount: "0",
          },
        },
        ...(!sameAsset
          ? [
              {
                id: "no-collateral-allowance",
                kind: "ERC20_ALLOWANCE" as const,
                severity: "CRITICAL" as const,
                parameters: {
                  token: c.lendingCollateralTokenAddress,
                  owner: executor,
                  spender: c.lendingPoolAddress,
                  operator: "EQ",
                  amount: "0",
                },
              },
            ]
          : []),
        {
          id: "no-repayment-allowance",
          kind: "ERC20_ALLOWANCE",
          severity: "CRITICAL",
          parameters: {
            token: c.lendingBorrowTokenAddress,
            owner: executor,
            spender: c.lendingPoolAddress,
            operator: "EQ",
            amount: "0",
          },
        },
      ],
      recoveryPolicy: {
        maxRecoverySpendWei: "0",
        terminalSafeStates: [
          "NO_VARIABLE_DEBT",
          "NO_STRANDED_COLLATERAL",
          "NO_UNUSED_ALLOWANCE",
        ],
        onKnownFailure: "COMPENSATE",
        onUnknownOutcome: "RECONCILE",
        onIndeterminateOutcome: "ESCALATE",
      },
      authorityPolicy: {
        autoApproveForward: true,
        autoApproveRecovery: true,
        maximumValueWei: "0",
        allowedTargets: [
          c.lendingPoolAddress,
          c.lendingCollateralTokenAddress,
          c.lendingBorrowTokenAddress,
        ],
        allowedFunctions: ["approve", "supply", "borrow", "repay", "withdraw"],
      },
    },
  });
}
