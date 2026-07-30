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
  durableJobSchema,
  mvpPlanHash,
  stableIdempotencyKey,
  type TenantContext,
} from "@aether/backend";
import {
  dashboardSchema,
  desiredStateSchema,
  scenarioSchema,
  type Scenario,
} from "@aether/shared";
import { z } from "zod";
import { Observable } from "rxjs";
import { Actor, Public, Roles, type AuthenticatedRequest } from "../auth/auth";
import {
  STATE_STORE,
  dashboardFromState,
  type StateStore,
} from "../persistence/state-store";

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
  type: Parameters<StateStore["mutate"]>[1]["type"],
  resourceId: string,
  result: string,
  queueName?: Parameters<StateStore["mutate"]>[1]["queueName"],
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
    return dashboardFromState(await this.store.getState(tenant));
  }
}

@ApiTags("demo")
@ApiBearerAuth()
@Controller("demo")
export class DemoController {
  constructor(@Inject(STATE_STORE) private readonly store: StateStore) {}

  @Post("scenario")
  @Roles("owner", "operator")
  async scenario(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const scenario = z
      .object({ scenario: scenarioSchema })
      .parse(body).scenario;
    const stage =
      scenario === "healthy"
        ? 6
        : scenario === "approval-execution"
          ? 3
          : scenario === "missing-role"
            ? 4
            : scenario === "partial-execution" || scenario === "unknown-outcome"
              ? 5
              : 0;
    const state = await this.store.mutate(
      tenant,
      event(request, "dashboard.updated", scenario, "scenario selected"),
      (current) => ({ ...current, scenario, lifecycleStage: stage }),
    );
    return dashboardFromState(state);
  }

  @Post("advance")
  @Roles("owner", "operator")
  async advance(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
  ) {
    const state = await this.store.mutate(
      tenant,
      event(
        request,
        "dashboard.updated",
        "op-oracle-restoration",
        "lifecycle advanced",
      ),
      (current) => ({
        ...current,
        lifecycleStage:
          current.scenario === "unauthorized-oracle"
            ? Math.min(2, current.lifecycleStage + 1)
            : Math.min(6, current.lifecycleStage + 1),
      }),
    );
    return dashboardFromState(state);
  }
}

@ApiTags("protocol setup")
@ApiBearerAuth()
@Controller("protocol-setup")
export class ProtocolSetupController {
  constructor(@Inject(STATE_STORE) private readonly store: StateStore) {}

  @Get()
  async get(@Actor() tenant: TenantContext) {
    const state = await this.store.getState(tenant);
    return {
      general: {
        name: "Arcadia Markets",
        environment: "Testnet",
        governanceAuthority: "Arcadia Security Safe · 2-of-3",
      },
      networks: dashboardFromState(state).records.networks,
      contracts: dashboardFromState(state).records.contracts,
      github: (dashboardFromState(state).records.connections ?? []).find(
        ({ id }) => id === "github",
      ),
      keeperhub: (dashboardFromState(state).records.connections ?? []).find(
        ({ id }) => id === "keeperhub",
      ),
      ...state.setup,
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
    const state = await this.store.mutate(
      tenant,
      event(request, "dashboard.updated", section, "protocol setup updated"),
      (current) => ({
        ...current,
        setup: { ...(current.setup ?? {}), [section]: input },
      }),
    );
    return { section, value: state.setup?.[section] };
  }
}

@ApiTags("desired state")
@ApiBearerAuth()
@Controller("desired-state")
export class DesiredStateController {
  constructor(@Inject(STATE_STORE) private readonly store: StateStore) {}

  @Post("validate")
  validate(@Body() body: unknown) {
    return desiredStateSchema.parse(body);
  }

  @Get("versions")
  async versions(@Actor() tenant: TenantContext) {
    const desiredState = (await this.store.getState(tenant)).desiredState;
    return desiredState
      ? [{ id: "dsv-active", active: true, manifest: desiredState }]
      : [];
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
    const state = await this.store.mutate(
      tenant,
      event(
        request,
        "dashboard.updated",
        "dsv-active",
        "desired state saved",
        undefined,
        { idempotencyKey, version: manifest.version },
      ),
      (current) => ({
        ...current,
        desiredState: manifest as unknown as Record<string, unknown>,
      }),
    );
    return {
      id: "dsv-active",
      active: true,
      idempotencyKey,
      manifest: state.desiredState,
    };
  }
}

@ApiTags("observations and drift")
@ApiBearerAuth()
@Controller()
export class ObservationController {
  constructor(@Inject(STATE_STORE) private readonly store: StateStore) {}

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
    await this.store.mutate(
      tenant,
      event(
        request,
        "dashboard.updated",
        "scan-latest",
        "observation scan queued",
        "observation.scan",
        { idempotencyKey },
      ),
      (current) => current,
    );
    return { id: "scan-latest", status: "queued", idempotencyKey };
  }

  @Get("drift")
  async drift(@Actor() tenant: TenantContext) {
    return dashboardFromState(await this.store.getState(tenant)).records.drift;
  }

  @Post("drift/:findingId/plan")
  @Roles("owner", "operator")
  async plan(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Param("findingId") findingId: string,
  ) {
    if (findingId !== "drift-oracle-001") {
      throw new BadRequestException(
        "Only the MVP oracle finding is supported.",
      );
    }
    const state = await this.store.mutate(
      tenant,
      event(
        request,
        "operation.updated",
        "op-oracle-restoration",
        "immutable plan created",
      ),
      (current) => ({ ...current, lifecycleStage: 2 }),
    );
    return dashboardFromState(state).operation;
  }
}

@ApiTags("operation")
@ApiBearerAuth()
@Controller("operations")
export class OperationController {
  constructor(@Inject(STATE_STORE) private readonly store: StateStore) {}

  @Get(":operationId")
  async get(
    @Actor() tenant: TenantContext,
    @Param("operationId") operationId: string,
  ) {
    const operation = dashboardFromState(
      await this.store.getState(tenant),
    ).operation;
    if (operation.id !== operationId)
      throw new BadRequestException("Unknown operation.");
    return operation;
  }

  @Post(":operationId/simulation")
  @Roles("owner", "operator")
  async simulate(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Param("operationId") operationId: string,
  ) {
    const state = await this.store.mutate(
      tenant,
      event(
        request,
        "operation.updated",
        operationId,
        "simulation queued",
        "operation.simulate",
      ),
      (current) => ({ ...current, lifecycleStage: 4 }),
    );
    return dashboardFromState(state).operation;
  }

  @Post(":operationId/approval")
  @Roles("owner", "reviewer")
  async approve(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Param("operationId") operationId: string,
    @Body() raw: unknown,
  ) {
    if (operationId !== "op-oracle-restoration") {
      throw new BadRequestException("Unknown operation.");
    }
    const { decision } = decisionSchema.parse(raw);
    const state = await this.store.mutate(
      tenant,
      event(request, "operation.updated", operationId, `plan ${decision}d`),
      (current) => ({
        ...current,
        scenario:
          decision === "approve"
            ? ("approval-execution" as Scenario)
            : ("unauthorized-oracle" as Scenario),
        lifecycleStage: decision === "approve" ? 3 : 2,
        approval:
          decision === "approve"
            ? {
                actorId: tenant.actorId,
                planHash: mvpPlanHash,
                simulationId: `sim-${mvpPlanHash.slice(2, 10)}`,
                decision,
                expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
              }
            : undefined,
      }),
    );
    return dashboardSchema.parse(dashboardFromState(state));
  }

  @Post(":operationId/execution")
  @Roles("owner", "operator")
  async execute(
    @Actor() tenant: TenantContext,
    @Req() request: AuthenticatedRequest,
    @Param("operationId") operationId: string,
    @Headers("idempotency-key") suppliedKey: string | undefined,
  ) {
    const current = await this.store.getState(tenant);
    if (
      current.lifecycleStage < 3 ||
      current.scenario !== "approval-execution" ||
      !current.approval ||
      current.approval.decision !== "approve" ||
      current.approval.planHash !== mvpPlanHash ||
      new Date(current.approval.expiresAt) <= new Date()
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
    const state = await this.store.mutate(
      tenant,
      event(
        request,
        "execution.updated",
        "exec-kh-8314",
        "execution queued",
        "execution.submit",
        { idempotencyKey, operationId },
      ),
      (state) => ({ ...state, lifecycleStage: 4 }),
    );
    return {
      ...dashboardFromState(state).execution,
      idempotencyKey,
      automaticRetryLocked: false,
    };
  }
}

@ApiTags("execution")
@ApiBearerAuth()
@Controller("executions")
export class ExecutionController {
  constructor(@Inject(STATE_STORE) private readonly store: StateStore) {}

  @Get(":executionId")
  async get(
    @Actor() tenant: TenantContext,
    @Param("executionId") executionId: string,
  ) {
    const execution = dashboardFromState(
      await this.store.getState(tenant),
    ).execution;
    if (execution.id !== executionId)
      throw new BadRequestException("Unknown execution.");
    return {
      ...execution,
      automaticRetryLocked: execution.status === "unknown",
      correction:
        execution.status === "partial"
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
  constructor(@Inject(STATE_STORE) private readonly store: StateStore) {}

  @Get()
  async list(@Actor() tenant: TenantContext) {
    return dashboardFromState(await this.store.getState(tenant)).records[
      "audit-log"
    ];
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
              id: envelope.id,
              type: envelope.type,
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
