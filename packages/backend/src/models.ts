import { Schema, type Model, type Connection } from "mongoose";

const tenantFields = {
  organizationId: { type: String, required: true, index: true },
  protocolId: { type: String, required: true, index: true },
};

function tenantSchema(
  fields: Record<string, unknown>,
  options: Record<string, unknown> = {},
) {
  const schema = new Schema(
    { ...tenantFields, ...fields },
    { timestamps: true, strict: true, ...options },
  );
  schema.index({ organizationId: 1, protocolId: 1, updatedAt: -1 });
  return schema;
}

export const modelDefinitions = [
  {
    name: "Organization",
    collection: "organizations",
    schema: new Schema(
      {
        organizationId: { type: String, required: true, unique: true },
        name: String,
      },
      { timestamps: true },
    ),
  },
  {
    name: "User",
    collection: "users",
    schema: new Schema(
      { userId: { type: String, required: true, unique: true }, email: String },
      { timestamps: true },
    ),
  },
  {
    name: "Membership",
    collection: "memberships",
    schema: new Schema(
      {
        organizationId: { type: String, required: true },
        userId: { type: String, required: true },
        role: { type: String, required: true },
      },
      { timestamps: true },
    ).index({ organizationId: 1, userId: 1 }, { unique: true }),
  },
  {
    name: "Protocol",
    collection: "protocols",
    schema: tenantSchema(
      {
        name: String,
        environment: String,
        governance: String,
        status: String,
        health: Number,
      },
      { minimize: false },
    ).index({ organizationId: 1, protocolId: 1 }, { unique: true }),
  },
  {
    name: "Network",
    collection: "networks",
    schema: tenantSchema({
      networkId: { type: String, required: true },
      chainId: Number,
      rpcMetadata: Schema.Types.Mixed,
    }).index(
      { organizationId: 1, protocolId: 1, networkId: 1 },
      { unique: true },
    ),
  },
  {
    name: "Contract",
    collection: "contracts",
    schema: tenantSchema({
      contractId: { type: String, required: true },
      address: String,
      proxyType: String,
      abiProvenance: String,
      owner: String,
    }).index(
      { organizationId: 1, protocolId: 1, contractId: 1 },
      { unique: true },
    ),
  },
  {
    name: "ProviderConnection",
    collection: "provider_connections",
    schema: tenantSchema({
      provider: { type: String, required: true },
      status: String,
      encryptedCredentials: { type: String, select: false },
      metadata: Schema.Types.Mixed,
    }).index(
      { organizationId: 1, protocolId: 1, provider: 1 },
      { unique: true },
    ),
  },
  {
    name: "DesiredStateVersion",
    collection: "desired_state_versions",
    schema: tenantSchema({
      versionId: { type: String, required: true },
      manifestVersion: String,
      manifest: Schema.Types.Mixed,
      manifestHash: String,
      active: Boolean,
      createdBy: String,
    }).index(
      { organizationId: 1, protocolId: 1, versionId: 1 },
      { unique: true },
    ),
  },
  {
    name: "Observation",
    collection: "observations",
    schema: tenantSchema({
      observationId: { type: String, required: true },
      networkId: String,
      blockNumber: Number,
      blockHash: String,
      values: Schema.Types.Mixed,
      providerCorrelationId: String,
    }).index(
      { organizationId: 1, protocolId: 1, observationId: 1 },
      { unique: true },
    ),
  },
  {
    name: "DriftFinding",
    collection: "drift_findings",
    schema: tenantSchema({
      findingId: { type: String, required: true },
      status: String,
      severity: String,
      observed: Schema.Types.Mixed,
      desired: Schema.Types.Mixed,
      evidence: Schema.Types.Mixed,
    }).index(
      { organizationId: 1, protocolId: 1, findingId: 1 },
      { unique: true },
    ),
  },
  {
    name: "Operation",
    collection: "operations",
    schema: tenantSchema({
      operationId: { type: String, required: true },
      status: String,
      activePlanVersionId: String,
      desiredStateVersionId: String,
    }).index(
      { organizationId: 1, protocolId: 1, operationId: 1 },
      { unique: true },
    ),
  },
  {
    name: "OperationPlanVersion",
    collection: "operation_plan_versions",
    schema: tenantSchema({
      planVersionId: { type: String, required: true },
      operationId: String,
      planHash: String,
      request: Schema.Types.Mixed,
      policy: Schema.Types.Mixed,
      evidenceSnapshot: Schema.Types.Mixed,
      immutable: { type: Boolean, default: true },
    }).index(
      { organizationId: 1, protocolId: 1, planHash: 1 },
      { unique: true },
    ),
  },
  {
    name: "OperationApproval",
    collection: "operation_approvals",
    schema: tenantSchema({
      approvalId: { type: String, required: true },
      operationId: String,
      planHash: String,
      simulationId: String,
      actorId: String,
      decision: String,
      expiresAt: Date,
    }).index(
      { organizationId: 1, protocolId: 1, approvalId: 1 },
      { unique: true },
    ),
  },
  {
    name: "Execution",
    collection: "executions",
    schema: tenantSchema({
      executionId: { type: String, required: true },
      operationId: String,
      status: String,
      idempotencyKey: String,
      planHash: String,
      request: Schema.Types.Mixed,
      policy: Schema.Types.Mixed,
      simulation: Schema.Types.Mixed,
      approvals: [Schema.Types.Mixed],
      providerCorrelationId: String,
      workflowId: String,
      transactionHash: String,
      retryLocked: Boolean,
    })
      .index(
        { organizationId: 1, protocolId: 1, executionId: 1 },
        { unique: true },
      )
      .index(
        { organizationId: 1, protocolId: 1, idempotencyKey: 1 },
        { unique: true, sparse: true },
      )
      .index({ providerCorrelationId: 1 }, { sparse: true }),
  },
  {
    name: "ExecutionStep",
    collection: "execution_steps",
    schema: tenantSchema({
      executionId: String,
      stepId: String,
      status: String,
      evidence: Schema.Types.Mixed,
    }).index(
      { organizationId: 1, protocolId: 1, executionId: 1, stepId: 1 },
      { unique: true },
    ),
  },
  {
    name: "AuditEvent",
    collection: "audit_events",
    schema: tenantSchema(
      {
        eventId: { type: String, required: true },
        actorId: String,
        eventType: String,
        requestId: String,
        correlationId: String,
        resourceId: String,
        result: String,
        evidence: Schema.Types.Mixed,
      },
      { timestamps: { createdAt: true, updatedAt: false } },
    ).index({ organizationId: 1, protocolId: 1, eventId: 1 }, { unique: true }),
  },
  {
    name: "OutboxEvent",
    collection: "outbox_events",
    schema: tenantSchema(
      {
        eventId: { type: String, required: true },
        sequence: { type: Number, required: true },
        type: String,
        resourceId: String,
        payload: Schema.Types.Mixed,
        queueName: String,
        publishedAt: Date,
        attempts: { type: Number, default: 0 },
      },
      { timestamps: { createdAt: true, updatedAt: false } },
    )
      .index({ eventId: 1 }, { unique: true })
      .index({ sequence: 1 }, { unique: true })
      .index({ publishedAt: 1, createdAt: 1 }),
  },
  {
    name: "IdempotencyRecord",
    collection: "idempotency_records",
    schema: tenantSchema({
      key: { type: String, required: true },
      scope: String,
      status: String,
      requestHash: String,
      response: Schema.Types.Mixed,
      providerCorrelationId: String,
      lockedReason: String,
    }).index({ organizationId: 1, protocolId: 1, key: 1 }, { unique: true }),
  },
  {
    name: "MvpState",
    collection: "mvp_state",
    schema: tenantSchema({
      scenario: String,
      lifecycleStage: Number,
      desiredState: Schema.Types.Mixed,
      setup: Schema.Types.Mixed,
      approval: Schema.Types.Mixed,
    }).index({ organizationId: 1, protocolId: 1 }, { unique: true }),
  },
] as const;

export function registerModels(
  connection: Connection,
): Record<string, Model<unknown>> {
  return Object.fromEntries(
    modelDefinitions.map(({ name, collection, schema }) => [
      name,
      connection.models[name] ?? connection.model(name, schema, collection),
    ]),
  );
}
