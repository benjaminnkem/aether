import { type Intent } from "@/types/intent";
import { type Workflow, type WorkflowNode, type WorkflowEdge } from "./types";

const TOKEN_ADDRESSES: Record<string, string> = {
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27ead9083C756Cc2",
  ETH: "0xC02aaA39b223FE8D0A0e5C4F27ead9083C756Cc2",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
};

function getTokenAddress(token: string): string {
  return TOKEN_ADDRESSES[token.toUpperCase()] || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
}

function formatAmountToRaw(amountValue: number, token: string): string {
  const decimals = token.toUpperCase() === "USDC" || token.toUpperCase() === "USDT" ? 6 : 18;
  return Math.floor(amountValue * Math.pow(10, decimals)).toString();
}

function getWithdrawActionType(protocol: string | null | undefined): string {
  if (protocol === "aave") return "aave-v3/withdraw";
  if (protocol === "morpho") return "morpho/withdraw";
  if (protocol === "spark") return "spark/withdraw";
  return "aave-v3/withdraw";
}

function getDepositActionType(protocol: string | null | undefined): string {
  if (protocol === "aave") return "aave-v3/supply";
  if (protocol === "morpho") return "morpho/supply";
  if (protocol === "spark") return "spark/supply";
  return "aave-v3/supply";
}

export function mapIntentToWorkflow(intent: Intent): Omit<Workflow, "id"> {
  const nodes: WorkflowNode[] = [
    {
      id: "trigger",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: {
        type: "trigger",
        label: "Start",
        config: {},
      },
    },
  ];

  const edges: WorkflowEdge[] = [];

  switch (intent.action) {
    case "transfer": {
      const isEth = intent.token.toUpperCase() === "ETH";
      const transferNode: WorkflowNode = {
        id: "action-transfer",
        type: "action",
        position: { x: 250, y: 0 },
        data: {
          type: "action",
          label: `Transfer ${intent.token}`,
          config: isEth
            ? {
                actionType: "web3/transfer-funds",
                network: "1",
                amount: intent.amount.value.toString(),
                recipientAddress: intent.recipient || "",
              }
            : {
                actionType: "web3/transfer-token",
                network: "1",
                tokenConfig: JSON.stringify({
                  mode: "custom",
                  customToken: {
                    address: getTokenAddress(intent.token),
                    symbol: intent.token.toUpperCase(),
                  },
                }),
                amount: intent.amount.value.toString(),
                recipientAddress: intent.recipient || "",
              },
        },
      };

      nodes.push(transferNode);
      edges.push({
        id: "trigger-to-transfer",
        source: "trigger",
        target: "action-transfer",
      });
      break;
    }

    case "rebalance": {
      let currentSourceId = "trigger";
      let xOffset = 250;

      if (intent.conditions?.minApyDifference !== undefined) {
        const compareNode: WorkflowNode = {
          id: "check-apy",
          type: "action",
          position: { x: xOffset, y: 0 },
          data: {
            type: "action",
            label: "Verify APY Gap",
            config: {
              actionType: "Condition",
              condition: `{{apyDifference}} >= ${intent.conditions.minApyDifference}`,
            },
          },
        };

        nodes.push(compareNode);
        edges.push({
          id: "trigger-to-check",
          source: "trigger",
          target: "check-apy",
        });
        currentSourceId = "check-apy";
        xOffset += 250;
      }

      const balanceNode: WorkflowNode = {
        id: "get-reserve",
        type: "action",
        position: { x: xOffset, y: 0 },
        data: {
          type: "action",
          label: "Get Aave USDC Balance",
          config: {
            actionType: "aave-v3/get-user-reserve-data",
            network: "1",
            asset: getTokenAddress(intent.token),
            user: "0xba559bf4c7d64dff9cc48da6e2f4391f9cc48da6",
          },
        },
      };

      xOffset += 250;

      const withdrawAmount =
        intent.amount.type === "percentage"
          ? `{{@get-reserve.currentATokenBalance * ${intent.amount.value / 100}}}`
          : formatAmountToRaw(intent.amount.value, intent.token);

      const withdrawNode: WorkflowNode = {
        id: "action-withdraw",
        type: "action",
        position: { x: xOffset, y: 0 },
        data: {
          type: "action",
          label: `Withdraw ${intent.token} from ${intent.fromProtocol}`,
          config: {
            actionType: getWithdrawActionType(intent.fromProtocol),
            network: "1",
            asset: getTokenAddress(intent.token),
            amount: withdrawAmount,
            to: "0xba559bf4c7d64dff9cc48da6e2f4391f9cc48da6",
          },
        },
      };

      xOffset += 250;

      const isMorpho = intent.toProtocol === "morpho";
      const depositNode: WorkflowNode = {
        id: "action-deposit",
        type: "action",
        position: { x: xOffset, y: 0 },
        data: {
          type: "action",
          label: `Deposit ${intent.token} to ${intent.toProtocol}`,
          config: isMorpho
            ? {
                actionType: "morpho/supply",
                network: "1",
                loanToken: getTokenAddress(intent.token),
                collateralToken: getTokenAddress("WETH"),
                oracle: "0x48f5e5a2b9645891bdc7ff905c898b5836c1d19d",
                irm: "0xbb50253fa20757d9b227b10e6500000000000000",
                lltv: "945000000000000000",
                assets: `{{@get-reserve.currentATokenBalance * ${(intent.amount.value / 100).toFixed(2)}}}`,
                onBehalf: "0xba559bf4c7d64dff9cc48da6e2f4391f9cc48da6",
              }
            : {
                actionType: getDepositActionType(intent.toProtocol),
                network: "1",
                asset: getTokenAddress(intent.token),
                amount: `{{@get-reserve.currentATokenBalance * ${(intent.amount.value / 100).toFixed(2)}}}`,
                onBehalfOf: "0xba559bf4c7d64dff9cc48da6e2f4391f9cc48da6",
              },
        },
      };

      nodes.push(balanceNode, withdrawNode, depositNode);

      if (currentSourceId === "check-apy") {
        edges.push({
          id: "check-to-balance",
          source: "check-apy",
          target: "get-reserve",
          sourceHandle: "true",
        });
      } else {
        edges.push({
          id: "trigger-to-balance",
          source: "trigger",
          target: "get-reserve",
        });
      }

      edges.push(
        {
          id: "balance-to-withdraw",
          source: "get-reserve",
          target: "action-withdraw",
        },
        {
          id: "withdraw-to-deposit",
          source: "action-withdraw",
          target: "action-deposit",
        }
      );
      break;
    }

    case "claim_and_compound": {
      const withdrawNode: WorkflowNode = {
        id: "action-withdraw",
        type: "action",
        position: { x: 250, y: 0 },
        data: {
          type: "action",
          label: `Withdraw ${intent.token} from ${intent.fromProtocol}`,
          config: {
            actionType: getWithdrawActionType(intent.fromProtocol),
            network: "1",
            asset: getTokenAddress(intent.token),
            amount: formatAmountToRaw(intent.amount.value, intent.token),
            to: "0xba559bf4c7d64dff9cc48da6e2f4391f9cc48da6",
          },
        },
      };

      const depositNode: WorkflowNode = {
        id: "action-deposit",
        type: "action",
        position: { x: 500, y: 0 },
        data: {
          type: "action",
          label: `Deposit ${intent.token} to ${intent.toProtocol ?? intent.fromProtocol}`,
          config: {
            actionType: getDepositActionType(intent.toProtocol ?? intent.fromProtocol),
            network: "1",
            asset: getTokenAddress(intent.token),
            amount: formatAmountToRaw(intent.amount.value, intent.token),
            onBehalfOf: "0xba559bf4c7d64dff9cc48da6e2f4391f9cc48da6",
          },
        },
      };

      nodes.push(withdrawNode, depositNode);
      edges.push(
        {
          id: "trigger-to-withdraw",
          source: "trigger",
          target: "action-withdraw",
        },
        {
          id: "withdraw-to-deposit",
          source: "action-withdraw",
          target: "action-deposit",
        }
      );
      break;
    }

    default: {
      const customNode: WorkflowNode = {
        id: "action-custom",
        type: "action",
        position: { x: 250, y: 0 },
        data: {
          type: "action",
          label: "Execute Custom Strategy",
          config: {
            actionType: "custom/fallback",
            originalText: intent.originalText,
            token: intent.token,
            amount: intent.amount.value,
            amountType: intent.amount.type,
          },
        },
      };

      nodes.push(customNode);
      edges.push({
        id: "trigger-to-custom",
        source: "trigger",
        target: "action-custom",
      });
      break;
    }
  }

  const name = `${intent.action.toUpperCase()} - ${intent.token}`;
  const description = `Auto-generated workflow from user intent: "${intent.originalText}"`;

  return {
    name,
    description,
    nodes,
    edges,
  };
}
