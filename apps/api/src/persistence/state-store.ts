import {
  createDashboard,
  defaultMvpState,
  registerModels,
  type MvpState,
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
  getState(tenant: TenantContext): Promise<MvpState>;
  mutate(
    tenant: TenantContext,
    event: MutationEvent,
    change: (state: MvpState) => MvpState,
  ): Promise<MvpState>;
  events(
    tenant: TenantContext,
    afterSequence: number,
    limit?: number,
  ): Promise<RealtimeEnvelope[]>;
}

@Injectable()
export class MemoryStateStore implements StateStore {
  private readonly states = new Map<string, MvpState>();
  private readonly outbox: RealtimeEnvelope[] = [];
  private sequence = 0;

  private key(tenant: TenantContext) {
    return `${tenant.organizationId}:${tenant.protocolId}`;
  }

  async getState(tenant: TenantContext): Promise<MvpState> {
    return structuredClone(
      this.states.get(this.key(tenant)) ?? defaultMvpState,
    );
  }

  async mutate(
    tenant: TenantContext,
    event: MutationEvent,
    change: (state: MvpState) => MvpState,
  ): Promise<MvpState> {
    const next = change(await this.getState(tenant));
    this.states.set(this.key(tenant), structuredClone(next));
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
    return structuredClone(next);
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

  async getState(tenant: TenantContext): Promise<MvpState> {
    const document = await this.models
      .MvpState!.findOne({
        organizationId: tenant.organizationId,
        protocolId: tenant.protocolId,
      })
      .lean()
      .exec();
    if (!document) return structuredClone(defaultMvpState);
    const raw = document as unknown as MvpState;
    return {
      scenario: raw.scenario,
      lifecycleStage: raw.lifecycleStage,
      desiredState: raw.desiredState,
      setup: raw.setup,
      approval: raw.approval,
    };
  }

  async mutate(
    tenant: TenantContext,
    event: MutationEvent,
    change: (state: MvpState) => MvpState,
  ): Promise<MvpState> {
    const session = await this.connection.startSession();
    let next = defaultMvpState;
    try {
      await session.withTransaction(async () => {
        const current = await this.models
          .MvpState!.findOne({
            organizationId: tenant.organizationId,
            protocolId: tenant.protocolId,
          })
          .session(session)
          .lean()
          .exec();
        const state = current
          ? ({
              scenario: (current as Record<string, unknown>).scenario,
              lifecycleStage: (current as Record<string, unknown>)
                .lifecycleStage,
              desiredState: (current as Record<string, unknown>).desiredState,
              setup: (current as Record<string, unknown>).setup,
              approval: (current as Record<string, unknown>).approval,
            } as MvpState)
          : structuredClone(defaultMvpState);
        next = change(state);
        await this.models.MvpState!.updateOne(
          {
            organizationId: tenant.organizationId,
            protocolId: tenant.protocolId,
          },
          { $set: next },
          { upsert: true, session },
        );
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
      return next;
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
    const memory = process.env.AETHER_PERSISTENCE_MODE === "memory";
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
        MongooseModule.forRoot(
          process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/aether",
          {
            serverSelectionTimeoutMS: 5_000,
            autoIndex: process.env.NODE_ENV !== "production",
          },
        ),
      ],
      providers: [
        MongoStateStore,
        { provide: STATE_STORE, useExisting: MongoStateStore },
      ],
      exports: [STATE_STORE],
    };
  }
}

export function dashboardFromState(state: MvpState): Dashboard {
  return dashboardSchema.parse(createDashboard(state));
}
