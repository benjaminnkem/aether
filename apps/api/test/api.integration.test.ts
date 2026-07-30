import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";

process.env.AETHER_PERSISTENCE_MODE = "memory";
process.env.AETHER_AUTH_MODE = "development";
process.env.AETHER_JWT_SECRET =
  "integration-test-secret-that-is-at-least-32-characters";

describe("Aether API integration", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { createApplication } = await import("../src/main.js");
    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves the one-organization dashboard and advances the lifecycle", async () => {
    const initial = await request(app.getHttpServer())
      .post("/v1/demo/scenario")
      .send({ scenario: "unauthorized-oracle" })
      .expect(201);
    expect(initial.body.organization.id).toBe("org-arcadia");
    expect(initial.body.records.drift).toHaveLength(1);

    const advanced = await request(app.getHttpServer())
      .post("/v1/demo/advance")
      .expect(201);
    expect(advanced.body.lifecycleStage).toBe(1);
  });

  it("binds contextual approval to the retained operation endpoint", async () => {
    await request(app.getHttpServer())
      .post("/v1/demo/scenario")
      .send({ scenario: "unauthorized-oracle" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/v1/operations/op-oracle-restoration/execution")
      .expect(400);

    const response = await request(app.getHttpServer())
      .post("/v1/operations/op-oracle-restoration/approval")
      .send({ decision: "approve" });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.operation.status).toBe("approved");
    expect(response.body.operation.approvals[0].status).toBe("approved");

    const execution = await request(app.getHttpServer())
      .post("/v1/operations/op-oracle-restoration/execution")
      .set("Idempotency-Key", "b".repeat(64))
      .expect(201);
    expect(execution.body.idempotencyKey).toBe("b".repeat(64));
  });

  it("rejects invalid desired state at runtime", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/desired-state/validate")
      .send({ version: "not-semver" })
      .expect(400);
    expect(response.body.message).toBe("Request validation failed.");
  });

  it("enforces tenant context from the authenticated actor", async () => {
    await request(app.getHttpServer())
      .get("/v1/dashboard")
      .query({ organizationId: "org-other", protocolId: "arcadia" })
      .expect(403);
  });

  it("never accepts provider credentials through browser setup", async () => {
    await request(app.getHttpServer())
      .put("/v1/protocol-setup/keeperhub")
      .send({ status: "connected", apiToken: "must-not-enter-browser" })
      .expect(400);
  });

  it("enforces role authorization in token mode", async () => {
    process.env.AETHER_AUTH_MODE = "jwt";
    const token = app.get(JwtService).sign({
      actorId: "user-viewer",
      organizationId: "org-arcadia",
      protocolId: "arcadia",
      role: "viewer",
    });
    await request(app.getHttpServer())
      .post("/v1/observations/scans")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
    process.env.AETHER_AUTH_MODE = "development";
  });
});
