import { z } from "zod/v4";

export const ProtocolSchema = z.enum(["aave", "morpho", "spark"]);
export type Protocol = z.infer<typeof ProtocolSchema>;

export const ActionSchema = z.enum([
  "transfer",
  "rebalance",
  "claim_and_compound",
  "custom",
]);
export type Action = z.infer<typeof ActionSchema>;

export const AmountSchema = z.object({
  type: z.enum(["percentage", "exact"]).describe(
    "Whether the amount is an exact token quantity or a percentage of the user's balance."
  ),
  value: z.number().min(0).describe(
    "The numeric value. For 'percentage', use 0–100 (e.g. 40 means 40%). For 'exact', use the raw token amount."
  ),
});
export type Amount = z.infer<typeof AmountSchema>;

export const ConditionsSchema = z.object({
  minApyDifference: z
    .number()
    .optional()
    .describe(
      "Minimum APY difference (in percentage points) that must exist between source and destination protocol to justify the rebalance."
    ),
  minHealthFactor: z
    .number()
    .optional()
    .describe(
      "Minimum health factor that must remain after the action. Typically 1.0–2.0."
    ),
  minRemainingBalance: z
    .number()
    .optional()
    .describe(
      "Minimum token balance that must remain in the source after execution."
    ),
});
export type Conditions = z.infer<typeof ConditionsSchema>;

export const IntentSchema = z.object({
  action: ActionSchema.describe("The type of onchain action to perform."),

  fromProtocol: ProtocolSchema.nullable()
    .optional()
    .describe(
      "The source DeFi protocol to withdraw / move funds from. Null if not applicable."
    ),

  toProtocol: ProtocolSchema.nullable()
    .optional()
    .describe(
      "The destination DeFi protocol to deposit / move funds into. Null if not applicable."
    ),

  token: z
    .string()
    .describe(
      "The token symbol involved (e.g. 'USDC', 'ETH', 'WETH', 'DAI')."
    ),

  amount: AmountSchema.describe("How much to move / send."),

  conditions: ConditionsSchema.optional().describe(
    "Optional guard-rail conditions that must be satisfied before executing."
  ),

  recipient: z
    .string()
    .optional()
    .describe(
      "The recipient address or ENS name. Only used for 'transfer' actions."
    ),

  requireConfirmation: z
    .boolean()
    .describe(
      "Whether the user explicitly asked for confirmation before executing. Default to true for safety."
    ),

  originalText: z
    .string()
    .describe("The original, unmodified natural language message from the user."),
});

export type Intent = z.infer<typeof IntentSchema>;
