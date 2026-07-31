import {
  registerModels,
  type QueueName,
  type RealtimeEnvelope,
  type TenantContext,
} from "@aether/backend";
import { dashboardSchema, type Dashboard } from "@aether/shared";
import {
  DynamicModule,
  Injectable,
  Module,
  type OnModuleInit,
} from "@nestjs/common";
import { InjectConnection, MongooseModule } from "@nestjs/mongoose";
import type { Connection, ClientSession, Model } from "mongoose";

export const STATE_STORE = Symbol("STATE_STORE");

export interface MutationEvent {
  type: RealtimeEnvelope["type"];
  resourceId: string;
  correlationId: string;
  requestId: string;
  result: string;
  payload?: Record<string, unknown>;
  queueName?: QueueName;
}

export interface StateStore {
  dashboard(tenant: TenantContext): Promise<Dashboard>;
  append(tenant: TenantContext, event: MutationEvent): Promise<void>;
  events(
    tenant: TenantContext,
    afterSequence: number,
    limit?: number,
  ): Promise<RealtimeEnvelope[]>;
}

@Injectable()
export class MemoryStateStore implements StateStore {
  private readonly outbox: RealtimeEnvelope[] = [];
  private sequence = 0;

  async dashboard(): Promise<Dashboard> {
    return dashboardSchema.parse({
      organization: null,
      protocols: [],
      records: {},
      metrics: [],
      notifications: [],
      realtime: "connected",
    });
  }

  async append(tenant: TenantContext, event: MutationEvent): Promise<void> {
    this.sequence += 1;
    this.outbox.push({
      id: `evt-${this.sequence}`,
      sequence: this.sequence,
      type: event.type,
      organizationId: tenant.organizationId,
      protocolId: tenant.protocolId,
      resourceId: event.resourceId,
      timestamp: new Date().toISOString(),
      payload: event.payload ?? {},
    });
  }

  async events(
    tenant: TenantContext,
    afterSequence: number,
    limit = 100,
  ): Promise<RealtimeEnvelope[]> {
    return this.outbox
      .filter(
        (event) =>
          event.organizationId === tenant.organizationId &&
          event.protocolId === tenant.protocolId &&
          event.sequence > afterSequence,
      )
      .slice(0, limit);
  }
}

@Injectable()
export class MongoStateStore implements StateStore, OnModuleInit {
  private models!: Record<string, Model<unknown>>;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  onModuleInit() {
    this.models = registerModels(this.connection);
  }

  async dashboard(tenant: TenantContext): Promise<Dashboard> {
    const filter = {
      organizationId: tenant.organizationId,
      protocolId: tenant.protocolId,
    };
    const [
      organization,
      protocol,
      networks,
      contracts,
      connections,
      desiredVersions,
      drift,
      operations,
      executions,
      audit,
      latestObservation,
    ] = await Promise.all([
      this.models
        .Organization!.findOne({
          organizationId: tenant.organizationId,
        })
        .lean()
        .exec(),
      this.models.Protocol!.findOne(filter).lean().exec(),
      this.models.Network!.find(filter).sort({ createdAt: -1 }).lean().exec(),
      this.models.Contract!.find(filter).sort({ createdAt: -1 }).lean().exec(),
      this.models
        .ProviderConnection!.find(filter)
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.models
        .DesiredStateVersion!.find(filter)
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.models
        .DriftFinding!.find(filter)
        .sort({ updatedAt: -1 })
        .lean()
        .exec(),
      this.models.Operation!.find(filter).sort({ updatedAt: -1 }).lean().exec(),
      this.models.Execution!.find(filter).sort({ updatedAt: -1 }).lean().exec(),
      this.models
        .AuditEvent!.find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
        .exec(),
      this.models
        .Observation!.findOne(filter)
        .sort({ blockNumber: -1 })
        .lean()
        .exec(),
    ]);
    if (!organization || !protocol) {
      return dashboardSchema.parse({
        organization: null,
        protocols: [],
        records: {},
        metrics: [],
        notifications: [],
        realtime: "connected",
      });
    }
    const org = organization as Record<string, unknown>;
    const pro = protocol as Record<string, unknown>;
    const timestamp = (value: Record<string, unknown>) =>
      new Date(
        (value.updatedAt ?? value.createdAt ?? new Date()) as string | Date,
      ).toISOString();
    const makeRecord = (
      value: Record<string, unknown>,
      id: string,
      title: string,
      subtitle: string,
      status: string,
    ) => ({
      id,
      title,
      subtitle,
      status,
      timestamp: timestamp(value),
    });
    const chainNames = networks.map((item) =>
      String((item as Record<string, unknown>).chainId ?? ""),
    );
    const openDrift = drift.filter(
      (item) => (item as Record<string, unknown>).status !== "resolved",
    );
    const latestOperation = operations[0] as
      | Record<string, unknown>
      | undefined;
    const latestExecution = executions[0] as
      | Record<string, unknown>
      | undefined;
    const [latestPlan, operationApprovals] = latestOperation
      ? await Promise.all([
          this.models
            .OperationPlanVersion!.findOne({
              ...filter,
              planVersionId: latestOperation.activePlanVersionId,
            })
            .lean()
            .exec(),
          this.models
            .OperationApproval!.find({
              ...filter,
              operationId: latestOperation.operationId,
            })
            .sort({ createdAt: -1 })
            .lean()
            .exec(),
        ])
      : [undefined, []];
    const plan = latestPlan as Record<string, unknown> | undefined;
    const request = plan?.request as Record<string, unknown> | undefined;
    const policy = plan?.policy as Record<string, unknown> | undefined;
    const executionSimulation = latestExecution?.simulation as
      | Record<string, unknown>
      | undefined;
    return dashboardSchema.parse({
      organization: {
        id: String(org.organizationId),
        name: String(org.name),
        role: tenant.role,
      },
      protocols: [
        {
          id: String(pro.protocolId),
          organizationId: String(pro.organizationId),
          name: String(pro.name),
          environment: String(pro.environment ?? "Base Sepolia"),
          health: Number(pro.health ?? 0),
          status:
            openDrift.length > 0
              ? "critical"
              : latestObservation
                ? "healthy"
                : "warning",
          release: String(pro.release ?? ""),
          repository: String(pro.repository ?? ""),
          governance: String(pro.governance ?? ""),
          chains: chainNames,
          openDrift: openDrift.length,
          lastScanAt: latestObservation
            ? timestamp(latestObservation as Record<string, unknown>)
            : timestamp(pro),
        },
      ],
      records: {
        networks: networks.map((item) => {
          const raw = item as Record<string, unknown>;
          return makeRecord(
            raw,
            String(raw.networkId),
            String(raw.name ?? `Chain ${raw.chainId ?? ""}`),
            `Chain ID ${raw.chainId ?? "unavailable"}`,
            "healthy",
          );
        }),
        contracts: contracts.map((item) => {
          const raw = item as Record<string, unknown>;
          return {
            ...makeRecord(
              raw,
              String(raw.contractId),
              String(raw.name ?? raw.contractId),
              String(raw.address ?? ""),
              raw.address ? "healthy" : "warning",
            ),
            value: raw.address ? String(raw.address) : undefined,
          };
        }),
        connections: connections.map((item) => {
          const raw = item as Record<string, unknown>;
          return makeRecord(
            raw,
            String(raw.provider),
            String(raw.provider),
            String(raw.status ?? "not configured"),
            raw.status === "healthy" ? "healthy" : "warning",
          );
        }),
        "desired-state": desiredVersions.map((item) => {
          const raw = item as Record<string, unknown>;
          return {
            ...makeRecord(
              raw,
              String(raw.versionId),
              String(raw.manifestVersion),
              String(raw.createdBy ?? "Unknown actor"),
              raw.active ? "healthy" : "resolved",
            ),
            value: raw.active ? "Active" : "Superseded",
            meta: String(raw.manifestHash ?? ""),
          };
        }),
        drift: drift.map((item) => {
          const raw = item as Record<string, unknown>;
          return {
            ...makeRecord(
              raw,
              String(raw.findingId),
              String(raw.title ?? "Desired state drift"),
              String(raw.networkId ?? "Base Sepolia"),
              String(raw.status ?? "open"),
            ),
            severity: raw.severity ?? "critical",
            value: typeof raw.observed === "string" ? raw.observed : undefined,
          };
        }),
        operations: operations.map((item) => {
          const raw = item as Record<string, unknown>;
          return makeRecord(
            raw,
            String(raw.operationId),
            String(raw.title ?? "Correction operation"),
            String(raw.activePlanVersionId ?? ""),
            String(raw.status ?? "plan_ready"),
          );
        }),
        executions: executions.map((item) => {
          const raw = item as Record<string, unknown>;
          return makeRecord(
            raw,
            String(raw.executionId),
            "KeeperHub direct execution",
            String(raw.transactionHash ?? raw.directExecutionId ?? ""),
            String(raw.status ?? "queued"),
          );
        }),
        "audit-log": audit.map((item) => {
          const raw = item as Record<string, unknown>;
          return makeRecord(
            raw,
            String(raw.eventId),
            String(raw.eventType),
            String(raw.actorId ?? "system"),
            raw.result === "failed" ? "failed" : "completed",
          );
        }),
      },
      metrics: [
        {
          label: "Open drift",
          value: String(openDrift.length),
          detail: "Persisted unresolved findings",
        },
        {
          label: "Networks",
          value: String(networks.length),
          detail: "Configured live networks",
        },
        {
          label: "Contracts",
          value: String(contracts.length),
          detail: "Validated contract resources",
        },
        {
          label: "Executions",
          value: String(executions.length),
          detail: "Durable execution intents",
        },
      ],
      operation:
        latestOperation && plan
          ? {
              id: String(latestOperation.operationId),
              title: String(latestOperation.title ?? "Restore approved oracle"),
              summary:
                "Deterministic setOracle(address) correction bound to immutable evidence.",
              planVersion: String(plan.planVersionId),
              planHash: String(plan.planHash),
              status: String(latestOperation.status ?? "plan_ready"),
              risk: "high",
              createdAt: timestamp(latestOperation),
              evidence: request
                ? [
                    `Chain ${String(request.chainId)}`,
                    `Target ${String(request.target)}`,
                    `Desired oracle ${String(request.desiredOracle)}`,
                  ]
                : [],
              inference: [],
              policyChecks: [
                makeRecord(
                  plan,
                  `policy_${String(plan.planVersionId)}`,
                  "Deterministic policy envelope",
                  String(
                    (policy?.allowedFunctions as string[] | undefined)?.[0] ??
                      "setOracle(address)",
                  ),
                  "healthy",
                ),
              ],
              simulation: makeRecord(
                latestExecution ?? plan,
                `simulation_${String(plan.planVersionId)}`,
                "KeeperHub simulation",
                executionSimulation?.success
                  ? `Passed · ${String(executionSimulation.gasEstimate ?? "")} gas`
                  : "Required before approval",
                executionSimulation?.success ? "healthy" : "queued",
              ),
              approvals: operationApprovals.map((item) => {
                const approval = item as Record<string, unknown>;
                return makeRecord(
                  approval,
                  String(approval.approvalId),
                  String(approval.decision),
                  String(approval.actorId),
                  approval.decision === "approve" ? "approved" : "rejected",
                );
              }),
              steps: [
                {
                  id: "plan",
                  label: "Immutable plan",
                  type: "check",
                  status: "completed",
                  detail: String(plan.planHash),
                },
                {
                  id: "simulation",
                  label: "KeeperHub simulation",
                  type: "simulation",
                  status: executionSimulation?.success ? "completed" : "queued",
                  detail: executionSimulation?.success
                    ? "Exact request simulation passed."
                    : "Simulation has not passed.",
                },
                {
                  id: "approval",
                  label: "Contextual approval",
                  type: "approval",
                  status: operationApprovals.some(
                    (item) =>
                      (item as Record<string, unknown>).decision === "approve",
                  )
                    ? "approved"
                    : "awaiting_approval",
                  detail: "Approval binds the immutable plan and simulation.",
                },
                {
                  id: "verification",
                  label: "Independent verification",
                  type: "verification",
                  status:
                    latestExecution?.status === "verified"
                      ? "completed"
                      : "queued",
                  detail:
                    "Receipt finality and oracleStatus are read over RPC.",
                },
              ],
            }
          : undefined,
      execution: latestExecution
        ? {
            id: String(latestExecution.executionId),
            operationId: String(latestExecution.operationId),
            directExecutionId: String(latestExecution.directExecutionId ?? ""),
            status:
              latestExecution.status === "verified"
                ? "completed"
                : latestExecution.status === "new" ||
                    latestExecution.status === "intent_persisted"
                  ? "queued"
                  : String(latestExecution.status ?? "queued"),
            network: "Base Sepolia",
            currentStep:
              latestExecution.status === "verified"
                ? "Independent verification complete"
                : "Provider reconciliation",
            startedAt: timestamp(latestExecution),
            updatedAt: timestamp(latestExecution),
            txHash: latestExecution.transactionHash
              ? String(latestExecution.transactionHash)
              : undefined,
            gasEstimate: String(executionSimulation?.gasEstimate ?? ""),
            gasUsed: latestExecution.gasUsedWei
              ? String(latestExecution.gasUsedWei)
              : undefined,
            error: latestExecution.error
              ? String(latestExecution.error)
              : undefined,
            reconciliation: latestExecution.retryLocked
              ? "Automatic resubmission is locked pending reconciliation."
              : undefined,
            steps: [
              {
                id: "intent",
                label: "Execution intent",
                type: "check",
                status: "completed",
                detail: String(latestExecution.idempotencyKey),
              },
              {
                id: "provider",
                label: "KeeperHub direct execution",
                type: "write",
                status:
                  latestExecution.status === "verified"
                    ? "completed"
                    : String(latestExecution.status ?? "queued"),
                detail: String(
                  latestExecution.directExecutionId ?? "Not submitted",
                ),
              },
              {
                id: "verify",
                label: "Independent verification",
                type: "verification",
                status:
                  latestExecution.status === "verified"
                    ? "completed"
                    : "queued",
                detail: latestExecution.transactionHash
                  ? String(latestExecution.transactionHash)
                  : "Awaiting a canonical receipt.",
              },
            ],
          }
        : undefined,
      notifications: [],
      realtime: "connected",
    });
  }

  async append(tenant: TenantContext, event: MutationEvent): Promise<void> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const sequence = await this.nextSequence(session);
        const eventId = `evt-${sequence}`;
        await this.models.AuditEvent!.create(
          [
            {
              organizationId: tenant.organizationId,
              protocolId: tenant.protocolId,
              eventId: `audit-${sequence}`,
              actorId: tenant.actorId,
              eventType: event.type,
              requestId: event.requestId,
              correlationId: event.correlationId,
              resourceId: event.resourceId,
              result: event.result,
              evidence: event.payload ?? {},
            },
          ],
          { session },
        );
        await this.models.OutboxEvent!.create(
          [
            {
              organizationId: tenant.organizationId,
              protocolId: tenant.protocolId,
              eventId,
              sequence,
              type: event.type,
              resourceId: event.resourceId,
              payload: {
                ...event.payload,
                correlationId: event.correlationId,
              },
              queueName: event.queueName,
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  private async nextSequence(session: ClientSession): Promise<number> {
    const counter = await this.connection
      .collection<{ _id: string; value: number }>("counters")
      .findOneAndUpdate(
        { _id: "outbox-sequence" },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after", session },
      );
    return Number(counter?.value ?? 1);
  }

  async events(
    tenant: TenantContext,
    afterSequence: number,
    limit = 100,
  ): Promise<RealtimeEnvelope[]> {
    const documents = await this.models
      .OutboxEvent!.find({
        organizationId: tenant.organizationId,
        protocolId: tenant.protocolId,
        sequence: { $gt: afterSequence },
      })
      .sort({ sequence: 1 })
      .limit(limit)
      .lean()
      .exec();
    return documents.map((document) => {
      const raw = document as Record<string, unknown>;
      return {
        id: String(raw.eventId),
        sequence: Number(raw.sequence),
        type: raw.type as RealtimeEnvelope["type"],
        organizationId: String(raw.organizationId),
        protocolId: String(raw.protocolId),
        resourceId: String(raw.resourceId),
        timestamp: new Date(raw.createdAt as string | Date).toISOString(),
        payload: (raw.payload ?? {}) as Record<string, unknown>,
      };
    });
  }
}

@Module({})
export class PersistenceModule {
  static register(): DynamicModule {
    const memory = process.env.NODE_ENV === "test" && !process.env.MONGODB_URI;
    if (memory) {
      return {
        module: PersistenceModule,
        providers: [
          MemoryStateStore,
          { provide: STATE_STORE, useExisting: MemoryStateStore },
        ],
        exports: [STATE_STORE],
      };
    }
    return {
      module: PersistenceModule,
      imports: [
        MongooseModule.forRoot(required("MONGODB_URI"), {
          serverSelectionTimeoutMS: 5_000,
          autoIndex: process.env.NODE_ENV !== "production",
        }),
      ],
      providers: [
        MongoStateStore,
        { provide: STATE_STORE, useExisting: MongoStateStore },
      ],
      exports: [STATE_STORE],
    };
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
