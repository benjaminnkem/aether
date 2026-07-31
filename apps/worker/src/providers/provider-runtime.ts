import {
  providerHealthSchema,
  redact,
  type ProviderHealth,
} from "@aether/backend";

export class ProviderHttpError extends Error {
  constructor(
    readonly provider: ProviderHealth["provider"],
    readonly status: number,
    readonly requestId?: string,
    readonly retryAfterMs?: number,
  ) {
    super(`${provider} request failed with HTTP ${status}.`);
    this.name = "ProviderHttpError";
  }
}

export interface ProviderRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  idempotent?: boolean;
  timeoutMs?: number;
  acceptedStatuses?: number[];
  onResponseHeaders?: (headers: Headers) => void;
}

interface ProviderRuntimeOptions {
  provider: ProviderHealth["provider"];
  timeoutMs?: number;
  maxAttempts?: number;
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
  observe?: (event: Record<string, unknown>) => void;
}

const retryableStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

export class ProviderRuntime {
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly fetcher: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly observe: (event: Record<string, unknown>) => void;
  private failures = 0;
  private health: ProviderHealth;

  constructor(private readonly options: ProviderRuntimeOptions) {
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.fetcher = options.fetcher ?? fetch;
    this.sleep =
      options.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = options.now ?? (() => new Date());
    this.observe = options.observe ?? (() => undefined);
    this.health = providerHealthSchema.parse({
      provider: options.provider,
      status: "unavailable",
      checkedAt: this.now().toISOString(),
      consecutiveFailures: 0,
      detail: "Provider health has not been verified.",
    });
  }

  getHealth(): ProviderHealth {
    return providerHealthSchema.parse(this.health);
  }

  async json(url: string, options: ProviderRequestOptions = {}) {
    const method = options.method ?? "GET";
    const retryAllowed =
      options.idempotent === true || method === "GET" || method === "HEAD";
    const attempts = retryAllowed ? this.maxAttempts : 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const started = performance.now();
      try {
        const response = await this.fetcher(url, {
          method,
          headers: options.headers,
          body: options.body,
          signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
        });
        const requestId =
          response.headers?.get("x-request-id") ??
          response.headers?.get("x-github-request-id") ??
          undefined;
        options.onResponseHeaders?.(response.headers);
        if (
          !response.ok &&
          !options.acceptedStatuses?.includes(response.status)
        ) {
          const retryAfterMs = parseRetryAfter(response.headers);
          const error = new ProviderHttpError(
            this.options.provider,
            response.status,
            requestId,
            retryAfterMs,
          );
          if (
            retryAllowed &&
            attempt < attempts &&
            retryableStatuses.has(response.status)
          ) {
            this.recordFailure(
              error,
              performance.now() - started,
              retryAfterMs,
            );
            await this.sleep(
              retryAfterMs ?? boundedBackoffWithJitter(attempt, requestId),
            );
            continue;
          }
          throw error;
        }
        const value: unknown = await response.json();
        this.recordSuccess(performance.now() - started);
        this.observe({
          provider: this.options.provider,
          method,
          endpoint: safeEndpoint(url),
          attempt,
          status: response.status,
          requestId,
        });
        return value;
      } catch (error) {
        lastError = error;
        const retryableNetworkFailure =
          !(error instanceof ProviderHttpError) &&
          retryAllowed &&
          attempt < attempts;
        this.recordFailure(error, performance.now() - started);
        if (retryableNetworkFailure) {
          await this.sleep(boundedBackoffWithJitter(attempt));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  private recordSuccess(latencyMs: number) {
    this.failures = 0;
    this.health = providerHealthSchema.parse({
      provider: this.options.provider,
      status: "healthy",
      checkedAt: this.now().toISOString(),
      latencyMs: Math.round(latencyMs),
      consecutiveFailures: 0,
    });
  }

  private recordFailure(
    error: unknown,
    latencyMs: number,
    retryAfterMs?: number,
  ) {
    this.failures += 1;
    const checkedAt = this.now();
    const status =
      this.failures >= this.maxAttempts ? "unavailable" : "degraded";
    this.health = providerHealthSchema.parse({
      provider: this.options.provider,
      status,
      checkedAt: checkedAt.toISOString(),
      latencyMs: Math.round(latencyMs),
      consecutiveFailures: this.failures,
      rateLimitedUntil: retryAfterMs
        ? new Date(checkedAt.getTime() + retryAfterMs).toISOString()
        : undefined,
      detail:
        error instanceof Error ? error.message : "Provider request failed.",
    });
    this.observe(
      redact({
        provider: this.options.provider,
        status,
        error,
      }) as Record<string, unknown>,
    );
  }
}

function parseRetryAfter(headers: Headers | undefined): number | undefined {
  const raw = headers?.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds))
    return Math.min(30_000, Math.max(0, seconds * 1_000));
  const date = Date.parse(raw);
  if (Number.isNaN(date)) return undefined;
  return Math.min(30_000, Math.max(0, date - Date.now()));
}

function boundedBackoffWithJitter(attempt: number, seed = ""): number {
  const deterministicJitter = [...seed].reduce(
    (total, character) => (total + character.charCodeAt(0)) % 101,
    0,
  );
  return Math.min(5_000, 250 * 2 ** (attempt - 1) + deterministicJitter);
}

function safeEndpoint(rawUrl: string): string {
  const url = new URL(rawUrl);
  return `${url.origin}${url.pathname}`;
}
