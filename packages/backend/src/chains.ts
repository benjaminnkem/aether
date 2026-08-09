import { assertLiveExecutionChain } from "@aether/shared";

export function validateRuntimeChainEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const allowed = (environment.AETHER_ALLOWED_CHAIN_IDS ?? "11155111")
    .split(",")
    .map((value) => Number(value.trim()));
  if (allowed.length !== 1 || !Number.isSafeInteger(allowed[0])) {
    throw new Error(
      "AETHER_ALLOWED_CHAIN_IDS must contain only Ethereum Sepolia (11155111).",
    );
  }
  assertLiveExecutionChain(allowed[0]!);
  if (
    !environment.SEPOLIA_RPC_PRIMARY_URL ||
    !environment.SEPOLIA_RPC_SECONDARY_URL
  ) {
    throw new Error(
      "SEPOLIA_RPC_PRIMARY_URL and SEPOLIA_RPC_SECONDARY_URL are required.",
    );
  }
}

export function validateRuntimeTimeoutEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  validateDuration(environment, "RPC_TIMEOUT_MS", 10_000, 1_000, 120_000);
  validateDuration(
    environment,
    "KEEPERHUB_REQUEST_TIMEOUT_MS",
    15_000,
    1_000,
    300_000,
  );
  validateDuration(environment, "GROQ_TIMEOUT_MS", 15_000, 1_000, 120_000);
}

function validateDuration(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const value = Number(environment[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum} milliseconds.`,
    );
}
