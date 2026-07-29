import { type Intent } from "@/types/intent";

const ACTION_LABELS: Record<Intent["action"], string> = {
  transfer: "Transfer",
  rebalance: "Rebalance",
  claim_and_compound: "Claim & Compound",
  custom: "Custom Action",
};

function formatAmount(amount: Intent["amount"], token: string): string {
  if (amount.type === "percentage") {
    if (amount.value === 100) return `all of your ${token}`;
    return `${amount.value}% of your ${token}`;
  }
  return `${amount.value} ${token}`;
}

function formatProtocol(protocol: string): string {
  const names: Record<string, string> = {
    aave: "Aave",
    morpho: "Morpho",
    spark: "Spark",
  };
  return names[protocol] ?? protocol;
}

export function formatIntentResponse(intent: Intent): string {
  const lines: string[] = [];

  lines.push("Got it. Here's what I understood:\n");
  lines.push(`• **Action:** ${ACTION_LABELS[intent.action]}`);

  const amountStr = formatAmount(intent.amount, intent.token);

  switch (intent.action) {
    case "transfer":
      lines.push(`• **Send:** ${amountStr}`);
      if (intent.recipient) {
        lines.push(`• **To:** \`${intent.recipient}\``);
      }
      break;

    case "rebalance":
      lines.push(`• **Move:** ${amountStr}`);
      if (intent.fromProtocol && intent.toProtocol) {
        lines.push(
          `• **Route:** ${formatProtocol(intent.fromProtocol)} → ${formatProtocol(intent.toProtocol)}`
        );
      } else if (intent.fromProtocol) {
        lines.push(`• **From:** ${formatProtocol(intent.fromProtocol)}`);
      } else if (intent.toProtocol) {
        lines.push(`• **To:** ${formatProtocol(intent.toProtocol)}`);
      }
      break;

    case "claim_and_compound":
      lines.push(`• **Claim & restake:** ${amountStr}`);
      if (intent.fromProtocol) {
        lines.push(`• **Protocol:** ${formatProtocol(intent.fromProtocol)}`);
      }
      break;

    case "custom":
      lines.push(`• **Token:** ${intent.token}`);
      lines.push(`• **Amount:** ${amountStr}`);
      break;
  }

  if (intent.conditions) {
    const { minApyDifference, minHealthFactor, minRemainingBalance } =
      intent.conditions;

    if (minApyDifference !== undefined) {
      lines.push(
        minApyDifference === 0
          ? `• **Condition:** Only if destination APY is higher`
          : `• **Condition:** Only if APY difference ≥ ${minApyDifference}%`
      );
    }

    if (minHealthFactor !== undefined) {
      lines.push(
        `• **Condition:** Keep health factor above ${minHealthFactor}`
      );
    }

    if (minRemainingBalance !== undefined) {
      lines.push(
        `• **Condition:** Keep at least ${minRemainingBalance} ${intent.token} in source`
      );
    }
  }

  lines.push(
    intent.requireConfirmation
      ? "\n⏳ I'll ask for your confirmation before executing."
      : "\n⚡ This will execute immediately without confirmation."
  );

  return lines.join("\n");
}

export function formatSimulationSummary(intent: Intent, gas: string): string {
  const base = formatIntentResponse(intent);
  const cleanBase = base.split("\n⏳")[0].split("\n⚡")[0];
  return `${cleanBase}\n• **Estimated Gas:** \`${gas}\`\n\nDo you want me to execute this? (Reply **yes** to confirm, **no** to cancel)`;
}
