import { AetherApiError, AetherClient } from "@aether/sdk";
import { configuration } from "./config";

export function aetherClient() {
  const config = configuration();
  return new AetherClient({
    baseUrl: config.aetherApiUrl,
    apiKey: config.aetherApiKey,
  });
}

export async function aetherStream(
  runId: string,
  after: number,
  signal: AbortSignal,
) {
  const config = configuration();
  return fetch(
    `${config.aetherApiUrl}/runs/${encodeURIComponent(runId)}/stream?after=${after}`,
    {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${config.aetherApiKey}`,
      },
      cache: "no-store",
      signal,
    },
  );
}

export function safeAetherError(error: unknown) {
  if (error instanceof AetherApiError) {
    return {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
        correlationId: error.correlationId,
      },
    };
  }
  return {
    status: 500,
    body: {
      code: "SAVINGS_APP_ERROR",
      message: "The savings request could not be completed.",
    },
  };
}
