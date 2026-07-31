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
      {
        userId: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true, lowercase: true },
        passwordHash: { type: String, required: true, select: false },
        emailVerifiedAt: Date,
        failedLoginCount: { type: Number, default: 0 },
        lockedUntil: Date,
      },
      { timestamps: true },
    ),
  },
  {
    name: "RefreshSession",
    collection: "refresh_sessions",
    schema: new Schema(
      {
        sessionId: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        tokenHash: { type: String, required: true, select: false },
        familyId: { type: String, required: true, index: true },
        replacedBySessionId: String,
        expiresAt: { type: Date, required: true },
        revokedAt: Date,
        revokeReason: String,
        userAgentHash: String,
        ipHash: String,
        lastUsedAt: Date,
      },
      { timestamps: true },
    ).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  },
  {
    name: "AuthChallenge",
    collection: "auth_challenges",
    schema: new Schema(
      {
        challengeId: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        purpose: {
          type: String,
          required: true,
          enum: ["email_verification", "password_reset"],
        },
        tokenHash: { type: String, required: true, select: false },
        expiresAt: { type: Date, required: true },
        consumedAt: Date,
      },
      { timestamps: true },
    ).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  },
  {
    name: "AuthRateLimit",
    collection: "auth_rate_limits",
    schema: new Schema(
      {
        key: { type: String, required: true, unique: true },
        count: { type: Number, required: true, default: 0 },
        expiresAt: { type: Date, required: true },
      },
      { timestamps: true },
    ).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  },
  {
    name: "AuthAuditEvent",
    collection: "auth_audit_events",
    schema: new Schema(
      {
        eventId: { type: String, required: true, unique: true },
        userId: String,
        eventType: { type: String, required: true },
        result: { type: String, required: true },
        emailHash: String,
        ipHash: String,
        userAgentHash: String,
        evidence: Schema.Types.Mixed,
      },
      { timestamps: { createdAt: true, updatedAt: false } },
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
      name: String,
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
      name: String,
      address: String,
      proxyType: String,
      implementationAddress: String,
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
      mode: String,
      installationId: String,
      repository: String,
      defaultBranch: String,
      desiredStatePath: String,
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
      findingId: String,
      title: String,
      status: String,
      activePlanVersionId: String,
      desiredStateVersionId: String,
      createdBy: String,
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
      planCreatedBy: String,
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
      requestHash: String,
      observationBlockNumber: Number,
      request: Schema.Types.Mixed,
      policy: Schema.Types.Mixed,
      simulation: Schema.Types.Mixed,
      approvals: [Schema.Types.Mixed],
      providerCorrelationId: String,
      directExecutionId: String,
      transactionHash: String,
      transactionLink: String,
      gasUsedWei: String,
      providerRequestId: String,
      submittedAt: Date,
      completedAt: Date,
      retryLocked: Boolean,
      providerStepLogs: [Schema.Types.Mixed],
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
    name: "Investigation",
    collection: "investigations",
    schema: tenantSchema({
      investigationId: { type: String, required: true },
      findingId: { type: String, required: true },
      facts: [String],
      inferences: [String],
      confidence: Number,
      affectedInvariants: [String],
      recommendedAction: String,
      suggestion: Schema.Types.Mixed,
      advisoryOnly: { type: Boolean, required: true },
      providerCorrelationId: String,
    }).index(
      { organizationId: 1, protocolId: 1, investigationId: 1 },
      { unique: true },
    ),
  },
  {
    name: "WebhookDelivery",
    collection: "webhook_deliveries",
    schema: new Schema(
      {
        provider: { type: String, required: true },
        deliveryId: { type: String, required: true },
        event: String,
        receivedAt: Date,
        processedAt: Date,
      },
      { timestamps: true },
    ).index({ provider: 1, deliveryId: 1 }, { unique: true }),
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
