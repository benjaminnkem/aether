import {
  apiErrorSchema,
  createMissionSchema,
  createRunSchema,
} from "@aether/shared";

export class AetherApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly correlationId: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AetherApiError";
  }
}

export class AetherClient {
  private refreshPromise?: Promise<void>;

  constructor(private readonly baseUrl = "/v1") {}

  session() {
    return this.request<Record<string, unknown>>("/auth/session", {
      allowUnauthenticated: true,
    });
  }
  signup(email: string, password: string) {
    return this.request("/auth/signup", {
      method: "POST",
      body: { email, password },
      refresh: false,
    });
  }
  login(email: string, password: string) {
    return this.request("/auth/login", {
      method: "POST",
      body: { email, password },
      refresh: false,
    });
  }
  logout() {
    return this.request("/auth/logout", { method: "POST", body: {} });
  }
  onboard(workspaceName: string) {
    return this.request("/auth/onboarding", {
      method: "POST",
      body: { workspaceName },
    });
  }
  forgotPassword(email: string) {
    return this.request("/auth/forgot-password", {
      method: "POST",
      body: { email },
      refresh: false,
    });
  }
  resetPassword(token: string, password: string) {
    return this.request("/auth/reset-password", {
      method: "POST",
      body: { token, password },
      refresh: false,
    });
  }

  listMissions() {
    return this.request<{ items: Array<Record<string, unknown>> }>("/missions");
  }
  mission(id: string) {
    return this.request<Record<string, unknown>>(
      `/missions/${encodeURIComponent(id)}`,
    );
  }
  createMission(input: unknown, idempotencyKey = crypto.randomUUID()) {
    return this.request("/missions", {
      method: "POST",
      body: createMissionSchema.parse(input),
      idempotencyKey,
    });
  }
  createMissionVersion(
    id: string,
    definition: unknown,
    idempotencyKey = crypto.randomUUID(),
  ) {
    return this.request(`/missions/${encodeURIComponent(id)}/versions`, {
      method: "POST",
      body: definition,
      idempotencyKey,
    });
  }
  archiveMission(id: string, idempotencyKey = crypto.randomUUID()) {
    return this.request(`/missions/${encodeURIComponent(id)}/archive`, {
      method: "POST",
      body: {},
      idempotencyKey,
    });
  }
  createRun(
    missionId: string,
    input: unknown,
    idempotencyKey = crypto.randomUUID(),
  ) {
    return this.request<Record<string, unknown>>(
      `/missions/${encodeURIComponent(missionId)}/runs`,
      { method: "POST", body: createRunSchema.parse(input), idempotencyKey },
    );
  }
  run(id: string) {
    return this.request<Record<string, unknown>>(
      `/runs/${encodeURIComponent(id)}`,
    );
  }
  demoRun(id: string, viewToken: string) {
    return this.request<Record<string, unknown>>(
      `/demo/runs/${encodeURIComponent(id)}`,
      {
        allowUnauthenticated: true,
        headers: { "X-Demo-Run-Token": viewToken },
      },
    );
  }
  timeline(id: string, after = 0) {
    return this.request<Array<Record<string, unknown>>>(
      `/runs/${encodeURIComponent(id)}/timeline?after=${after}`,
    );
  }
  receipt(id: string) {
    return this.request<Record<string, unknown>>(
      `/runs/${encodeURIComponent(id)}/receipt`,
    );
  }
  controlRun(
    id: string,
    action: "pause" | "resume" | "cancel",
    idempotencyKey = crypto.randomUUID(),
  ) {
    return this.request(`/runs/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      body: {},
      idempotencyKey,
    });
  }
  approvals() {
    return this.request<{ items: Array<Record<string, unknown>> }>(
      "/approvals",
    );
  }
  approval(id: string) {
    return this.request<Record<string, unknown>>(
      `/approvals/${encodeURIComponent(id)}`,
    );
  }
  decideApproval(
    id: string,
    decision: "approve" | "deny",
    reason: string,
    idempotencyKey = crypto.randomUUID(),
  ) {
    return this.request(`/approvals/${encodeURIComponent(id)}/${decision}`, {
      method: "POST",
      body: { reason },
      idempotencyKey,
    });
  }
  audit() {
    return this.request<{ items: Array<Record<string, unknown>> }>("/audit");
  }
  policy() {
    return this.request<Record<string, unknown>>("/policy");
  }
  updatePolicy(input: unknown, idempotencyKey = crypto.randomUUID()) {
    return this.request("/policy", {
      method: "PUT",
      body: input,
      idempotencyKey,
    });
  }
  apiKeys() {
    return this.request<{ items: Array<Record<string, unknown>> }>("/api-keys");
  }
  createApiKey(input: unknown, idempotencyKey = crypto.randomUUID()) {
    return this.request("/api-keys", {
      method: "POST",
      body: input,
      idempotencyKey,
    });
  }

  async streamRun(
    runId: string,
    after: number,
    listener: (event: Record<string, unknown>) => void,
    signal?: AbortSignal,
  ) {
    return this.stream(
      `/runs/${encodeURIComponent(runId)}/stream`,
      after,
      listener,
      signal,
    );
  }

  async streamDemoRun(
    runId: string,
    viewToken: string,
    after: number,
    listener: (event: Record<string, unknown>) => void,
    signal?: AbortSignal,
  ) {
    return this.stream(
      `/demo/runs/${encodeURIComponent(runId)}/stream`,
      after,
      listener,
      signal,
      { "X-Demo-Run-Token": viewToken },
    );
  }

  private async stream(
    path: string,
    after: number,
    listener: (event: Record<string, unknown>) => void,
    signal?: AbortSignal,
    headers?: Record<string, string>,
  ) {
    const response = await fetch(`${this.url(path)}?after=${after}`, {
      credentials: "include",
      headers: { Accept: "text/event-stream", ...headers },
      signal,
    });
    if (!response.ok || !response.body) throw await this.error(response);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const line = frame
          .split("\n")
          .find((item) => item.startsWith("data: "));
        if (line)
          listener(JSON.parse(line.slice(6)) as Record<string, unknown>);
      }
    }
  }

  private async request<T = Record<string, unknown>>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    if (options.idempotencyKey)
      headers.set("Idempotency-Key", options.idempotencyKey);
    for (const [name, value] of Object.entries(options.headers ?? {}))
      headers.set(name, value);
    if (options.method && !["GET", "HEAD"].includes(options.method)) {
      const csrf = readCookie("aether_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);
    }
    const response = await fetch(this.url(path), {
      method: options.method ?? "GET",
      credentials: "include",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (
      response.status === 401 &&
      options.refresh !== false &&
      !options.allowUnauthenticated
    ) {
      await this.refresh();
      return this.request<T>(path, { ...options, refresh: false });
    }
    if (response.status === 401 && options.allowUnauthenticated)
      return null as T;
    if (!response.ok) throw await this.error(response);
    return response.json() as Promise<T>;
  }

  private async refresh() {
    this.refreshPromise ??= fetch(this.url("/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": readCookie("aether_csrf") ?? "",
      },
      body: "{}",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Session expired.");
      })
      .finally(() => {
        this.refreshPromise = undefined;
      });
    return this.refreshPromise;
  }
  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, "")}${path}`;
  }
  private async error(response: Response) {
    const raw = await response.json().catch(() => undefined);
    const parsed = apiErrorSchema.safeParse(raw);
    return parsed.success
      ? new AetherApiError(
          response.status,
          parsed.data.code,
          parsed.data.message,
          parsed.data.correlationId,
          parsed.data.details,
        )
      : new AetherApiError(
          response.status,
          "INVALID_RESPONSE",
          "The server returned an invalid error response.",
          response.headers.get("x-request-id") ?? "unknown",
        );
  }
}

type RequestOptions = {
  method?: "POST" | "PUT" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  refresh?: boolean;
  allowUnauthenticated?: boolean;
  headers?: Record<string, string>;
};
function readCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
}
export function getAetherErrorMessage(error: unknown, fallback: string) {
  return error instanceof AetherApiError
    ? error.message
    : error instanceof Error && error.message.length <= 240
      ? error.message
      : fallback;
}
export const aetherClient = new AetherClient("/v1");
