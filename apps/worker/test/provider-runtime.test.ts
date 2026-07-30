import { describe, expect, it, vi } from "vitest";
import {
  ProviderHttpError,
  ProviderRuntime,
} from "../src/providers/provider-runtime";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("ProviderRuntime", () => {
  it("honors rate limits with bounded retry and updates health", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: "rate_limited" }, 429, {
          "retry-after": "1",
          "x-request-id": "keeper-request-1",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn(async () => undefined);
    const runtime = new ProviderRuntime({
      provider: "keeperhub",
      fetcher,
      sleep,
    });

    await expect(
      runtime.json("https://provider.invalid/status"),
    ).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
    expect(runtime.getHealth()).toMatchObject({
      status: "healthy",
      consecutiveFailures: 0,
    });
  });

  it("does not retry an unsafe submission without idempotency", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ error: "unavailable" }, 503),
    );
    const runtime = new ProviderRuntime({
      provider: "keeperhub",
      fetcher,
      sleep: vi.fn(async () => undefined),
    });

    await expect(
      runtime.json("https://provider.invalid/execute", { method: "POST" }),
    ).rejects.toBeInstanceOf(ProviderHttpError);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(runtime.getHealth().status).toBe("degraded");
  });

  it("never exposes credentials in observability events", async () => {
    const events: Record<string, unknown>[] = [];
    const runtime = new ProviderRuntime({
      provider: "github",
      fetcher: vi.fn(async () => jsonResponse({ ok: true })),
      observe: (event) => events.push(event),
    });

    await runtime.json(
      "https://api.github.com/repos/aether/test?token=secret",
      {
        headers: { authorization: "Bearer secret" },
      },
    );
    expect(JSON.stringify(events)).not.toContain("secret");
    expect(events[0]).toMatchObject({
      endpoint: "https://api.github.com/repos/aether/test",
    });
  });
});
