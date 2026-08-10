import request from "supertest";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { config as loadEnvironment } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { contentHash } from "@aether/backend";
import { MissionStore } from "../src/runtime/mission-store";

loadEnvironment({ path: resolve(process.cwd(), "../..", ".env"), quiet: true });
if (process.env.AETHER_RUN_INTEGRATION === "1" && !process.env.MONGODB_URI)
  throw new Error("MONGODB_URI is required for integration tests.");
process.env.NODE_ENV = "test";
process.env.AETHER_ACCESS_TOKEN_SECRET =
  "integration-access-secret-that-is-at-least-32-characters";
process.env.AETHER_REFRESH_TOKEN_SECRET =
  "integration-refresh-secret-that-is-at-least-32-characters";
process.env.AETHER_COOKIE_SECRET =
  "integration-cookie-secret-that-is-at-least-32-characters";
process.env.AETHER_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
  "base64",
);
process.env.AETHER_ALLOWED_CHAIN_IDS = "11155111";
process.env.SEPOLIA_RPC_PRIMARY_URL = "http://127.0.0.1:18545";
process.env.SEPOLIA_RPC_SECONDARY_URL = "http://127.0.0.1:28545";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1025";
process.env.SMTP_FROM = "aether-integration@example.invalid";

describe.runIf(process.env.AETHER_RUN_INTEGRATION === "1")(
  "Aether API integration",
  () => {
    let app: INestApplication;
    let agent: ReturnType<typeof request.agent>;
    let store: MissionStore;
    let csrf = "";
    const email = `integration-${Date.now()}@example.invalid`;
    beforeAll(async () => {
      const { createApplication } = await import("../src/main.js");
      app = await createApplication();
      await app.init();
      store = app.get(MissionStore);
      const localSignupKeys = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].map(
        (subject) =>
          createHash("sha256").update(`signup:${subject}`).digest("base64url"),
      );
      await store.connection
        .collection("auth_rate_limits")
        .deleteMany({ key: { $in: localSignupKeys } });
      agent = request.agent(app.getHttpServer());
    }, 30_000);
    afterAll(async () => {
      await app?.close();
    });

    it("creates a secure session and resolves workspace membership from MongoDB", async () => {
      const signup = await agent
        .post("/v1/auth/signup")
        .send({ email, password: "correct-horse-battery-staple" })
        .expect(201);
      expect(signup.body.authenticated).toBe(true);
      expect(signup.body.accessToken).toBeUndefined();
      const cookies = Array.isArray(signup.headers["set-cookie"])
        ? signup.headers["set-cookie"]
        : [signup.headers["set-cookie"]];
      csrf = decodeURIComponent(
        String(
          cookies
            .find((cookie) => cookie?.startsWith("aether_csrf="))
            ?.split(";")[0]
            ?.split("=")[1],
        ),
      );
      const onboarding = await agent
        .post("/v1/auth/onboarding")
        .set("X-CSRF-Token", csrf)
        .send({ workspaceName: "Integration workspace" })
        .expect(201);
      expect(onboarding.body.workspaceId).toMatch(/^ws_/);
      const refreshed = await agent
        .post("/v1/auth/refresh")
        .set("X-CSRF-Token", csrf)
        .send({})
        .expect(201);
      const refreshedCookies = Array.isArray(refreshed.headers["set-cookie"])
        ? refreshed.headers["set-cookie"]
        : [refreshed.headers["set-cookie"]];
      csrf = decodeURIComponent(
        String(
          refreshedCookies
            .find((cookie) => cookie?.startsWith("aether_csrf="))
            ?.split(";")[0]
            ?.split("=")[1],
        ),
      );
      const session = await agent.get("/v1/auth/session").expect(200);
      expect(session.body.context).toMatchObject({
        workspaceId: onboarding.body.workspaceId,
        role: "OWNER",
      });
    }, 20_000);

    it("requires CSRF and idempotency for mission mutations", async () => {
      await agent.post("/v1/missions").send({}).expect(403);
      await agent
        .post("/v1/missions")
        .set("X-CSRF-Token", csrf)
        .send({})
        .expect(400);
    });

    it("does not expose encrypted KeeperHub credentials", async () => {
      const configured = await agent
        .put("/v1/integrations/keeperhub")
        .set("X-CSRF-Token", csrf)
        .set("Idempotency-Key", "integration-keeperhub-config")
        .send({
          apiKey: "kh_integration_not_real",
          baseUrl: "https://app.keeperhub.com/api",
        })
        .expect(200);
      expect(configured.body).toEqual({
        provider: "keeperhub",
        status: "CONFIGURED",
      });
      const read = await agent.get("/v1/integrations/keeperhub").expect(200);
      expect(JSON.stringify(read.body)).not.toContain(
        "kh_integration_not_real",
      );
      expect(read.body.encryptedCredentials).toBeUndefined();
    });

    it("fences a stale API instance after a competing lease takeover", async () => {
      const runId = `run_fencing_${Date.now()}`;
      const workspace = await store.connection
        .collection("workspaces")
        .findOne({ name: "Integration workspace" });
      const workspaceId = String(workspace?.workspaceId);
      await store.connection.collection("mission_runs").insertOne({
        workspaceId,
        runId,
        missionId: "mis_fencing",
        missionVersionId: "mv_fencing",
        state: "PREFLIGHT",
        stateReason: "Fencing test",
        fencingToken: 0,
        version: 0,
        nextActionAt: new Date("2099-01-01T00:00:00.000Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const competing = new MissionStore(store.connection);
      const firstClaim = await store.claimRun(runId, workspaceId);
      expect(firstClaim?.leaseOwner).toBe(store.runnerId);
      await expect(store.claimRun(runId, workspaceId)).resolves.toBeUndefined();
      await expect(
        competing.claimRun(runId, workspaceId),
      ).resolves.toBeUndefined();
      await store.connection
        .collection("mission_runs")
        .updateOne(
          { workspaceId, runId },
          { $set: { leaseExpiresAt: new Date(0) } },
        );
      const secondClaim = await competing.claimRun(runId, workspaceId);
      expect(secondClaim?.leaseOwner).toBe(competing.runnerId);
      expect(Number(secondClaim?.fencingToken)).toBeGreaterThan(
        Number(firstClaim?.fencingToken),
      );
      await expect(
        store.transitionRun(
          workspaceId,
          runId,
          Number(firstClaim?.fencingToken),
          "EXECUTING",
          "A stale owner must not write.",
        ),
      ).rejects.toThrow("Run lease is stale");
    });

    it("atomically moves an ambiguous submission and its run into reconciliation", async () => {
      const suffix = Date.now().toString();
      const runId = `run_unknown_${suffix}`;
      const stepRunId = `sr_unknown_${suffix}`;
      const executionAttemptId = `att_unknown_${suffix}`;
      const workspace = await store.connection
        .collection("workspaces")
        .findOne({ name: "Integration workspace" });
      const workspaceId = String(workspace?.workspaceId);
      const now = new Date();
      await store.connection.collection("mission_runs").insertOne({
        workspaceId,
        runId,
        missionId: `mis_unknown_${suffix}`,
        missionVersionId: `mv_unknown_${suffix}`,
        state: "EXECUTING",
        stateReason: "Submitting a write.",
        fencingToken: 0,
        version: 0,
        nextActionAt: new Date("2099-01-01T00:00:00.000Z"),
        createdAt: now,
        updatedAt: now,
      });
      await store.connection.collection("mission_step_runs").insertOne({
        workspaceId,
        runId,
        stepRunId,
        stepId: "authorize-repayment",
        state: "SUBMITTING",
        version: 0,
        createdAt: now,
        updatedAt: now,
      });
      await store.connection.collection("execution_attempts").insertOne({
        workspaceId,
        runId,
        stepRunId,
        executionAttemptId,
        operationKey: `operation_unknown_${suffix}`,
        generation: 0,
        keeperHubIdempotencyKey: `keeper_unknown_${suffix}`,
        status: "SUBMITTING",
        resubmissionLocked: false,
        createdAt: now,
        updatedAt: now,
      });
      const claim = await store.claimRun(runId, workspaceId);
      await store.markOutcomeUnknown(
        workspaceId,
        runId,
        stepRunId,
        executionAttemptId,
        Number(claim?.fencingToken),
        "Provider response timed out.",
      );
      const [run, step, attempt, reconciliation] = await Promise.all([
        store.connection
          .collection("mission_runs")
          .findOne({ workspaceId, runId }),
        store.connection
          .collection("mission_step_runs")
          .findOne({ workspaceId, runId, stepRunId }),
        store.connection
          .collection("execution_attempts")
          .findOne({ workspaceId, executionAttemptId }),
        store.connection
          .collection("reconciliation_cases")
          .findOne({ workspaceId, executionAttemptId }),
      ]);
      expect(run?.state).toBe("RECONCILING");
      expect(step?.state).toBe("OUTCOME_UNKNOWN");
      expect(attempt).toMatchObject({
        status: "RECONCILING",
        resubmissionLocked: true,
      });
      expect(reconciliation).toMatchObject({ state: "OPEN" });
    }, 20_000);

    it("keeps public demo runs isolated behind a per-run view token", async () => {
      const runId = `run_demo_access_${Date.now()}`;
      const viewToken = "demo-view-token-that-is-long-enough-for-access";
      await store.connection.collection("mission_runs").insertOne({
        workspaceId: "ws_public_demo",
        runId,
        missionId: "mis_demo_access",
        missionVersionId: "mv_demo_access",
        state: "PAUSED",
        stateReason: "Demo access test",
        demoScenario: "HAPPY_PATH",
        demoViewTokenHash: contentHash(viewToken),
        demoViewTokenExpiresAt: new Date(Date.now() + 60_000),
        fencingToken: 0,
        version: 0,
        nextActionAt: new Date("2099-01-01T00:00:00.000Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await agent.get(`/v1/demo/runs/${runId}`).expect(404);
      await agent
        .get(`/v1/demo/runs/${runId}`)
        .set("X-Demo-Run-Token", "incorrect-token")
        .expect(404);
      const visible = await agent
        .get(`/v1/demo/runs/${runId}`)
        .set("X-Demo-Run-Token", viewToken)
        .expect(200);
      expect(visible.body).toMatchObject({
        runId,
        state: "PAUSED",
        demoScenario: "HAPPY_PATH",
      });
    });
  },
);
