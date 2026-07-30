import { dashboardSchema, desiredStateSchema } from "@aether/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";

process.env.AETHER_PERSISTENCE_MODE = "memory";
process.env.AETHER_AUTH_MODE = "development";
process.env.AETHER_JWT_SECRET =
  "contract-test-secret-that-is-at-least-32-characters";

const desiredState = {
  version: "v2.4.2",
  networkId: "base-sepolia",
  chainId: 84532,
  contractId: "market",
  contractVersion: "2.4.2",
  implementationAddress: "0x84A1d4E153eD36F4DeF11F2D30e90E614B9418F0",
  oracleAddress: "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311",
  administrators: ["0x1111111111111111111111111111111111111111"],
  guardians: ["0x2222222222222222222222222222222222222222"],
  paused: false,
  fee: { value: "50", unit: "bps" },
  minimumExecutorGas: { value: "0.05", unit: "ether" },
  maximumAutomaticTransaction: { value: "0", unit: "ether" },
  release: "v2.4.2",
  source: "github:arcadia-labs/markets@v2.4.2",
};

describe("browser contract", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { createApplication } = await import("../src/main.js");
    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the exact shared dashboard schema", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/dashboard")
      .query({ organizationId: "org-arcadia", protocolId: "arcadia" })
      .expect(200);
    expect(() => dashboardSchema.parse(response.body)).not.toThrow();
  });

  it("round-trips the shared desired-state schema", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/desired-state/validate")
      .send(desiredState)
      .expect(201);
    expect(desiredStateSchema.parse(response.body)).toEqual(desiredState);
  });

  it("publishes the retained OpenAPI paths", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/openapi.json")
      .expect(200);
    expect(response.body.paths).toHaveProperty("/v1/dashboard");
    expect(response.body.paths).toHaveProperty(
      "/v1/operations/{operationId}/approval",
    );
    expect(response.body.paths).toHaveProperty("/v1/events");
  });
});
