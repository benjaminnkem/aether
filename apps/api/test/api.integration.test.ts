import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";

const enabled = Boolean(process.env.MONGODB_URI);
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

describe.runIf(enabled)("Aether API integration", () => {
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
});
