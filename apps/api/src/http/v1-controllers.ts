import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpException,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  contentHash,
  CredentialCipher,
  type TenantContext,
} from "@aether/backend";
import {
  decisionSchema,
  missionDefinitionSchema,
  TERMINAL_MISSION_STATES,
} from "@aether/shared";
import { Public, Roles, Scopes } from "../auth/auth";
import type { AuthenticatedRequest } from "../auth/auth";
import { MissionStore } from "../runtime/mission-store";
import { RunCoordinator } from "../runtime/run-coordinator";
import { KeeperHubHttpClient } from "../runtime/providers";
import { randomBytes, randomUUID } from "node:crypto";
import { keccak256, padHex, stringToHex, toFunctionSelector } from "viem";

function tenant(request: Request): TenantContext {
  const authenticated = request as AuthenticatedRequest;
  if (!authenticated.tenant) throw new Error("Tenant context is unavailable.");
  return authenticated.tenant;
}
function key(value?: string) {
  if (!value || value.length < 8 || value.length > 200)
    throw new BadRequestException(
      "Idempotency-Key is required (8-200 characters).",
    );
  return value;
}

@Controller()
export class SystemController {
  constructor(
    private readonly store: MissionStore,
    private readonly keeper: KeeperHubHttpClient,
  ) {}
  @Public() @Get("health") health() {
    return {
      status: "ok",
      service: "aether-api",
      timestamp: new Date().toISOString(),
    };
  }
  @Public() @Get("ready") async ready() {
    await this.store.connection.db?.command({ ping: 1 });
    return { status: "ready", database: "reachable" };
  }
  @Roles("OWNER", "OPERATOR") @Get("metrics") async metrics() {
    return {
      activeRuns: await this.store.connection
        .collection("mission_runs")
        .countDocuments({ state: { $nin: [...TERMINAL_MISSION_STATES] } }),
      staleLeases: await this.store.connection
        .collection("mission_runs")
        .countDocuments({ leaseExpiresAt: { $lt: new Date() } }),
      unknownAttempts: await this.store.connection
        .collection("execution_attempts")
        .countDocuments({ resubmissionLocked: true }),
      keeperHub: this.keeper.health(),
    };
  }
}

@Controller("missions")
export class MissionsController {
  constructor(
    private readonly store: MissionStore,
    private readonly coordinator: RunCoordinator,
  ) {}
  @Get() @Scopes("missions:read") list(
    @Req() request: Request,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.store.listMissions(
      tenant(request),
      cursor,
      limit ? Number(limit) : 25,
    );
  }
  @Post()
  @Scopes("missions:create")
  @Roles("OWNER", "OPERATOR", "AGENT")
  create(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.store.createMission(tenant(request), body, key(idempotencyKey));
  }
  @Get(":missionId") @Scopes("missions:read") get(
    @Req() request: Request,
    @Param("missionId") missionId: string,
  ) {
    return this.store.getMission(tenant(request), missionId);
  }
  @Post(":missionId/versions") @Roles("OWNER", "OPERATOR") version(
    @Req() request: Request,
    @Param("missionId") missionId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.store.createVersion(
      tenant(request),
      missionId,
      missionDefinitionSchema.parse(body),
      key(idempotencyKey),
    );
  }
  @Post(":missionId/archive") @Roles("OWNER", "OPERATOR") archive(
    @Req() request: Request,
    @Param("missionId") missionId: string,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.store.archiveMission(
      tenant(request),
      missionId,
      key(idempotencyKey),
    );
  }
  @Post(":missionId/runs")
  @Scopes("runs:create")
  @Roles("OWNER", "OPERATOR", "AGENT")
  async run(
    @Req() request: Request,
    @Res() response: Response,
    @Param("missionId") missionId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    const created = await this.store.createRun(
      tenant(request),
      missionId,
      body,
      key(idempotencyKey),
    );
    const runId = String((created as Record<string, unknown>).runId);
    this.coordinator.start(runId);
    if (request.accepts("text/event-stream"))
      return streamRun(
        this.store,
        this.coordinator,
        tenant(request),
        runId,
        response,
        0,
      );
    await waitForBoundary(this.store, tenant(request), runId);
    return response
      .status(201)
      .json(await this.store.getRun(tenant(request), runId));
  }
}

@Controller("runs")
export class RunsController {
  constructor(
    private readonly store: MissionStore,
    private readonly coordinator: RunCoordinator,
  ) {}
  @Get(":runId") @Scopes("runs:read") get(
    @Req() request: Request,
    @Param("runId") runId: string,
  ) {
    return this.store.getRun(tenant(request), runId);
  }
  @Get(":runId/timeline") @Scopes("runs:read") timeline(
    @Req() request: Request,
    @Param("runId") runId: string,
    @Query("after") after?: string,
  ) {
    return this.store.timelineEvents(
      tenant(request),
      runId,
      Number(after ?? 0),
    );
  }
  @Get(":runId/receipt") @Scopes("receipts:read") receipt(
    @Req() request: Request,
    @Param("runId") runId: string,
  ) {
    return this.store.receipt(tenant(request), runId);
  }
  @Get(":runId/stream")
  @Scopes("runs:read")
  @Header("X-Accel-Buffering", "no")
  stream(
    @Req() request: Request,
    @Res() response: Response,
    @Param("runId") runId: string,
    @Query("after") after?: string,
  ) {
    this.coordinator.start(runId);
    return streamRun(
      this.store,
      this.coordinator,
      tenant(request),
      runId,
      response,
      Number(request.get("last-event-id") ?? after ?? 0),
    );
  }
  @Post(":runId/pause") @Roles("OWNER", "OPERATOR") pause(
    @Req() request: Request,
    @Param("runId") runId: string,
    @Headers("idempotency-key") id?: string,
  ) {
    key(id);
    return this.coordinator.control(
      tenant(request).workspaceId,
      runId,
      "pause",
    );
  }
  @Post(":runId/resume") @Roles("OWNER", "OPERATOR") resume(
    @Req() request: Request,
    @Param("runId") runId: string,
    @Headers("idempotency-key") id?: string,
  ) {
    key(id);
    return this.coordinator.control(
      tenant(request).workspaceId,
      runId,
      "resume",
    );
  }
  @Post(":runId/cancel") @Roles("OWNER", "OPERATOR") cancel(
    @Req() request: Request,
    @Param("runId") runId: string,
    @Headers("idempotency-key") id?: string,
  ) {
    key(id);
    return this.coordinator.control(
      tenant(request).workspaceId,
      runId,
      "cancel",
    );
  }
}

@Controller("approvals")
export class ApprovalsController {
  constructor(
    private readonly store: MissionStore,
    private readonly coordinator: RunCoordinator,
  ) {}
  @Get() list(@Req() request: Request) {
    return this.store.listApprovals(tenant(request));
  }
  @Get(":id") get(@Req() request: Request, @Param("id") id: string) {
    return this.store.getApproval(tenant(request), id);
  }
  @Post(":id/approve") @Roles("OWNER", "OPERATOR") async approve(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") idem?: string,
  ) {
    const idempotencyKey = key(idem);
    const context = tenant(request);
    const approval = await this.store.decideApproval(
      context,
      id,
      "APPROVED",
      decisionSchema.parse(body).reason,
      idempotencyKey,
    );
    await this.coordinator.applyApproval(
      context.workspaceId,
      String(approval.runId),
      String(approval.scope),
    );
    return approval;
  }
  @Post(":id/deny") @Roles("OWNER", "OPERATOR") deny(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") idem?: string,
  ) {
    const idempotencyKey = key(idem);
    return this.store.decideApproval(
      tenant(request),
      id,
      "DENIED",
      decisionSchema.parse(body).reason,
      idempotencyKey,
    );
  }
}

@Controller("audit")
export class AuditController {
  constructor(private readonly store: MissionStore) {}
  @Get() list(@Req() request: Request, @Query("limit") limit?: string) {
    return this.store.listAudit(tenant(request), Number(limit ?? 100));
  }
  @Get(":id") get(@Req() request: Request, @Param("id") id: string) {
    return this.store.getAudit(tenant(request), id);
  }
}

const apiKeyInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    scopes: z
      .array(
        z.enum([
          "missions:read",
          "missions:create",
          "runs:create",
          "runs:read",
          "receipts:read",
        ]),
      )
      .min(1),
  })
  .strict();
@Controller("api-keys")
export class ApiKeysController {
  constructor(private readonly store: MissionStore) {}
  @Get() @Roles("OWNER") list(@Req() request: Request) {
    return this.store.listApiKeys(tenant(request));
  }
  @Post() @Roles("OWNER") create(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers("idempotency-key") id?: string,
  ) {
    const idempotencyKey = key(id);
    return this.store.createApiKey(
      tenant(request),
      apiKeyInput.parse(body),
      idempotencyKey,
    );
  }
  @Delete(":id") @Roles("OWNER") revoke(
    @Req() request: Request,
    @Param("id") id: string,
    @Headers("idempotency-key") idem?: string,
  ) {
    const context = tenant(request);
    return this.store.idempotentMutation(
      context,
      key(idem),
      `api-keys.revoke:${id}`,
      { id },
      async (session) => {
        await this.store.connection
          .collection("api_keys")
          .updateOne(
            { workspaceId: context.workspaceId, apiKeyId: id },
            { $set: { revokedAt: new Date() } },
            { session },
          );
        return { apiKeyId: id, revoked: true };
      },
    );
  }
}

const integrationInput = z
  .object({
    apiKey: z.string().startsWith("kh_").max(500),
    baseUrl: z.string().url().max(500).default("https://app.keeperhub.com/api"),
  })
  .strict();
@Controller("integrations/keeperhub")
export class KeeperHubIntegrationController {
  constructor(
    private readonly store: MissionStore,
    private readonly keeper: KeeperHubHttpClient,
  ) {}
  @Get() @Roles("OWNER") async get(@Req() request: Request) {
    const value = await this.store.connection
      .collection("integrations")
      .findOne(
        { workspaceId: tenant(request).workspaceId, provider: "keeperhub" },
        { projection: { encryptedCredentials: 0 } },
      );
    return value
      ? publicDoc(value)
      : { provider: "keeperhub", status: "NOT_CONFIGURED" };
  }
  @Put() @Roles("OWNER") async put(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers("idempotency-key") id?: string,
  ) {
    const idempotencyKey = key(id);
    const input = integrationInput.parse(body);
    const context = tenant(request);
    const version = 1;
    const cipher = new CredentialCipher(
      required("AETHER_CREDENTIAL_ENCRYPTION_KEY"),
    );
    const encryptedCredentials = cipher.encrypt(JSON.stringify(input), {
      workspaceId: context.workspaceId,
      provider: "keeperhub",
      version,
    });
    return this.store.idempotentMutation(
      context,
      idempotencyKey,
      "integrations.keeperhub.configure",
      { baseUrl: input.baseUrl, credentialHash: contentHash(input.apiKey) },
      async (session) => {
        await this.store.connection.collection("integrations").updateOne(
          { workspaceId: context.workspaceId, provider: "keeperhub" },
          {
            $set: {
              encryptedCredentials,
              credentialVersion: version,
              status: "CONFIGURED",
              metadata: { baseUrl: new URL(input.baseUrl).origin },
              updatedAt: new Date(),
            },
            $setOnInsert: {
              workspaceId: context.workspaceId,
              provider: "keeperhub",
              createdAt: new Date(),
            },
          },
          { upsert: true, session },
        );
        return { provider: "keeperhub", status: "CONFIGURED" };
      },
    );
  }
  @Post("validate") @Roles("OWNER") validate(
    @Headers("idempotency-key") id?: string,
  ) {
    key(id);
    return { ...this.keeper.health(), credentialPlaintextReturned: false };
  }
  @Delete() @Roles("OWNER") async remove(
    @Req() request: Request,
    @Headers("idempotency-key") id?: string,
  ) {
    const context = tenant(request);
    return this.store.idempotentMutation(
      context,
      key(id),
      "integrations.keeperhub.delete",
      {},
      async (session) => {
        await this.store.connection
          .collection("integrations")
          .deleteOne(
            { workspaceId: context.workspaceId, provider: "keeperhub" },
            { session },
          );
        return { deleted: true };
      },
    );
  }
}

@Controller("policy")
export class PolicyController {
  constructor(private readonly store: MissionStore) {}
  @Get() async get(
    @Req() request: Request,
  ): Promise<Record<string, unknown> | null> {
    const value = await this.store.connection
      .collection("workspace_policies")
      .findOne(
        { workspaceId: tenant(request).workspaceId },
        { projection: { _id: 0 } },
      );
    return value as Record<string, unknown> | null;
  }
  @Put() @Roles("OWNER") async put(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers("idempotency-key") id?: string,
  ) {
    const idempotencyKey = key(id);
    const input = z
      .object({
        emergencyPause: z.boolean(),
        maximumWritesPerMission: z.number().int().min(1).max(32),
        maximumValueWei: z.string().regex(/^\d+$/),
        maximumRecoverySpendWei: z.string().regex(/^\d+$/),
      })
      .strict()
      .parse(body);
    const context = tenant(request);
    return this.store.idempotentMutation(
      context,
      idempotencyKey,
      "policy.update",
      input,
      async (session) => {
        await this.store.connection.collection("workspace_policies").updateOne(
          { workspaceId: context.workspaceId },
          {
            $set: {
              ...input,
              allowedChainIds: [11155111],
              updatedAt: new Date(),
            },
          },
          { upsert: true, session },
        );
        return { ...input, allowedChainIds: [11155111] };
      },
    );
  }
}

const webhookInput = z
  .object({
    url: z.string().url().max(500),
    secret: z.string().min(32).max(500),
    events: z.array(z.string().min(1).max(120)).min(1).max(30),
  })
  .strict();
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly store: MissionStore) {}
  @Get() @Roles("OWNER") async list(@Req() request: Request) {
    return {
      items: (
        await this.store.connection
          .collection("webhook_endpoints")
          .find({ workspaceId: tenant(request).workspaceId })
          .project({ encryptedSecret: 0 })
          .toArray()
      ).map(publicDoc),
    };
  }
  @Post() @Roles("OWNER") async create(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers("idempotency-key") idem?: string,
  ) {
    const idempotencyKey = key(idem);
    const input = webhookInput.parse(body);
    const url = new URL(input.url);
    if (url.protocol !== "https:" || isPrivateHostname(url.hostname))
      throw new BadRequestException(
        "Webhook URL must be a public HTTPS endpoint.",
      );
    const context = tenant(request);
    const webhookId = `wh_${randomUUID()}`;
    const version = 1;
    const cipher = new CredentialCipher(
      required("AETHER_CREDENTIAL_ENCRYPTION_KEY"),
    );
    const encryptedSecret = cipher.encrypt(input.secret, {
      workspaceId: context.workspaceId,
      provider: `webhook:${webhookId}`,
      version,
    });
    return this.store.idempotentMutation(
      context,
      idempotencyKey,
      "webhooks.create",
      {
        url: url.toString(),
        events: input.events,
        secretHash: contentHash(input.secret),
      },
      async (session) => {
        await this.store.connection.collection("webhook_endpoints").insertOne(
          {
            workspaceId: context.workspaceId,
            webhookId,
            url: url.toString(),
            encryptedSecret,
            secretVersion: version,
            events: [...new Set(input.events)],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          { session },
        );
        return {
          webhookId,
          url: url.toString(),
          events: input.events,
          secretPlaintextReturned: false,
        };
      },
    );
  }
  @Delete(":id") @Roles("OWNER") async remove(
    @Req() request: Request,
    @Param("id") id: string,
    @Headers("idempotency-key") idem?: string,
  ) {
    const context = tenant(request);
    return this.store.idempotentMutation(
      context,
      key(idem),
      `webhooks.disable:${id}`,
      { id },
      async (session) => {
        await this.store.connection
          .collection("webhook_endpoints")
          .updateOne(
            { workspaceId: context.workspaceId, webhookId: id },
            { $set: { disabledAt: new Date(), updatedAt: new Date() } },
            { session },
          );
        return { webhookId: id, disabled: true };
      },
    );
  }
}

const demoScenarioSchema = z
  .object({
    scenario: z.enum(["HAPPY_PATH", "PARTIAL_FAILURE", "UNKNOWN_OUTCOME"]),
    launchToken: z.string().min(40).max(200),
  })
  .strict();
@Controller("demo")
export class DemoController {
  constructor(
    private readonly store: MissionStore,
    private readonly coordinator: RunCoordinator,
  ) {}
  @Public() @Get("scenarios") async scenarios(@Req() request: Request) {
    const launchToken = randomBytes(32).toString("base64url");
    await this.store.connection.collection("demo_tokens").insertOne({
      tokenHash: contentHash(launchToken),
      ipHash: contentHash(request.ip ?? "unknown"),
      expiresAt: new Date(Date.now() + 10 * 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const replays = await this.store.connection
      .collection("mission_receipts")
      .find({ workspaceId: "ws_public_demo", demoReplayApproved: true })
      .project({ _id: 0 })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();
    return {
      liveExecutionEnabled: process.env.DEMO_LIVE_EXECUTION_ENABLED === "true",
      replays,
      scenarios: ["HAPPY_PATH", "PARTIAL_FAILURE", "UNKNOWN_OUTCOME"],
      launchToken,
    };
  }
  @Public() @Post("runs") async run(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers("idempotency-key") idem?: string,
  ) {
    const idempotencyKey = key(idem);
    const { scenario, launchToken } = demoScenarioSchema.parse(body);
    const consumed = await this.store.connection
      .collection("demo_tokens")
      .findOneAndUpdate(
        {
          tokenHash: contentHash(launchToken),
          ipHash: contentHash(request.ip ?? "unknown"),
          usedAt: { $exists: false },
          expiresAt: { $gt: new Date() },
        },
        { $set: { usedAt: new Date(), updatedAt: new Date() } },
        { returnDocument: "after" },
      );
    if (!consumed)
      throw new BadRequestException(
        "Demo launch token is invalid, expired, or already used.",
      );
    await rateLimitDemo(this.store, request.ip ?? "unknown");
    if (process.env.DEMO_LIVE_EXECUTION_ENABLED !== "true")
      throw new BadRequestException(
        "Live demo execution is disabled. Use a labeled verified replay.",
      );
    const contractAddress = z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .parse(process.env.DEMO_VAULT_ADDRESS);
    const amount = z
      .string()
      .regex(/^\d+$/)
      .parse(process.env.DEMO_FIXED_AMOUNT ?? "100");
    if (BigInt(amount) > BigInt(process.env.DEMO_MAX_AMOUNT ?? "100"))
      throw new BadRequestException("Demo amount exceeds the global cap.");
    const context: TenantContext = {
      workspaceId: "ws_public_demo",
      actorId: `demo:${request.ip ?? "unknown"}`,
      role: "OPERATOR",
    };
    await this.store.connection.collection("workspaces").updateOne(
      { workspaceId: context.workspaceId },
      {
        $setOnInsert: {
          workspaceId: context.workspaceId,
          name: "Public demo",
          slug: "public-demo",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    const runKey = keccak256(stringToHex(`${scenario}:${randomUUID()}`));
    const definition = demoDefinition(
      scenario,
      contractAddress,
      runKey,
      amount,
    );
    const createdMission = await this.store.createMission(
      context,
      {
        name: `${scenario.replaceAll("_", " ")} ${runKey.slice(2, 10)}`,
        description:
          "Fixed Sepolia demonstration using the production mission runtime.",
        definition,
      },
      `${idempotencyKey}:mission`,
    );
    const missionId = String(
      (createdMission as Record<string, unknown>).missionId,
    );
    const createdRun = await this.store.createRun(
      context,
      missionId,
      { input: { scenario } },
      `${idempotencyKey}:run`,
    );
    const runId = String((createdRun as Record<string, unknown>).runId);
    const viewToken = randomBytes(32).toString("base64url");
    await this.store.connection.collection("mission_runs").updateOne(
      { workspaceId: context.workspaceId, runId },
      {
        $set: {
          demoScenario: scenario,
          demoFaultAfterProviderCall: scenario === "UNKNOWN_OUTCOME",
          demoViewTokenHash: contentHash(viewToken),
          demoViewTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        },
      },
    );
    this.coordinator.start(runId);
    return { ...(createdRun as object), scenario, live: true, viewToken };
  }

  @Public() @Get("runs/:runId") async getRun(
    @Param("runId") runId: string,
    @Headers("x-demo-run-token") viewToken?: string,
  ) {
    const context = await this.demoContext(runId, viewToken);
    return this.store.getRun(context, runId);
  }

  @Public()
  @Get("runs/:runId/stream")
  @Header("X-Accel-Buffering", "no")
  async stream(
    @Req() request: Request,
    @Res() response: Response,
    @Param("runId") runId: string,
    @Headers("x-demo-run-token") viewToken?: string,
    @Query("after") after?: string,
  ) {
    const context = await this.demoContext(runId, viewToken);
    return streamRun(
      this.store,
      this.coordinator,
      context,
      runId,
      response,
      Number(request.get("last-event-id") ?? after ?? 0),
    );
  }

  private async demoContext(
    runId: string,
    viewToken?: string,
  ): Promise<TenantContext> {
    if (!viewToken || viewToken.length > 200)
      throw new NotFoundException("Demo run not found.");
    const run = await this.store.connection.collection("mission_runs").findOne({
      workspaceId: "ws_public_demo",
      runId,
      demoScenario: { $exists: true },
      demoViewTokenHash: contentHash(viewToken),
      demoViewTokenExpiresAt: { $gt: new Date() },
    });
    if (!run) throw new NotFoundException("Demo run not found.");
    return {
      workspaceId: "ws_public_demo",
      actorId: "demo-viewer",
      role: "VIEWER",
    };
  }
}

async function streamRun(
  store: MissionStore,
  coordinator: RunCoordinator,
  context: TenantContext,
  runId: string,
  response: Response,
  initialCursor: number,
) {
  response.status(200);
  response.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders();
  let cursor = initialCursor;
  let closed = false;
  response.on("close", () => {
    closed = true;
  });
  const writePending = async () => {
    const events = await store.timelineEvents(context, runId, cursor, 1000);
    for (const event of events) {
      cursor = Number(event.sequence);
      response.write(
        `id: ${cursor}\nevent: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`,
      );
    }
  };
  await writePending();
  const initial = (await store.getRun(context, runId)) as Record<
    string,
    unknown
  >;
  if (
    TERMINAL_MISSION_STATES.has(initial.state as never) ||
    ["PAUSED", "AWAITING_APPROVAL"].includes(String(initial.state))
  ) {
    response.write(
      `event: boundary\ndata: ${JSON.stringify({ runId, state: initial.state })}\n\n`,
    );
    response.end();
    return;
  }
  coordinator.start(runId);
  const heartbeat = setInterval(() => {
    if (!closed) response.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15000);
  const change = store.connection.collection("timeline_events").watch(
    [
      {
        $match: {
          "fullDocument.workspaceId": context.workspaceId,
          "fullDocument.runId": runId,
        },
      },
    ],
    { fullDocument: "updateLookup" },
  );
  try {
    for await (const event of change) {
      void event;
      if (closed) break;
      await writePending();
      const run = (await store.getRun(context, runId)) as Record<
        string,
        unknown
      >;
      if (
        TERMINAL_MISSION_STATES.has(run.state as never) ||
        ["PAUSED", "AWAITING_APPROVAL"].includes(String(run.state))
      ) {
        response.write(
          `event: boundary\ndata: ${JSON.stringify({ runId, state: run.state })}\n\n`,
        );
        break;
      }
    }
  } finally {
    clearInterval(heartbeat);
    await change.close();
    if (!closed) response.end();
  }
}
async function waitForBoundary(
  store: MissionStore,
  context: TenantContext,
  runId: string,
) {
  const deadline =
    Date.now() +
    Number(process.env.AETHER_SYNC_REQUEST_TIMEOUT_MS ?? 15 * 60_000);
  while (Date.now() < deadline) {
    const run = (await store.getRun(context, runId)) as Record<string, unknown>;
    if (
      TERMINAL_MISSION_STATES.has(run.state as never) ||
      ["PAUSED", "AWAITING_APPROVAL", "NEEDS_ATTENTION"].includes(
        String(run.state),
      )
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
function publicDoc(value: Record<string, unknown>) {
  const result = { ...value };
  delete result._id;
  delete result.encryptedCredentials;
  return result;
}
function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".local") ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    /^127\./.test(normalized) ||
    /^10\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
  );
}
async function rateLimitDemo(store: MissionStore, keyValue: string) {
  await consumeDemoLimit(
    store,
    `ip:${keyValue}`,
    Number(process.env.DEMO_RUNS_PER_HOUR ?? 2),
  );
  await consumeDemoLimit(
    store,
    "global",
    Number(process.env.DEMO_GLOBAL_RUNS_PER_HOUR ?? 20),
  );
}
async function consumeDemoLimit(
  store: MissionStore,
  limiterKey: string,
  maximum: number,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60_000);
  const collection = store.connection.collection("demo_rate_limits");
  const active = await collection.findOneAndUpdate(
    { key: limiterKey, expiresAt: { $gt: now }, count: { $lt: maximum } },
    { $inc: { count: 1 }, $set: { updatedAt: now } },
    { returnDocument: "after" },
  );
  if (active) return;
  const reset = await collection
    .updateOne(
      {
        key: limiterKey,
        $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
      },
      {
        $set: { count: 1, expiresAt, updatedAt: now },
        $setOnInsert: { key: limiterKey, createdAt: now },
      },
      { upsert: true },
    )
    .catch(() => undefined);
  if (!reset?.acknowledged)
    throw new HttpException("Demo execution limit reached.", 429);
}
const demoAbi = [
  {
    type: "function",
    name: "withdrawSource",
    stateMutability: "nonpayable",
    inputs: [
      { name: "runKey", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "authorizeDestination",
    stateMutability: "nonpayable",
    inputs: [{ name: "runKey", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "depositDestination",
    stateMutability: "nonpayable",
    inputs: [
      { name: "runKey", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "blockedDestinationDeposit",
    stateMutability: "pure",
    inputs: [{ name: "runKey", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeAuthorization",
    stateMutability: "nonpayable",
    inputs: [{ name: "runKey", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "restoreSource",
    stateMutability: "nonpayable",
    inputs: [
      { name: "runKey", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "sourceBalance",
    stateMutability: "view",
    inputs: [{ name: "runKey", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "inTransitBalance",
    stateMutability: "view",
    inputs: [{ name: "runKey", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "destinationBalance",
    stateMutability: "view",
    inputs: [{ name: "runKey", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "destinationAuthorized",
    stateMutability: "view",
    inputs: [{ name: "runKey", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
];
function demoAction(
  contractAddress: string,
  functionName: string,
  functionArgs: string[],
) {
  return {
    chainId: 11155111 as const,
    contractAddress,
    functionName,
    functionArgs,
    abi: demoAbi,
    valueWei: "0",
  };
}
function receiptProof() {
  return {
    kind: "RECEIPT" as const,
    confirmations: Number(process.env.AETHER_MIN_CONFIRMATIONS ?? 3),
  };
}
function demoDefinition(
  scenario: "HAPPY_PATH" | "PARTIAL_FAILURE" | "UNKNOWN_OUTCOME",
  contractAddress: string,
  runKey: `0x${string}`,
  amount: string,
) {
  const steps =
    scenario === "HAPPY_PATH"
      ? [
          {
            id: "withdraw",
            name: "Withdraw source",
            dependsOn: [],
            retryClass: "PROVABLE_EFFECT" as const,
            action: demoAction(contractAddress, "withdrawSource", [
              runKey,
              amount,
            ]),
            proof: receiptProof(),
          },
          {
            id: "authorize",
            name: "Authorize destination",
            dependsOn: ["withdraw"],
            retryClass: "SEMANTICALLY_IDEMPOTENT" as const,
            action: demoAction(contractAddress, "authorizeDestination", [
              runKey,
            ]),
            proof: receiptProof(),
          },
          {
            id: "deposit",
            name: "Deposit destination",
            dependsOn: ["authorize"],
            retryClass: "PROVABLE_EFFECT" as const,
            action: demoAction(contractAddress, "depositDestination", [
              runKey,
              amount,
            ]),
            proof: receiptProof(),
          },
        ]
      : scenario === "PARTIAL_FAILURE"
        ? [
            {
              id: "withdraw",
              name: "Withdraw source",
              dependsOn: [],
              retryClass: "PROVABLE_EFFECT" as const,
              action: demoAction(contractAddress, "withdrawSource", [
                runKey,
                amount,
              ]),
              proof: receiptProof(),
              compensation: {
                id: "restore",
                action: demoAction(contractAddress, "restoreSource", [
                  runKey,
                  amount,
                ]),
                proof: receiptProof(),
              },
            },
            {
              id: "authorize",
              name: "Authorize destination",
              dependsOn: ["withdraw"],
              retryClass: "SEMANTICALLY_IDEMPOTENT" as const,
              action: demoAction(contractAddress, "authorizeDestination", [
                runKey,
              ]),
              proof: receiptProof(),
              compensation: {
                id: "revoke",
                action: demoAction(contractAddress, "revokeAuthorization", [
                  runKey,
                ]),
                proof: receiptProof(),
              },
            },
            {
              id: "blocked",
              name: "Blocked destination deposit",
              dependsOn: ["authorize"],
              retryClass: "NON_REPLAYABLE" as const,
              action: demoAction(contractAddress, "blockedDestinationDeposit", [
                runKey,
              ]),
              proof: receiptProof(),
            },
          ]
        : [
            {
              id: "authorize",
              name: "Authorize destination",
              dependsOn: [],
              retryClass: "PROVABLE_EFFECT" as const,
              action: demoAction(contractAddress, "authorizeDestination", [
                runKey,
              ]),
              proof: {
                kind: "EVENT" as const,
                address: contractAddress,
                topic0: keccak256(
                  stringToHex("DemoAction(bytes32,bytes4,uint256,uint256)"),
                ),
                indexed: [
                  runKey,
                  padHex(toFunctionSelector("authorizeDestination(bytes32)"), {
                    size: 32,
                    dir: "right",
                  }),
                ],
              },
            },
          ];
  return {
    schemaVersion: 1 as const,
    objective:
      scenario === "PARTIAL_FAILURE"
        ? "Attempt the fixed transfer and restore the authorized safe state if the destination is blocked."
        : "Complete and independently verify the fixed Sepolia demonstration.",
    steps,
    invariants: [
      {
        id: "sepolia",
        kind: "CHAIN_ID" as const,
        severity: "CRITICAL" as const,
        parameters: {},
      },
      {
        id: "no-unknown",
        kind: "NO_UNKNOWN_ATTEMPTS" as const,
        severity: "CRITICAL" as const,
        parameters: {},
      },
      ...(scenario === "PARTIAL_FAILURE"
        ? [
            demoReadInvariant(
              "source-restored",
              contractAddress,
              "sourceBalance",
              runKey,
              "1000000",
            ),
            demoReadInvariant(
              "transit-empty",
              contractAddress,
              "inTransitBalance",
              runKey,
              "0",
            ),
            demoReadInvariant(
              "authorization-revoked",
              contractAddress,
              "destinationAuthorized",
              runKey,
              "false",
            ),
          ]
        : scenario === "HAPPY_PATH"
          ? [
              demoReadInvariant(
                "destination-funded",
                contractAddress,
                "destinationBalance",
                runKey,
                amount,
              ),
              demoReadInvariant(
                "transit-empty",
                contractAddress,
                "inTransitBalance",
                runKey,
                "0",
              ),
            ]
          : [
              demoReadInvariant(
                "destination-authorized",
                contractAddress,
                "destinationAuthorized",
                runKey,
                "true",
              ),
            ]),
    ],
    recoveryPolicy: {
      maxRecoverySpendWei: "0",
      terminalSafeStates: ["SOURCE_RESTORED"],
      onKnownFailure: "COMPENSATE" as const,
      onUnknownOutcome: "RECONCILE" as const,
      onIndeterminateOutcome: "ESCALATE" as const,
    },
    authorityPolicy: {
      autoApproveForward: true,
      autoApproveRecovery: true,
      maximumValueWei: "0",
      allowedTargets: [contractAddress],
      allowedFunctions: [
        "withdrawSource",
        "authorizeDestination",
        "depositDestination",
        "blockedDestinationDeposit",
        "revokeAuthorization",
        "restoreSource",
      ],
    },
  };
}
function demoReadInvariant(
  id: string,
  address: string,
  functionName: string,
  runKey: string,
  expected: string,
) {
  return {
    id,
    kind: "CONTRACT_READ" as const,
    severity: "CRITICAL" as const,
    parameters: {
      address,
      functionName,
      args: [runKey],
      abi: JSON.stringify(demoAbi),
      operator: "EQ",
      expected,
    },
  };
}
