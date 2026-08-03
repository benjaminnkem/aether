import request from "supertest";
import { generateKeyPairSync } from "node:crypto";
import { resolve } from "node:path";
import { config as loadEnvironment } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";

loadEnvironment({ path: resolve(process.cwd(), "../..", ".env"), quiet: true });
if (process.env.AETHER_RUN_INTEGRATION === "1" && !process.env.MONGODB_URI) {
  throw new Error(
    "MONGODB_URI is required for API integration tests; start the MongoDB replica set and configure .env.",
  );
}
process.env.NODE_ENV = "test";
process.env.AETHER_ACCESS_TOKEN_SECRET =
  "integration-access-secret-that-is-at-least-32-characters";
process.env.AETHER_REFRESH_TOKEN_SECRET =
  "integration-refresh-secret-that-is-at-least-32-characters";
process.env.AETHER_COOKIE_SECRET =
  "integration-cookie-secret-that-is-at-least-32-characters";
process.env.NEXT_PUBLIC_AETHER_APP_URL = "http://localhost:3000";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1025";
process.env.SMTP_FROM = "aether-integration@example.invalid";
process.env.AETHER_CHAIN_ID = "11155111";
process.env.AETHER_MAINNET_DISABLED = "true";
process.env.AETHER_RPC_URL = "http://127.0.0.1:8545";
process.env.GITHUB_APP_ID = "12345";
process.env.GITHUB_APP_SLUG = "aether-integration";
process.env.GITHUB_WEBHOOK_SECRET =
  "integration-github-secret-that-is-at-least-32-characters";
process.env.AETHER_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
  "base64",
);
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.GITHUB_PRIVATE_KEY_BASE64 = Buffer.from(
  privateKey.export({ type: "pkcs8", format: "pem" }),
).toString("base64");

describe("Aether API integration", () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;
  const email = `integration-${Date.now()}@example.invalid`;

  beforeAll(async () => {
    const { createApplication } = await import("../src/main.js");
    app = await createApplication();
    await app.init();
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  it("signs in immediately, persists onboarding, refreshes, and loads the tenant dashboard", async () => {
    const signup = await agent
      .post("/v1/auth/signup")
      .send({ email, password: "correct-horse-battery-staple" })
      .expect(201);
    expect(signup.body.authenticated).toBe(true);
    expect(signup.body.accessToken).toEqual(expect.any(String));
    expect(signup.body.accessTokenExpiresInSeconds).toBe(900);
    const setCookies = signup.headers["set-cookie"];
    const cookieValues = Array.isArray(setCookies)
      ? setCookies
      : setCookies
        ? [setCookies]
        : [];
    const csrfCookieValue = cookieValues.find((cookie) =>
      cookie.startsWith("aether_csrf="),
    );
    expect(csrfCookieValue).toBeDefined();
    const csrf = csrfCookieValue?.split(";")[0]?.split("=")[1];
    expect(csrf).toBeDefined();
    const preOnboardingSession = await agent
      .get("/v1/auth/session")
      .expect(200);
    expect(preOnboardingSession.body).toMatchObject({
      authenticated: true,
      user: { email },
      destination: "onboarding",
    });
    expect(preOnboardingSession.body.accessToken).toBeUndefined();
    const onboarding = await agent
      .post("/v1/auth/onboarding")
      .set("X-CSRF-Token", decodeURIComponent(csrf ?? ""))
      .send({
        organizationName: "Integration Organization",
        protocolName: "Integration Protocol",
        governanceAuthority: "Integration multisig",
      })
      .expect(201);
    await agent
      .post("/v1/auth/refresh")
      .set("X-CSRF-Token", decodeURIComponent(csrf))
      .expect(201);
    const activeSession = await agent.get("/v1/auth/session").expect(200);
    expect(activeSession.body).toMatchObject({
      destination: "dashboard",
      context: {
        organizationId: onboarding.body.organizationId,
        protocolId: onboarding.body.protocolId,
        role: "owner",
      },
    });
    const dashboard = await agent.get("/v1/dashboard").expect(200);
    expect(dashboard.body.organization.id).toBe(onboarding.body.organizationId);
    expect(dashboard.body.protocols[0].id).toBe(onboarding.body.protocolId);
  }, 20_000);

  it("rejects provider secrets submitted from the browser", async () => {
    const response = await agent
      .put("/v1/protocol-setup/keeperhub")
      .set("X-CSRF-Token", "invalid-on-purpose")
      .send({ apiToken: "must-not-enter-browser" });
    expect([400, 403]).toContain(response.status);
  });

  it("binds a one-time GitHub installation callback and redirects to refreshed setup UI", async () => {
    const installUrl = await agent.get("/v1/github/install-url").expect(200);
    const state = new URL(installUrl.body.url).searchParams.get("state");
    expect(state).toEqual(expect.any(String));
    const githubFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 9876,
            repository_selection: "all",
            account: { login: "integration-owner", type: "User" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "installation-token-for-integration-test",
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      );

    const callback = await agent
      .get("/v1/github/callback")
      .query({ installation_id: 9876, setup_action: "install", state })
      .expect(303);

    expect(callback.headers.location).toBe(
      "http://localhost:3000/app/protocol-setup?tab=github&github=connected",
    );
    expect(githubFetch).toHaveBeenCalledTimes(2);
    const dashboard = await agent.get("/v1/dashboard").expect(200);
    expect(
      dashboard.body.records.connections.find(
        (connection: { id: string }) => connection.id === "github",
      ),
    ).toMatchObject({ status: "healthy" });

    await agent
      .get("/v1/github/callback")
      .query({ installation_id: 9876, setup_action: "install", state })
      .expect(401);
    githubFetch.mockRestore();
  });
});
