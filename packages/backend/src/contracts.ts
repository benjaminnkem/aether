import { z } from "zod";
import {
  actionSchema,
  addressSchema,
  hashSchema,
  investigationResultSchema,
  workspaceRoleSchema,
  type MissionAction,
} from "@aether/shared";

export const tenantContextSchema = z
  .object({
    actorId: z.string().min(1),
    workspaceId: z.string().min(1),
    role: workspaceRoleSchema,
  })
  .strict();
export type TenantContext = z.infer<typeof tenantContextSchema>;

export const providerHealthSchema = z
  .object({
    provider: z.enum([
      "evm-rpc-primary",
      "evm-rpc-secondary",
      "keeperhub",
      "groq",
    ]),
    status: z.enum(["healthy", "degraded", "unavailable", "not_configured"]),
    checkedAt: z.string().datetime(),
    latencyMs: z.number().int().nonnegative().optional(),
    consecutiveFailures: z.number().int().nonnegative(),
    rateLimitedUntil: z.string().datetime().optional(),
    detail: z.string().max(240).optional(),
  })
  .strict();
export type ProviderHealth = z.infer<typeof providerHealthSchema>;

export const keeperHubRequestSchema = actionSchema.transform((action) => ({
  contractAddress: action.contractAddress,
  chainId: action.chainId,
  functionName: action.functionName,
  functionArgs: JSON.stringify(action.functionArgs),
  abi: JSON.stringify(action.abi),
  value: formatEtherValue(action.valueWei),
}));
export type KeeperHubRequest = z.infer<typeof keeperHubRequestSchema>;

export const simulationResultSchema = z
  .object({
    success: z.boolean(),
    status: z.literal("simulated"),
    from: addressSchema,
    to: addressSchema,
    value: z.string(),
    gasEstimate: z.string().regex(/^\d+$/).optional(),
    simulatedReturnValue: z.string().max(10_000).nullable().optional(),
    wouldRevert: z.boolean(),
    revertReason: z.string().max(1000).optional(),
    error: z.string().max(1000).optional(),
  })
  .strict();
export const keeperSubmissionSchema = z
  .object({
    executionId: z.string().min(1),
    status: z.enum(["pending", "running", "completed", "failed"]),
    requestId: z.string().optional(),
  })
  .strict();
export const keeperStatusSchema = z
  .object({
    executionId: z.string().min(1),
    status: z.enum(["pending", "running", "completed", "failed"]),
    transactionHash: hashSchema.nullish(),
    transactionLink: z.string().url().nullish(),
    gasUsedWei: z.string().regex(/^\d+$/).nullish(),
    error: z.unknown().nullish(),
    completedAt: z.string().datetime().nullish(),
  })
  .strict();

export const rpcReceiptSchema = z
  .object({
    transactionHash: hashSchema,
    blockNumber: z.string().regex(/^\d+$/),
    blockHash: hashSchema,
    success: z.boolean(),
    confirmations: z.number().int().nonnegative(),
    canonical: z.boolean(),
    logs: z.array(
      z
        .object({
          address: addressSchema,
          topics: z.array(hashSchema),
          data: z.string(),
          logIndex: z.number().int().nonnegative(),
          removed: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
export type RpcReceipt = z.infer<typeof rpcReceiptSchema>;

export interface KeeperHubClient {
  health(): ProviderHealth;
  simulate(
    workspaceId: string,
    action: MissionAction,
  ): Promise<z.infer<typeof simulationResultSchema>>;
  submit(
    workspaceId: string,
    key: string,
    action: MissionAction,
  ): Promise<z.infer<typeof keeperSubmissionSchema>>;
  status(
    workspaceId: string,
    executionId: string,
  ): Promise<{
    result: z.infer<typeof keeperStatusSchema>;
    pollAfterMs: number;
  }>;
}
export interface ChainObserver {
  health(): ProviderHealth;
  chainId(): Promise<number>;
  blockNumber(): Promise<bigint>;
  receipt(
    transactionHash: string,
    minimumConfirmations: number,
  ): Promise<RpcReceipt | undefined>;
  call(
    action: Pick<
      MissionAction,
      "contractAddress" | "functionName" | "functionArgs" | "abi"
    >,
    blockTag?: string,
  ): Promise<unknown>;
  logs(input: {
    address: string;
    fromBlock: bigint;
    toBlock: bigint;
    topics?: string[];
  }): Promise<unknown[]>;
}
export interface IncidentSummarizer {
  health(): ProviderHealth;
  summarize(input: {
    objective: string;
    evidence: Array<{ id: string; fact: string }>;
  }): Promise<z.infer<typeof investigationResultSchema>>;
}

export function formatEtherValue(wei: string): string {
  const value = BigInt(wei);
  const whole = value / 1_000_000_000_000_000_000n;
  const fraction = (value % 1_000_000_000_000_000_000n)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
