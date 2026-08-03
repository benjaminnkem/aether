import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import {
  authSessionSchema,
  dashboardSchema,
  desiredStateSchema,
  githubDesiredStateSourceSchema,
  type Dashboard,
  type DesiredState,
  type AuthSession,
  type GitHubDesiredStateSource,
} from "@aether/shared";

declare const process: {
  env: Record<string, string | undefined>;
};

export function getAetherErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!axios.isAxiosError(error)) return fallback;
  const data = error.response?.data as
    | { message?: unknown; error?: unknown }
    | undefined;
  const message =
    typeof data?.message === "string"
      ? data.message
      : typeof data?.error === "string"
        ? data.error
        : undefined;
  return message && message.length <= 240 ? message : fallback;
}

export class AetherClient {
  private readonly http: AxiosInstance;
  private readonly baseURL: string;
  private refreshPromise: Promise<void> | null = null;

  constructor(baseURL = "/v1") {
    this.baseURL = baseURL.replace(/\/$/, "");
    this.http = axios.create({
      baseURL: this.baseURL,
      withCredentials: true,
      headers: { "X-Aether-Client": "web" },
      timeout: 10_000,
    });
    this.http.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => this.retryAfterRefresh(error),
    );
  }

  private async retryAfterRefresh(error: AxiosError) {
    const request = error.config as RetryableRequest | undefined;
    const path = request?.url ?? "";
    const excluded = [
      "/auth/login",
      "/auth/signup",
      "/auth/refresh",
      "/auth/logout",
      "/auth/forgot-password",
      "/auth/reset-password",
    ].some((item) => path.includes(item));
    if (
      error.response?.status !== 401 ||
      !request ||
      request.aetherRetried ||
      excluded
    ) {
      return Promise.reject(error);
    }
    request.aetherRetried = true;
    this.refreshPromise ??= this.http
      .post("/auth/refresh", {}, { headers: csrfHeaders() })
      .then(() => undefined)
      .finally(() => {
        this.refreshPromise = null;
      });
    await this.refreshPromise;
    return this.http.request(request);
  }

  async getSession(): Promise<AuthSession | null> {
    try {
      const response = await this.http.get("/auth/session");
      return authSessionSchema.parse(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return null;
      throw error;
    }
  }

  async signup(email: string, password: string) {
    const response = await this.http.post("/auth/signup", { email, password });
    return response.data as {
      authenticated: true;
      userId: string;
      email: string;
      accessToken: string;
      accessTokenExpiresInSeconds: number;
      context: Record<string, unknown>;
    };
  }

  async login(email: string, password: string) {
    const response = await this.http.post("/auth/login", { email, password });
    return response.data as { authenticated: true; userId: string };
  }

  async forgotPassword(email: string) {
    const response = await this.http.post("/auth/forgot-password", { email });
    return response.data as { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const response = await this.http.post("/auth/reset-password", {
      token,
      password,
    });
    return response.data as { ok: true };
  }

  async logout() {
    const response = await this.http.post(
      "/auth/logout",
      {},
      { headers: csrfHeaders() },
    );
    return response.data as { ok: true };
  }

  async onboard(input: {
    organizationName: string;
    protocolName: string;
    governanceAuthority: string;
  }) {
    const response = await this.http.post("/auth/onboarding", input);
    await this.http.post("/auth/refresh", {}, { headers: csrfHeaders() });
    return response.data as {
      organizationId: string;
      protocolId: string;
      role: "owner";
    };
  }

  async getDashboard(
    organizationId: string,
    protocolId: string,
  ): Promise<Dashboard> {
    const response = await this.http.get("/dashboard", {
      params: { organizationId, protocolId },
    });
    return dashboardSchema.parse(response.data);
  }

  subscribeEvents(
    afterSequence: number,
    listener: (event: RealtimeEvent) => void,
    onError?: () => void,
  ): () => void {
    if (typeof EventSource === "undefined") return () => undefined;
    const source = new EventSource(
      `${this.baseURL}/events?after=${Math.max(0, afterSequence)}`,
      { withCredentials: true },
    );
    const handleEvent = (raw: Event) => {
      if (!(raw instanceof MessageEvent) || typeof raw.data !== "string")
        return;
      try {
        listener(JSON.parse(raw.data) as RealtimeEvent);
      } catch {
        onError?.();
      }
    };
    source.onmessage = handleEvent;
    source.onerror = () => onError?.();
    return () => source.close();
  }

  async approveOperation(
    operationId: string,
    decision: "approve" | "reject",
  ): Promise<Dashboard> {
    const response = await this.http.post(
      `/operations/${encodeURIComponent(operationId)}/approval`,
      {
        decision,
      },
      { headers: csrfHeaders() },
    );
    return dashboardSchema.parse(response.data);
  }

  async validateDesiredState(input: DesiredState): Promise<DesiredState> {
    const parsed = desiredStateSchema.parse(input);
    const response = await this.http.post("/desired-state/validate", parsed, {
      headers: csrfHeaders(),
    });
    return desiredStateSchema.parse(response.data);
  }

  async saveDesiredState(input: DesiredState) {
    const parsed = desiredStateSchema.parse(input);
    const response = await this.http.post("/desired-state/versions", parsed, {
      headers: csrfHeaders(),
    });
    return response.data as {
      id: string;
      active: true;
      manifest: DesiredState;
    };
  }

  async runScan(idempotencyKey = crypto.randomUUID()): Promise<{
    id: string;
    status: string;
    idempotencyKey: string;
  }> {
    const response = await this.http.post(
      "/observations/scans",
      {},
      {
        headers: {
          ...csrfHeaders(),
          "Idempotency-Key": idempotencyKey,
        },
      },
    );
    return response.data as {
      id: string;
      status: string;
      idempotencyKey: string;
    };
  }

  async investigateFinding(
    findingId: string,
    idempotencyKey = crypto.randomUUID(),
  ) {
    const response = await this.http.post(
      `/drift/${encodeURIComponent(findingId)}/investigate`,
      {},
      {
        headers: {
          ...csrfHeaders(),
          "Idempotency-Key": idempotencyKey,
        },
      },
    );
    return response.data as {
      findingId: string;
      status: "queued";
      idempotencyKey: string;
    };
  }

  async generatePlan(findingId: string) {
    const response = await this.http.post(
      `/drift/${encodeURIComponent(findingId)}/plan`,
      {},
      { headers: csrfHeaders() },
    );
    return response.data;
  }

  async simulateOperation(operationId: string) {
    const response = await this.http.post(
      `/operations/${encodeURIComponent(operationId)}/simulation`,
      {},
      { headers: csrfHeaders() },
    );
    return response.data as {
      status: "queued";
      executionId: string;
      idempotencyKey: string;
    };
  }

  async executeOperation(operationId: string) {
    const response = await this.http.post(
      `/operations/${encodeURIComponent(operationId)}/execution`,
      {},
      { headers: csrfHeaders() },
    );
    return response.data as {
      id: string;
      operationId: string;
      status: string;
      idempotencyKey: string;
    };
  }

  async updateProtocolSetup(
    section: "general" | "networks" | "contracts" | "github" | "keeperhub",
    input: Record<string, unknown>,
  ): Promise<{ section: string; value: Record<string, unknown> }> {
    const response = await this.http.put(
      `/protocol-setup/${encodeURIComponent(section)}`,
      input,
      { headers: csrfHeaders() },
    );
    return response.data as {
      section: string;
      value: Record<string, unknown>;
    };
  }

  async getProtocolSetup() {
    const response = await this.http.get("/protocol-setup");
    return response.data as Record<string, unknown>;
  }

  async getGitHubInstallUrl() {
    const response = await this.http.get("/github/install-url");
    return response.data as { url: string };
  }

  async getGitHubRepositories() {
    const response = await this.http.get("/github/repositories");
    return response.data as Array<{
      full_name: string;
      default_branch: string;
      private: boolean;
      html_url: string;
    }>;
  }

  async getGitHubDesiredState(): Promise<GitHubDesiredStateSource> {
    const response = await this.http.get("/github/desired-state-source");
    return githubDesiredStateSourceSchema.parse(response.data);
  }

  async selectGitHubRepository(input: {
    repository: string;
    defaultBranch: string;
    desiredStatePath: string;
  }) {
    const response = await this.http.put("/github/repository", input, {
      headers: csrfHeaders(),
    });
    return response.data as typeof input & { connected: true };
  }

  async validateProvider(provider: "keeperhub" | "openai" | "evm-rpc") {
    const response = await this.http.post(
      `/protocol-setup/providers/${provider}/validate`,
      {},
      { headers: csrfHeaders() },
    );
    return response.data as {
      provider: string;
      status: "healthy";
      checkedAt: string;
      latencyMs: number;
    };
  }
}

function csrfHeaders(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const token = document.cookie
    .split("; ")
    .find((item) => item.startsWith("aether_csrf="))
    ?.slice("aether_csrf=".length);
  return token ? { "X-CSRF-Token": decodeURIComponent(token) } : {};
}

export const aetherClient = new AetherClient(
  process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1",
);
export const queryKeys = {
  session: ["session"] as const,
  dashboard: (organizationId: string, protocolId: string) =>
    ["dashboard", organizationId, protocolId] as const,
};

export function isAuthenticationError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

interface RetryableRequest extends InternalAxiosRequestConfig {
  aetherRetried?: boolean;
}
export interface RealtimeEvent {
  id: string;
  type: string;
  sequence: number;
  timestamp: string;
  organizationId: string;
  protocolId: string;
  resourceId: string;
}
export interface RealtimeAdapter {
  subscribe(listener: (event: RealtimeEvent) => void): () => void;
}
