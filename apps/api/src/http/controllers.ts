import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  MessageEvent,
  Param,
  Post,
  Put,
  Query,
  Req,
  Sse,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  buildSetOracleTransactionRequest,
  durableJobSchema,
  registerModels,
  stableHash,
  stableIdempotencyKey,
  type TenantContext,
} from "@aether/backend";
import {
  desiredStateSchema,
  type Execution,
  type Operation,
} from "@aether/shared";
import { z } from "zod";
import { Observable } from "rxjs";
import { randomUUID } from "node:crypto";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection, Model } from "mongoose";
import { Actor, Public, Roles, type AuthenticatedRequest } from "../auth/auth";
import { STATE_STORE, type StateStore } from "../persistence/state-store";

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});
const setupSectionSchema = z.enum([
  "general",
  "networks",
  "contracts",
  "github",
  "keeperhub",
]);
const sensitiveSetupKey =
  /credential|private.?key|secret|seed|mnemonic|signature|token/i;

function assertBrowserSafeSetup(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertBrowserSafeSetup);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (sensitiveSetupKey.test(key)) {
      throw new BadRequestException(
        "Provider credentials are server-only and cannot be submitted here.",
      );
    }
    assertBrowserSafeSetup(nested);
  }
}

function event(
  request: AuthenticatedRequest,
  type: Parameters<StateStore["append"]>[1]["type"],
  resourceId: string,
  result: string,
  queueName?: Parameters<StateStore["append"]>[1]["queueName"],
  payload?: Record<string, unknown>,
) {
  return {
    type,
    resourceId,
    result,
    queueName,
    payload,
    requestId: request.requestId,
    correlationId: request.requestId,
  };
}

@ApiTags("system")
@Controller()
export class SystemController {
  @Public()
  @Get("health")
  health() {
    return { status: "ok", service: "aether-api" };
  }
}

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(STATE_STORE) private readonly store: StateStore) {}

  @Get()
  @ApiOperation({ summary: "Get the browser-compatible MVP aggregate" })
  async get(@Actor() tenant: TenantContext) {
    return this.store.dashboard(tenant);
  }
}

@ApiTags("protocol setup")
@ApiBearerAuth()
@Controller("protocol-setup")
export class ProtocolSetupController {
  private readonly models: Record<string, Model<unknown>>;

  constructor(
    @Inject(STATE_STORE) private readonly store: StateStore,
    @InjectConnection() connection: Connection,
  ) {
    this.models = registerModels(connection);
  }

  @Get()
  async get(@Actor() tenant: TenantContext) {
    const dashboard = await this.store.dashboard(tenant);
    const protocol = dashboard.protocols[0];
    return {
      general: {
        name: protocol?.name,
        environment: protocol?.environment,
        governanceAuthority: protocol?.governance,
      },
      networks: dashboard.records.networks ?? [],
      contracts: dashboard.records.contracts ?? [],
      github: (dashboard.records.connections ?? []).find(
        ({ id }) => id === "github",
      ),
      keeperhub: (dashboard.records.connections ?? []).find(
        ({ id }) => id === "keeperhub",
      ),
    };
  }

  @Put(":section")
  @Roles("owner", "operator")
  async update(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Param("section") rawSection: string,
    @Body() body: unknown,
  ) {
    const section = setupSectionSchema.parse(rawSection);
    const input = z.record(z.string(), z.unknown()).parse(body);
    assertBrowserSafeSetup(input);
    if (section === "general") {
      const parsed = z
        .object({
          name: z.string().trim().min(2).max(100),
          environment: z.literal("Base Sepolia"),
          governanceAuthority: z.string().trim().min(1).max(200),
        })
        .parse(input);
      await this.models.Protocol!.updateOne(
        {
          organizationId: tenant.organizationId,
          protocolId: tenant.protocolId,
        },
        {
          $set: {
            name: parsed.name,
            environment: parsed.environment,
            governance: parsed.governanceAuthority,
          },
        },
      );
      return { section, value: parsed };
    }
    if (section === "networks") {
      const parsed = z
        .object({ chainId: z.literal(84532), name: z.string().min(1) })
        .parse(input);
      await assertBaseSepoliaRpc();
      const value = {
        organizationId: tenant.organizationId,
        protocolId: tenant.protocolId,
        networkId: "base-sepolia",
        chainId: parsed.chainId,
        name: parsed.name,
        rpcMetadata: { validatedAt: new Date().toISOString() },
      };
      await this.models.Network!.updateOne(
        {
          organizationId: tenant.organizationId,
          protocolId: tenant.protocolId,
          networkId: "base-sepolia",
        },
        { $set: value },
        { upsert: true },
      );
      return { section, value };
    }
    if (section === "contracts") {
      const parsed = z
        .object({
          address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          name: z.string().trim().min(1).max(100),
        })
        .parse(input);
      const evidence = await inspectContract(parsed.address);
      const contractId = `ctr_${randomUUID()}`;
      const value = {
        organizationId: tenant.organizationId,
        protocolId: tenant.protocolId,
        contractId,
        name: parsed.name,
        address: parsed.address,
        proxyType: evidence.implementation ? "ERC1967" : "none_detected",
        implementationAddress: evidence.implementation,
        abiProvenance: "generated-foundry-artifact",
      };
      await this.models.Contract!.create(value);
      return { section, value };
    }
    throw new BadRequestException(
      `${section} connections are configured through their server-side authorization flow.`,
    );
  }

  @Post("providers/:provider/validate")
  @Roles("owner", "operator")
  async validateProvider(
    @Actor() tenant: TenantContext,
    @Param("provider") provider: string,
  ) {
    const allowed = z.enum(["keeperhub", "openai", "evm-rpc"]).parse(provider);
    const started = performance.now();
    if (allowed === "keeperhub") await validateKeeperHub();
    if (allowed === "openai") await validateOpenAi();
    if (allowed === "evm-rpc") await assertBaseSepoliaRpc();
    const status = {
      organizationId: tenant.organizationId,
      protocolId: tenant.protocolId,
      provider: allowed,
      status: "healthy",
      metadata: {
        checkedAt: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - started),
      },
    };
    await this.models.ProviderConnection!.updateOne(
      {
        organizationId: tenant.organizationId,
        protocolId: tenant.protocolId,
        provider: allowed,
      },
      { $set: status },
      { upsert: true },
    );
    return { provider: allowed, status: "healthy", ...status.metadata };
  }
}

@ApiTags("desired state")
@ApiBearerAuth()
@Controller("desired-state")
export class DesiredStateController {
  private readonly models: Record<string, Model<unknown>>;
  private readonly connection: Connection;

  constructor(@InjectConnection() connection: Connection) {
    this.connection = connection;
    this.models = registerModels(connection);
  }

  @Post("validate")
  validate(@Body() body: unknown) {
    return desiredStateSchema.parse(body);
  }

  @Get("versions")
  async versions(@Actor() tenant: TenantContext) {
    return this.models
      .DesiredStateVersion!.find({
        organizationId: tenant.organizationId,
        protocolId: tenant.protocolId,
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  @Post("versions")
  @Roles("owner", "operator")
  async save(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") suppliedKey: string | undefined,
    @Body() body: unknown,
  ) {
    const manifest = desiredStateSchema.parse(body);
    const idempotencyKey =
      suppliedKey ??
      stableIdempotencyKey(
        tenant.organizationId,
        tenant.protocolId,
        "desired-state",
        manifest.version,
      );
    const versionId = `dsv_${randomUUID()}`;
    const mongoSession = await this.connection.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        await this.models.DesiredStateVersion!.updateMany(
          {
            organizationId: tenant.organizationId,
            protocolId: tenant.protocolId,
            active: true,
          },
          { $set: { active: false } },
          { session: mongoSession },
        );
        await this.models.DesiredStateVersion!.create(
          [
            {
              organizationId: tenant.organizationId,
              protocolId: tenant.protocolId,
              versionId,
              manifestVersion: manifest.version,
              manifest,
              manifestHash: stableIdempotencyKey(JSON.stringify(manifest)),
              active: true,
              createdBy: tenant.actorId,
            },
          ],
          { session: mongoSession },
        );
        const counter = await this.connection
          .collection<{ _id: string; value: number }>("counters")
          .findOneAndUpdate(
            { _id: "outbox-sequence" },
            { $inc: { value: 1 } },
            { upsert: true, returnDocument: "after", session: mongoSession },
          );
        const sequence = Number(counter?.value ?? 1);
        await this.models.AuditEvent!.create(
          [
            {
              organizationId: tenant.organizationId,
              protocolId: tenant.protocolId,
              eventId: `audit_${randomUUID()}`,
              actorId: tenant.actorId,
              eventType: "desired_state.version_created",
              requestId: request.requestId,
              correlationId: request.requestId,
              resourceId: versionId,
              result: "completed",
              evidence: {
                manifestVersion: manifest.version,
                idempotencyKey,
              },
            },
          ],
          { session: mongoSession },
        );
        await this.models.OutboxEvent!.create(
          [
            {
              organizationId: tenant.organizationId,
              protocolId: tenant.protocolId,
              eventId: `evt_${randomUUID()}`,
              sequence,
              type: "dashboard.updated",
              resourceId: versionId,
              payload: { manifestVersion: manifest.version },
            },
          ],
          { session: mongoSession },
        );
      });
    } finally {
      await mongoSession.endSession();
    }
    return {
      id: versionId,
      active: true,
      idempotencyKey,
      manifest,
    };
  }
}

@ApiTags("observations and drift")
@ApiBearerAuth()
@Controller()
export class ObservationController {
  private readonly models: Record<string, Model<unknown>>;

  constructor(
    @Inject(STATE_STORE) private readonly store: StateStore,
    @InjectConnection() connection: Connection,
  ) {
    this.models = registerModels(connection);
  }

  @Post("observations/scans")
  @Roles("owner", "operator")
  async scan(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") suppliedKey: string | undefined,
  ) {
    const idempotencyKey =
      suppliedKey ??
      stableIdempotencyKey(
        tenant.organizationId,
        tenant.protocolId,
        "observation.scan",
      );
    durableJobSchema.parse({
      organizationId: tenant.organizationId,
      protocolId: tenant.protocolId,
      resourceId: "scan-latest",
      idempotencyKey,
      correlationId: request.requestId,
    });
    const scanId = `scan_${randomUUID()}`;
    await this.store.append(
      tenant,
      event(
        request,
        "dashboard.updated",
        scanId,
        "observation scan queued",
        "observation.scan",
        { idempotencyKey },
      ),
    );
    return { id: scanId, status: "queued", idempotencyKey };
  }

  @Get("drift")
  async drift(@Actor() tenant: TenantContext) {
    return this.models
      .DriftFinding!.find({
        organizationId: tenant.organizationId,
        protocolId: tenant.protocolId,
      })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
  }

  @Post("drift/:findingId/investigate")
  @Roles("owner", "operator")
  async investigate(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Param("findingId") findingId: string,
  ) {
    if (
      !(await this.models.DriftFinding!.exists({
        ...tenantFilter(tenant),
        findingId,
      }))
    ) {
      throw new BadRequestException("Unknown drift finding.");
    }
    const idempotencyKey = stableIdempotencyKey(
      tenant.organizationId,
      tenant.protocolId,
      findingId,
      "investigation.run",
    );
    await this.store.append(
      tenant,
      event(
        request,
        "drift.detected",
        findingId,
        "investigation queued",
        "investigation.run",
        { idempotencyKey },
      ),
    );
    return { findingId, status: "queued", idempotencyKey };
  }

  @Post("drift/:findingId/plan")
  @Roles("owner", "operator")
  async plan(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Param("findingId") findingId: string,
  ) {
    const filter = tenantFilter(tenant);
    const [finding, desiredVersion, contract] = await Promise.all([
      this.models
        .DriftFinding!.findOne({ ...filter, findingId })
        .lean()
        .exec(),
      this.models
        .DesiredStateVersion!.findOne({ ...filter, active: true })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.models
        .Contract!.findOne(filter)
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
    ]);
    if (!finding || !desiredVersion || !contract) {
      throw new BadRequestException(
        "A persisted finding, active desired state, and validated contract are required.",
      );
    }
    const desired = (desiredVersion as Record<string, unknown>).manifest as {
      oracleAddress?: string;
    };
    const target = String((contract as Record<string, unknown>).address ?? "");
    if (!desired.oracleAddress) {
      throw new BadRequestException("Desired oracle is unavailable.");
    }
    const requestBody = buildSetOracleTransactionRequest({
      chainId: 84532,
      market: target,
      desiredOracle: desired.oracleAddress,
    });
    const policy = {
      allowedChainIds: [84532],
      allowedTargets: [target],
      allowedFunctions: ["setOracle(address)"],
      maximumValueWei: "0",
      requireSimulation: true,
      requireIndependentVerification: true,
      approvalThreshold: 1,
      prohibitSelfApproval: false,
    } as const;
    const planHash = stableHash({
      request: requestBody,
      policy,
      findingId,
      desiredStateVersionId: String(
        (desiredVersion as Record<string, unknown>).versionId,
      ),
    });
    const operationId = `op_${randomUUID()}`;
    const planVersionId = `plan_${randomUUID()}`;
    await this.models.Operation!.create({
      ...filter,
      operationId,
      status: "awaiting_approval",
      activePlanVersionId: planVersionId,
      desiredStateVersionId: String(
        (desiredVersion as Record<string, unknown>).versionId,
      ),
      findingId,
      title: "Restore approved oracle",
      createdBy: tenant.actorId,
    });
    await this.models.OperationPlanVersion!.create({
      ...filter,
      planVersionId,
      operationId,
      planHash,
      request: requestBody,
      policy,
      evidenceSnapshot: {
        findingId,
        observed: (finding as Record<string, unknown>).observed,
        desired: (finding as Record<string, unknown>).desired,
      },
      immutable: true,
    });
    await this.store.append(
      tenant,
      event(
        request,
        "operation.updated",
        operationId,
        "immutable plan created",
      ),
    );
    return operationView(
      {
        ...((await this.models
          .Operation!.findOne({
            ...filter,
            operationId,
          })
          .lean()
          .exec()) as Record<string, unknown>),
      },
      {
        ...((await this.models
          .OperationPlanVersion!.findOne({
            ...filter,
            planVersionId,
          })
          .lean()
          .exec()) as Record<string, unknown>),
      },
      [],
    );
  }
}

@ApiTags("operation")
@ApiBearerAuth()
@Controller("operations")
export class OperationController {
  private readonly models: Record<string, Model<unknown>>;

  constructor(
    @Inject(STATE_STORE) private readonly store: StateStore,
    @InjectConnection() connection: Connection,
  ) {
    this.models = registerModels(connection);
  }

  @Get(":operationId")
  async get(
    @Actor() tenant: TenantContext,
    @Param("operationId") operationId: string,
  ) {
    const filter = { ...tenantFilter(tenant), operationId };
    const operation = await this.models
      .Operation!.findOne(filter)
      .lean()
      .exec();
    if (!operation) throw new BadRequestException("Unknown operation.");
    const raw = operation as Record<string, unknown>;
    const [plan, approvals] = await Promise.all([
      this.models
        .OperationPlanVersion!.findOne({
          ...tenantFilter(tenant),
          planVersionId: raw.activePlanVersionId,
        })
        .lean()
        .exec(),
      this.models.OperationApproval!.find(filter).lean().exec(),
    ]);
    if (!plan) throw new BadRequestException("Operation plan is unavailable.");
    return operationView(
      raw,
      plan as Record<string, unknown>,
      approvals as Record<string, unknown>[],
    );
  }

  @Post(":operationId/simulation")
  @Roles("owner", "operator")
  async simulate(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Param("operationId") operationId: string,
    @Headers("idempotency-key") suppliedKey: string | undefined,
  ) {
    const filter = { ...tenantFilter(tenant), operationId };
    const operation = await this.models
      .Operation!.findOne(filter)
      .lean()
      .exec();
    if (!operation) throw new BadRequestException("Unknown operation.");
    const op = operation as Record<string, unknown>;
    const plan = await this.models
      .OperationPlanVersion!.findOne({
        ...tenantFilter(tenant),
        planVersionId: op.activePlanVersionId,
      })
      .lean()
      .exec();
    if (!plan) throw new BadRequestException("Operation plan is unavailable.");
    const planRaw = plan as Record<string, unknown>;
    const idempotencyKey =
      suppliedKey ??
      stableIdempotencyKey(
        tenant.organizationId,
        tenant.protocolId,
        operationId,
        String(planRaw.planHash),
        "simulation",
      );
    let execution = await this.models
      .Execution!.findOne({
        ...filter,
        idempotencyKey,
      })
      .lean()
      .exec();
    if (!execution) {
      const executionId = `exec_${randomUUID()}`;
      execution = (
        await this.models.Execution!.create({
          ...tenantFilter(tenant),
          executionId,
          operationId,
          status: "new",
          idempotencyKey,
          planHash: planRaw.planHash,
          planCreatedBy: op.createdBy,
          requestHash: stableHash(planRaw.request),
          request: planRaw.request,
          policy: planRaw.policy,
          approvals: [],
          observationBlockNumber: Number(
            (planRaw.evidenceSnapshot as Record<string, unknown> | undefined)
              ?.blockNumber ?? 1,
          ),
          retryLocked: false,
        })
      ).toObject();
    }
    const executionRaw = execution as Record<string, unknown>;
    await this.store.append(
      tenant,
      event(
        request,
        "operation.updated",
        String(executionRaw.executionId),
        "simulation queued",
        "operation.simulate",
        { idempotencyKey },
      ),
    );
    return {
      status: "queued",
      executionId: executionRaw.executionId,
      idempotencyKey,
    };
  }

  @Post(":operationId/approval")
  @Roles("owner", "reviewer")
  async approve(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Param("operationId") operationId: string,
    @Body() raw: unknown,
  ) {
    const { decision } = decisionSchema.parse(raw);
    const operation = await this.models
      .Operation!.findOne({
        ...tenantFilter(tenant),
        operationId,
      })
      .lean()
      .exec();
    if (!operation) throw new BadRequestException("Unknown operation.");
    const op = operation as Record<string, unknown>;
    const plan = await this.models
      .OperationPlanVersion!.findOne({
        ...tenantFilter(tenant),
        planVersionId: op.activePlanVersionId,
      })
      .lean()
      .exec();
    if (!plan) throw new BadRequestException("Operation plan is unavailable.");
    const planHash = String((plan as Record<string, unknown>).planHash);
    const execution = await this.models
      .Execution!.findOne({
        ...tenantFilter(tenant),
        operationId,
        planHash,
        "simulation.success": true,
      })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    if (decision === "approve" && !execution) {
      throw new BadRequestException(
        "A successful exact-request KeeperHub simulation is required before approval.",
      );
    }
    const simulationId = execution
      ? String(
          (
            (execution as Record<string, unknown>).simulation as Record<
              string,
              unknown
            >
          ).simulationId,
        )
      : undefined;
    const approvalId = `apr_${randomUUID()}`;
    await this.models.OperationApproval!.create({
      ...tenantFilter(tenant),
      approvalId,
      operationId,
      planHash,
      simulationId,
      actorId: tenant.actorId,
      decision,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    await this.models.Operation!.updateOne(
      { ...tenantFilter(tenant), operationId },
      { $set: { status: decision === "approve" ? "approved" : "rejected" } },
    );
    await this.store.append(
      tenant,
      event(request, "operation.updated", operationId, `plan ${decision}d`),
    );
    return this.get(tenant, operationId);
  }

  @Post(":operationId/execution")
  @Roles("owner", "operator")
  async execute(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Param("operationId") operationId: string,
    @Headers("idempotency-key") suppliedKey: string | undefined,
  ) {
    const filter = { ...tenantFilter(tenant), operationId };
    const operation = await this.models
      .Operation!.findOne(filter)
      .lean()
      .exec();
    if (!operation) throw new BadRequestException("Unknown operation.");
    const op = operation as Record<string, unknown>;
    const plan = await this.models
      .OperationPlanVersion!.findOne({
        ...tenantFilter(tenant),
        planVersionId: op.activePlanVersionId,
      })
      .lean()
      .exec();
    if (!plan) throw new BadRequestException("Operation plan is unavailable.");
    const planRaw = plan as Record<string, unknown>;
    const execution = await this.models
      .Execution!.findOne({
        ...filter,
        planHash: planRaw.planHash,
        "simulation.success": true,
      })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    if (!execution) {
      throw new BadRequestException(
        "A successful exact-request simulation is required before execution.",
      );
    }
    const executionRaw = execution as Record<string, unknown>;
    const simulationId = String(
      (executionRaw.simulation as Record<string, unknown>).simulationId,
    );
    const approvals = await this.models
      .OperationApproval!.find({
        ...filter,
        planHash: planRaw.planHash,
        simulationId,
        decision: "approve",
        expiresAt: { $gt: new Date() },
      })
      .lean()
      .exec();
    const threshold = Number(
      (planRaw.policy as Record<string, unknown>).approvalThreshold ?? 1,
    );
    if (
      new Set(
        approvals.map((item) =>
          String((item as Record<string, unknown>).actorId),
        ),
      ).size < threshold
    ) {
      throw new BadRequestException(
        "An unexpired contextual approval is required before execution.",
      );
    }
    const idempotencyKey =
      suppliedKey ??
      stableIdempotencyKey(
        tenant.organizationId,
        tenant.protocolId,
        operationId,
        "execution.submit",
      );
    const executionId = String(executionRaw.executionId);
    await this.models.Execution!.updateOne(
      { ...tenantFilter(tenant), executionId },
      {
        $set: {
          idempotencyKey,
          approvals: approvals.map((item) => {
            const approval = item as Record<string, unknown>;
            return {
              actorId: approval.actorId,
              planHash: approval.planHash,
              simulationId: approval.simulationId,
              decision: approval.decision,
              expiresAt: new Date(approval.expiresAt as Date).toISOString(),
            };
          }),
        },
      },
    );
    await this.store.append(
      tenant,
      event(
        request,
        "execution.updated",
        executionId,
        "execution queued",
        "execution.submit",
        { idempotencyKey, operationId },
      ),
    );
    return {
      id: executionId,
      operationId,
      status: "simulating",
      idempotencyKey,
      automaticRetryLocked: false,
    };
  }
}

@ApiTags("execution")
@ApiBearerAuth()
@Controller("executions")
export class ExecutionController {
  private readonly models: Record<string, Model<unknown>>;

  constructor(@InjectConnection() connection: Connection) {
    this.models = registerModels(connection);
  }

  @Get(":executionId")
  async get(
    @Actor() tenant: TenantContext,
    @Param("executionId") executionId: string,
  ) {
    const execution = await this.models
      .Execution!.findOne({
        ...tenantFilter(tenant),
        executionId,
      })
      .lean()
      .exec();
    if (!execution) throw new BadRequestException("Unknown execution.");
    const view = executionView(execution as Record<string, unknown>);
    return {
      ...view,
      automaticRetryLocked: Boolean(
        (execution as Record<string, unknown>).retryLocked,
      ),
      correction:
        view.status === "partial"
          ? {
              type: "forward-correction",
              rollbackAvailable: false,
            }
          : undefined,
    };
  }
}

@ApiTags("audit")
@ApiBearerAuth()
@Controller("audit-events")
export class AuditController {
  private readonly models: Record<string, Model<unknown>>;

  constructor(@InjectConnection() connection: Connection) {
    this.models = registerModels(connection);
  }

  @Get()
  async list(@Actor() tenant: TenantContext) {
    return this.models
      .AuditEvent!.find(tenantFilter(tenant))
      .sort({ createdAt: -1 })
      .limit(250)
      .lean()
      .exec();
  }
}

@ApiTags("realtime")
@ApiBearerAuth()
@Controller("events")
export class RealtimeController {
  constructor(@Inject(STATE_STORE) private readonly store: StateStore) {}

  @Sse()
  stream(
    @Actor() tenant: TenantContext,
    @Headers("last-event-id") lastEventId: string | undefined,
    @Query("after") after: string | undefined,
  ): Observable<MessageEvent> {
    let cursor = Number(after ?? lastEventId?.replace(/^evt-/, "") ?? 0);
    if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;
    return new Observable<MessageEvent>((subscriber) => {
      let busy = false;
      const poll = async () => {
        if (busy) return;
        busy = true;
        try {
          const events = await this.store.events(tenant, cursor);
          for (const envelope of events) {
            cursor = envelope.sequence;
            subscriber.next({
              id: `evt-${envelope.sequence}`,
              data: envelope,
              retry: 2_000,
            });
          }
        } catch (error) {
          subscriber.error(error);
        } finally {
          busy = false;
        }
      };
      void poll();
      const timer = setInterval(() => void poll(), 1_000);
      return () => clearInterval(timer);
    });
  }
}

async function assertBaseSepoliaRpc(): Promise<void> {
  const chainId = await rpc("eth_chainId", []);
  if (Number.parseInt(String(chainId), 16) !== 84532) {
    throw new BadRequestException(
      "Configured RPC must report Base Sepolia chain ID 84532.",
    );
  }
}

async function inspectContract(address: string): Promise<{
  implementation?: string;
}> {
  await assertBaseSepoliaRpc();
  const code = String(await rpc("eth_getCode", [address, "latest"]));
  if (!/^0x[a-fA-F0-9]+$/.test(code) || code === "0x") {
    throw new BadRequestException(
      "No contract bytecode exists at this address.",
    );
  }
  const slot =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const storage = String(
    await rpc("eth_getStorageAt", [address, slot, "latest"]),
  );
  const implementation = `0x${storage.slice(-40)}`;
  return /^0x0{40}$/i.test(implementation) ? {} : { implementation };
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const url = process.env.AETHER_RPC_URL;
  if (!url) {
    throw new BadRequestException("RPC provider is not configured.");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new BadRequestException("RPC provider is unavailable.");
  }
  const envelope = z
    .object({
      result: z.unknown().optional(),
      error: z.unknown().optional(),
    })
    .parse(await response.json());
  if (envelope.error || envelope.result === undefined) {
    throw new BadRequestException(`RPC ${method} failed.`);
  }
  return envelope.result;
}

async function validateKeeperHub() {
  const key = process.env.KEEPERHUB_API_KEY;
  if (!key?.startsWith("kh_")) {
    throw new BadRequestException("KeeperHub is not configured.");
  }
  const base = (
    process.env.KEEPERHUB_BASE_URL ?? "https://app.keeperhub.com/api"
  ).replace(/\/$/, "");
  const headers = { authorization: `Bearer ${key}` };
  const [chainsResponse, walletResponse] = await Promise.all([
    fetch(`${base}/chains`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(`${base}/user/wallet`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    }),
  ]);
  if (!chainsResponse.ok || !walletResponse.ok) {
    throw new BadRequestException("KeeperHub is unavailable or unauthorized.");
  }
  const chainsRaw = await chainsResponse.json();
  const walletRaw = await walletResponse.json();
  const unwrap = (value: unknown) =>
    z.object({ data: z.unknown() }).safeParse(value).success
      ? (value as { data: unknown }).data
      : value;
  const chains = z
    .array(
      z.object({
        chainId: z.number(),
        isEnabled: z.boolean(),
        isTestnet: z.boolean(),
      }),
    )
    .parse(unwrap(chainsRaw));
  const wallet = z
    .object({
      hasWallet: z.boolean(),
      walletAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .optional(),
    })
    .parse(unwrap(walletRaw));
  if (
    !chains.some(
      (chain) => chain.chainId === 84532 && chain.isEnabled && chain.isTestnet,
    ) ||
    !wallet.hasWallet ||
    !wallet.walletAddress
  ) {
    throw new BadRequestException(
      "KeeperHub Base Sepolia or organization wallet is not ready.",
    );
  }
  if (
    process.env.AETHER_EXECUTOR_ADDRESS &&
    process.env.AETHER_EXECUTOR_ADDRESS.toLowerCase() !==
      wallet.walletAddress.toLowerCase()
  ) {
    throw new BadRequestException(
      "KeeperHub wallet does not match the configured executor.",
    );
  }
}

async function validateOpenAi() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new BadRequestException("OpenAI is not configured.");
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new BadRequestException("OpenAI is unavailable or unauthorized.");
  }
}

function tenantFilter(tenant: TenantContext) {
  return {
    organizationId: tenant.organizationId,
    protocolId: tenant.protocolId,
  };
}

function iso(value: unknown): string {
  return new Date(
    (value as string | Date | undefined) ?? Date.now(),
  ).toISOString();
}

function operationView(
  operation: Record<string, unknown>,
  plan: Record<string, unknown>,
  approvals: Record<string, unknown>[],
): Operation {
  const createdAt = iso(operation.createdAt);
  const request = plan.request as Record<string, unknown>;
  const policy = plan.policy as Record<string, unknown>;
  return {
    id: String(operation.operationId),
    title: String(operation.title ?? "Restore approved oracle"),
    summary:
      "Deterministic setOracle(address) correction bound to immutable evidence.",
    planVersion: String(plan.planVersionId),
    planHash: String(plan.planHash),
    status: (operation.status as Operation["status"]) ?? "plan_ready",
    risk: "high",
    createdAt,
    evidence: [
      `Chain ${String(request.chainId)}`,
      `Target ${String(request.target)}`,
      `Desired oracle ${String(request.desiredOracle)}`,
    ],
    inference: [],
    policyChecks: [
      {
        id: `policy_${String(plan.planVersionId)}`,
        title: "Deterministic policy envelope",
        subtitle: `${String((policy.allowedFunctions as string[] | undefined)?.[0] ?? "setOracle(address)")} · zero value`,
        status: "healthy",
        timestamp: createdAt,
      },
    ],
    simulation: {
      id: `simulation_${String(plan.planVersionId)}`,
      title: "KeeperHub simulation",
      subtitle: "Required before provider submission",
      status: operation.status === "approved" ? "queued" : "warning",
      timestamp: createdAt,
    },
    approvals: approvals.map((approval) => ({
      id: String(approval.approvalId),
      title: String(approval.decision),
      subtitle: String(approval.actorId),
      status: approval.decision === "approve" ? "approved" : "rejected",
      timestamp: iso(approval.createdAt),
    })),
    steps: [
      {
        id: "plan",
        label: "Immutable plan",
        type: "check",
        status: "completed",
        detail: String(plan.planHash),
      },
      {
        id: "approval",
        label: "Contextual approval",
        type: "approval",
        status: approvals.some((item) => item.decision === "approve")
          ? "approved"
          : "awaiting_approval",
        detail: "Approval is bound to this plan hash and expires.",
      },
      {
        id: "simulation",
        label: "KeeperHub simulation",
        type: "simulation",
        status: "queued",
        detail:
          "The exact direct-execution request is simulated before submit.",
      },
      {
        id: "verification",
        label: "Independent RPC verification",
        type: "verification",
        status: "queued",
        detail: "Aether verifies finality and oracleStatus independently.",
      },
    ],
  };
}

function executionView(raw: Record<string, unknown>): Execution {
  const status = (
    raw.status === "verified"
      ? "completed"
      : raw.status === "new" || raw.status === "intent_persisted"
        ? "queued"
        : raw.status
  ) as Execution["status"];
  const startedAt = iso(raw.createdAt);
  const updatedAt = iso(raw.updatedAt);
  return {
    id: String(raw.executionId),
    operationId: String(raw.operationId),
    directExecutionId: String(raw.directExecutionId ?? ""),
    status,
    network: "Base Sepolia",
    currentStep:
      status === "completed"
        ? "Independent verification complete"
        : status === "partial"
          ? "Forward correction required"
          : "Provider reconciliation",
    startedAt,
    updatedAt,
    txHash: raw.transactionHash ? String(raw.transactionHash) : undefined,
    gasEstimate: String(
      (raw.simulation as Record<string, unknown> | undefined)?.gasEstimate ??
        "",
    ),
    gasUsed: raw.gasUsedWei ? String(raw.gasUsedWei) : undefined,
    error: raw.error ? String(raw.error) : undefined,
    reconciliation: raw.retryLocked
      ? "Automatic resubmission is locked pending reconciliation."
      : undefined,
    steps: [
      {
        id: "intent",
        label: "Execution intent",
        type: "check",
        status: "completed",
        detail: String(raw.idempotencyKey),
      },
      {
        id: "provider",
        label: "KeeperHub direct execution",
        type: "write",
        status,
        detail: String(raw.directExecutionId ?? "Not submitted"),
      },
      {
        id: "verify",
        label: "Independent verification",
        type: "verification",
        status: status === "completed" ? "completed" : "queued",
        detail: raw.transactionHash
          ? String(raw.transactionHash)
          : "Awaiting a canonical transaction receipt.",
      },
    ],
  };
}
