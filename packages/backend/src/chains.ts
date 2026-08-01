import { activeLiveChain, assertLiveExecutionChain } from "@aether/shared";

export function validateRuntimeChainEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const raw = environment.AETHER_CHAIN_ID;
  if (!raw) throw new Error("AETHER_CHAIN_ID is required.");
  const chainId = Number(raw);
  if (!Number.isSafeInteger(chainId)) {
    throw new Error("AETHER_CHAIN_ID must be an integer.");
  }
  assertLiveExecutionChain(chainId);
  if (environment.AETHER_MAINNET_DISABLED !== "true") {
    throw new Error("AETHER_MAINNET_DISABLED must be true.");
  }
  if (!environment[activeLiveChain.rpcEnvironmentVariable]) {
    throw new Error(
      `${activeLiveChain.rpcEnvironmentVariable} is required for ${activeLiveChain.displayName}.`,
    );
  }
}
