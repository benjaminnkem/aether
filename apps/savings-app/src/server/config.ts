import { getAddress } from "viem";
import { z } from "zod";

const configurationSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SAVINGS_AETHER_API_URL: z.string().url(),
    SAVINGS_AETHER_API_KEY: z.string().startsWith("aeth_").min(40),
    SAVINGS_APP_ORIGIN: z.string().url(),
    SAVINGS_APP_ACCESS_TOKEN: z.string().min(16).max(256),
    SAVINGS_SESSION_SECRET: z.string().min(32),
    SAVINGS_LIVE_EXECUTION_ENABLED: z.enum(["true", "false"]).default("false"),
    SAVINGS_VAULT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    SAVINGS_TOKEN_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    SAVINGS_TOKEN_SYMBOL: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/),
    SAVINGS_TOKEN_DECIMALS: z.coerce.number().int().min(0).max(36),
    SAVINGS_MIN_AMOUNT: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .default("1"),
    SAVINGS_MAX_AMOUNT: z.string().regex(/^\d+(\.\d+)?$/),
    SAVINGS_KEEPERHUB_EXECUTOR_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    SAVINGS_EXPLORER_URL: z
      .string()
      .url()
      .default("https://sepolia.etherscan.io"),
  })
  .strict();

export type SavingsConfiguration = ReturnType<typeof configuration>;

let cached: ReturnType<typeof parseConfiguration> | undefined;

export function configuration() {
  cached ??= parseConfiguration();
  return cached;
}

function parseConfiguration() {
  const parsed = configurationSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    SAVINGS_AETHER_API_URL: process.env.SAVINGS_AETHER_API_URL,
    SAVINGS_AETHER_API_KEY: process.env.SAVINGS_AETHER_API_KEY,
    SAVINGS_APP_ORIGIN: process.env.SAVINGS_APP_ORIGIN,
    SAVINGS_APP_ACCESS_TOKEN: process.env.SAVINGS_APP_ACCESS_TOKEN,
    SAVINGS_SESSION_SECRET: process.env.SAVINGS_SESSION_SECRET,
    SAVINGS_LIVE_EXECUTION_ENABLED: process.env.SAVINGS_LIVE_EXECUTION_ENABLED,
    SAVINGS_VAULT_ADDRESS: process.env.SAVINGS_VAULT_ADDRESS,
    SAVINGS_TOKEN_ADDRESS: process.env.SAVINGS_TOKEN_ADDRESS,
    SAVINGS_TOKEN_SYMBOL: process.env.SAVINGS_TOKEN_SYMBOL,
    SAVINGS_TOKEN_DECIMALS: process.env.SAVINGS_TOKEN_DECIMALS,
    SAVINGS_MIN_AMOUNT: process.env.SAVINGS_MIN_AMOUNT,
    SAVINGS_MAX_AMOUNT: process.env.SAVINGS_MAX_AMOUNT,
    SAVINGS_KEEPERHUB_EXECUTOR_ADDRESS:
      process.env.SAVINGS_KEEPERHUB_EXECUTOR_ADDRESS,
    SAVINGS_EXPLORER_URL: process.env.SAVINGS_EXPLORER_URL,
  });
  return {
    environment: parsed.NODE_ENV,
    aetherApiUrl: parsed.SAVINGS_AETHER_API_URL.replace(/\/$/, ""),
    aetherApiKey: parsed.SAVINGS_AETHER_API_KEY,
    appOrigin: parsed.SAVINGS_APP_ORIGIN.replace(/\/$/, ""),
    accessToken: parsed.SAVINGS_APP_ACCESS_TOKEN,
    sessionSecret: parsed.SAVINGS_SESSION_SECRET,
    liveExecutionEnabled: parsed.SAVINGS_LIVE_EXECUTION_ENABLED === "true",
    vaultAddress: getAddress(parsed.SAVINGS_VAULT_ADDRESS),
    tokenAddress: getAddress(parsed.SAVINGS_TOKEN_ADDRESS),
    tokenSymbol: parsed.SAVINGS_TOKEN_SYMBOL,
    tokenDecimals: parsed.SAVINGS_TOKEN_DECIMALS,
    minimumAmount: parsed.SAVINGS_MIN_AMOUNT,
    maximumAmount: parsed.SAVINGS_MAX_AMOUNT,
    executorAddress: getAddress(parsed.SAVINGS_KEEPERHUB_EXECUTOR_ADDRESS),
    explorerUrl: parsed.SAVINGS_EXPLORER_URL.replace(/\/$/, ""),
  } as const;
}
