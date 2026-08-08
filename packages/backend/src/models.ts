import { Schema, type Connection, type Model } from "mongoose";

const mutable = { timestamps: true, strict: true, minimize: false } as const;
const appendOnly = {
  timestamps: { createdAt: true, updatedAt: false },
  strict: true,
  minimize: false,
} as const;
const ws = {
  get workspaceId() {
    return { type: String, required: true };
  },
};
const immutable = (fields: Record<string, unknown>) =>
  new Schema({ ...ws, ...fields }, appendOnly);

export const modelDefinitions = [
  {
    name: "Workspace",
    collection: "workspaces",
    schema: new Schema(
      {
        workspaceId: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        slug: { type: String, required: true, unique: true },
        status: { type: String, default: "ACTIVE" },
        defaultChainId: { type: Number, default: 11155111 },
        policyId: String,
      },
      mutable,
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
        failedLoginCount: { type: Number, default: 0 },
        lockedUntil: Date,
      },
      mutable,
    ),
  },
  {
    name: "Membership",
    collection: "workspace_memberships",
    schema: new Schema(
      {
        workspaceId: { type: String, required: true },
        userId: { type: String, required: true },
        role: {
          type: String,
          required: true,
          enum: ["OWNER", "OPERATOR", "VIEWER", "AGENT"],
        },
      },
      mutable,
    ).index({ workspaceId: 1, userId: 1 }, { unique: true }),
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
      mutable,
    ).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  },
  {
    name: "AuthChallenge",
    collection: "auth_challenges",
    schema: new Schema(
      {
        challengeId: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        purpose: { type: String, enum: ["password_reset"], required: true },
        tokenHash: { type: String, required: true, select: false },
        expiresAt: { type: Date, required: true },
        consumedAt: Date,
      },
      mutable,
    ).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  },
  {
    name: "AuthRateLimit",
    collection: "auth_rate_limits",
    schema: new Schema(
      {
        key: { type: String, required: true, unique: true },
        count: { type: Number, default: 0 },
        expiresAt: { type: Date, required: true },
      },
      mutable,
    ).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  },
  {
    name: "AuthAuditEvent",
    collection: "auth_audit_events",
    schema: new Schema(
      {
        eventId: { type: String, required: true, unique: true },
        userId: String,
        eventType: String,
        result: String,
        emailHash: String,
        ipHash: String,
        userAgentHash: String,
        evidence: Schema.Types.Mixed,
      },
      appendOnly,
    ),
  },
  {
    name: "Mission",
    collection: "missions",
    schema: new Schema(
      {
        ...ws,
        missionId: { type: String, required: true },
        name: String,
        description: String,
        activeVersionId: String,
        createdBy: String,
        archivedAt: Date,
      },
      mutable,
    )
      .index({ workspaceId: 1, missionId: 1 }, { unique: true })
      .index({ workspaceId: 1, archivedAt: 1, updatedAt: -1 }),
  },
  {
    name: "MissionVersion",
    collection: "mission_versions",
    schema: immutable({
      missionVersionId: { type: String, required: true },
      missionId: { type: String, required: true },
      versionNumber: Number,
      schemaVersion: Number,
      definition: Schema.Types.Mixed,
      hash: String,
      createdBy: String,
    })
      .index({ missionId: 1, versionNumber: 1 }, { unique: true })
      .index({ missionId: 1, hash: 1 }, { unique: true }),
  },
  {
    name: "MissionRun",
    collection: "mission_runs",
    schema: new Schema(
      {
        ...ws,
        runId: { type: String, required: true },
        missionId: String,
        missionVersionId: String,
        requestId: String,
        externalId: String,
        input: Schema.Types.Mixed,
        inputHash: String,
        state: String,
        stateReason: String,
        currentStepId: String,
        startedAt: Date,
        completedAt: Date,
        terminalAt: Date,
        recoveryStartedAt: Date,
        finalReceiptId: String,
        createdByActor: String,
        version: { type: Number, default: 0 },
        nextActionAt: Date,
        leaseOwner: String,
        leaseExpiresAt: Date,
        leaseHeartbeatAt: Date,
        fencingToken: { type: Number, default: 0 },
        transientFailureCount: Number,
        lastTransientFailureAt: Date,
      },
      mutable,
    )
      .index({ workspaceId: 1, runId: 1 }, { unique: true })
      .index({ state: 1, nextActionAt: 1 })
      .index({ leaseExpiresAt: 1 }),
  },
  {
    name: "MissionStepRun",
    collection: "mission_step_runs",
    schema: new Schema(
      {
        ...ws,
        stepRunId: { type: String, required: true },
        runId: String,
        stepId: String,
        attemptGeneration: { type: Number, default: 0 },
        state: String,
        resolvedAction: Schema.Types.Mixed,
        resolvedActionHash: String,
        planId: String,
        simulationRecordId: String,
        approvalId: String,
        executionAttemptIds: [String],
        observationIds: [String],
        startedAt: Date,
        terminalAt: Date,
        version: { type: Number, default: 0 },
      },
      mutable,
    ).index({ runId: 1, stepId: 1 }, { unique: true }),
  },
  {
    name: "OperationPlan",
    collection: "operation_plans",
    schema: immutable({
      planId: { type: String, required: true },
      runId: String,
      stepRunId: String,
      kind: String,
      operationKey: String,
      requestBody: Schema.Types.Mixed,
      requestBodyHash: String,
      expectedPostconditions: Schema.Types.Mixed,
      riskSummary: String,
      policyEvaluation: Schema.Types.Mixed,
      planHash: String,
    })
      .index({ workspaceId: 1, operationKey: 1 }, { unique: true })
      .index({ planHash: 1 }, { unique: true }),
  },
  {
    name: "SimulationRecord",
    collection: "simulation_records",
    schema: immutable({
      simulationRecordId: { type: String, required: true },
      planId: String,
      provider: String,
      requestHash: String,
      requestBody: Schema.Types.Mixed,
      response: Schema.Types.Mixed,
      success: Boolean,
      wouldRevert: Boolean,
      gasEstimate: String,
      expiresAt: Date,
    }).index({ simulationRecordId: 1 }, { unique: true }),
  },
  {
    name: "ExecutionAttempt",
    collection: "execution_attempts",
    schema: new Schema(
      {
        ...ws,
        executionAttemptId: { type: String, required: true },
        planId: String,
        runId: String,
        stepRunId: String,
        generation: Number,
        operationKey: String,
        keeperHubIdempotencyKey: String,
        requestHash: String,
        status: String,
        keeperHubExecutionId: String,
        transactionHash: String,
        providerTransactionLink: String,
        providerStatus: String,
        providerError: Schema.Types.Mixed,
        observationStartBlock: String,
        dispatchStartedAt: Date,
        acknowledgedAt: Date,
        unknownAt: Date,
        terminalAt: Date,
        resubmissionLocked: { type: Boolean, default: false },
        fencingToken: Number,
      },
      mutable,
    )
      .index({ workspaceId: 1, executionAttemptId: 1 }, { unique: true })
      .index(
        { workspaceId: 1, operationKey: 1, generation: 1 },
        { unique: true },
      )
      .index({ keeperHubIdempotencyKey: 1 }, { unique: true }),
  },
  {
    name: "Observation",
    collection: "observations",
    schema: immutable({
      observationId: { type: String, required: true },
      runId: String,
      stepRunId: String,
      chainId: Number,
      blockNumber: String,
      blockHash: String,
      providerId: String,
      kind: String,
      query: Schema.Types.Mixed,
      evidence: Schema.Types.Mixed,
      evidenceHash: String,
      confirmationCount: Number,
      canonicalityStatus: String,
    })
      .index({ observationId: 1 }, { unique: true })
      .index({ runId: 1, stepRunId: 1, createdAt: 1 }),
  },
  {
    name: "ReconciliationCase",
    collection: "reconciliation_cases",
    schema: new Schema(
      {
        ...ws,
        reconciliationCaseId: { type: String, required: true },
        executionAttemptId: { type: String, required: true },
        reason: String,
        strategy: String,
        state: String,
        resolution: String,
        evidenceIds: [String],
        decisionRationale: String,
        startedAt: Date,
        resolvedAt: Date,
      },
      mutable,
    ).index({ executionAttemptId: 1 }, { unique: true }),
  },
  {
    name: "RecoveryPlan",
    collection: "recovery_plans",
    schema: immutable({
      recoveryPlanId: { type: String, required: true },
      runId: String,
      trigger: String,
      targetSafeState: String,
      actions: Schema.Types.Mixed,
      preconditions: Schema.Types.Mixed,
      expectedPostconditions: Schema.Types.Mixed,
      estimatedRecoverySpendWei: String,
      authorityEvaluation: Schema.Types.Mixed,
      planHash: String,
      status: String,
    })
      .index({ recoveryPlanId: 1 }, { unique: true })
      .index({ runId: 1, planHash: 1 }, { unique: true }),
  },
  {
    name: "ApprovalRecord",
    collection: "approval_records",
    schema: new Schema(
      {
        ...ws,
        approvalId: { type: String, required: true },
        runId: String,
        planHash: String,
        scope: String,
        requiredRole: String,
        status: String,
        requestedAt: Date,
        expiresAt: Date,
        decidedAt: Date,
        decidedBy: String,
        decisionReason: String,
      },
      mutable,
    )
      .index({ approvalId: 1 }, { unique: true })
      .index({ workspaceId: 1, status: 1, expiresAt: 1 }),
  },
  {
    name: "Investigation",
    collection: "investigations",
    schema: new Schema(
      {
        ...ws,
        investigationId: { type: String, required: true },
        runId: String,
        trigger: String,
        model: String,
        promptVersion: String,
        evidenceIds: [String],
        evidenceHash: String,
        output: Schema.Types.Mixed,
        status: String,
        failureCode: String,
        providerStatus: Number,
        latencyMs: Number,
        tokenMetadata: Schema.Types.Mixed,
      },
      mutable,
    )
      .index({ investigationId: 1 }, { unique: true })
      .index(
        { workspaceId: 1, evidenceHash: 1 },
        { unique: true, sparse: true },
      ),
  },
  {
    name: "AuditEvent",
    collection: "audit_events",
    schema: immutable({
      eventId: { type: String, required: true },
      runId: String,
      actorType: String,
      actorId: String,
      eventType: String,
      subjectType: String,
      subjectId: String,
      metadata: Schema.Types.Mixed,
      correlationId: String,
      previousEventHash: String,
      eventHash: String,
    })
      .index({ eventId: 1 }, { unique: true })
      .index({ workspaceId: 1, createdAt: -1, _id: -1 }),
  },
  {
    name: "TimelineEvent",
    collection: "timeline_events",
    schema: immutable({
      eventId: { type: String, required: true },
      runId: { type: String, required: true },
      sequence: Number,
      type: String,
      state: String,
      message: String,
      data: Schema.Types.Mixed,
      correlationId: String,
    })
      .index({ runId: 1, sequence: 1 }, { unique: true })
      .index({ eventId: 1 }, { unique: true }),
  },
  {
    name: "MissionReceipt",
    collection: "mission_receipts",
    schema: immutable({
      receiptId: { type: String, required: true },
      runId: String,
      missionId: String,
      missionVersionId: String,
      missionVersionHash: String,
      objective: String,
      terminalState: String,
      objectiveCompleted: Boolean,
      compensationOccurred: Boolean,
      executions: Schema.Types.Mixed,
      invariantResults: Schema.Types.Mixed,
      auditChainHeadHash: String,
      receiptHash: String,
    })
      .index({ runId: 1 }, { unique: true })
      .index({ receiptHash: 1 }, { unique: true }),
  },
  {
    name: "IdempotencyRecord",
    collection: "idempotency_records",
    schema: new Schema(
      {
        ...ws,
        key: String,
        routeScope: String,
        requestHash: String,
        status: String,
        response: Schema.Types.Mixed,
      },
      mutable,
    ).index({ workspaceId: 1, key: 1, routeScope: 1 }, { unique: true }),
  },
  {
    name: "Integration",
    collection: "integrations",
    schema: new Schema(
      {
        ...ws,
        provider: String,
        encryptedCredentials: { type: String, select: false },
        credentialVersion: Number,
        status: String,
        metadata: Schema.Types.Mixed,
        lastValidatedAt: Date,
      },
      mutable,
    ).index({ workspaceId: 1, provider: 1 }, { unique: true }),
  },
  {
    name: "ApiKey",
    collection: "api_keys",
    schema: new Schema(
      {
        ...ws,
        apiKeyId: { type: String, required: true },
        name: String,
        prefix: { type: String, required: true },
        keyHash: { type: String, required: true, select: false },
        scopes: [String],
        revokedAt: Date,
        lastUsedAt: Date,
      },
      mutable,
    )
      .index({ apiKeyId: 1 }, { unique: true })
      .index({ prefix: 1 }, { unique: true }),
  },
  {
    name: "WorkspacePolicy",
    collection: "workspace_policies",
    schema: new Schema(
      {
        ...ws,
        policyId: String,
        emergencyPause: { type: Boolean, default: false },
        allowedChainIds: [Number],
        maximumWritesPerMission: Number,
        maximumValueWei: String,
        maximumRecoverySpendWei: String,
      },
      mutable,
    ).index({ workspaceId: 1 }, { unique: true }),
  },
  {
    name: "WebhookEndpoint",
    collection: "webhook_endpoints",
    schema: new Schema(
      {
        ...ws,
        webhookId: { type: String, required: true },
        url: String,
        encryptedSecret: { type: String, select: false },
        events: [String],
        disabledAt: Date,
      },
      mutable,
    ).index({ webhookId: 1 }, { unique: true }),
  },
  {
    name: "WebhookDelivery",
    collection: "webhook_deliveries",
    schema: new Schema(
      {
        ...ws,
        deliveryId: { type: String, required: true },
        webhookId: String,
        eventId: String,
        payload: Schema.Types.Mixed,
        status: String,
        attemptCount: Number,
        nextAttemptAt: Date,
        responseStatus: Number,
        error: String,
        deliveredAt: Date,
        leaseOwner: String,
        leaseExpiresAt: Date,
        fencingToken: Number,
      },
      mutable,
    )
      .index({ deliveryId: 1 }, { unique: true })
      .index({ webhookId: 1, eventId: 1 }, { unique: true })
      .index({ status: 1, nextAttemptAt: 1 }),
  },
  {
    name: "MigrationMarker",
    collection: "aether_migrations",
    schema: new Schema(
      {
        migrationId: { type: String, required: true, unique: true },
        phase: String,
        completedAt: Date,
        manifestHash: String,
      },
      mutable,
    ),
  },
  {
    name: "DemoRateLimit",
    collection: "demo_rate_limits",
    schema: new Schema(
      {
        key: { type: String, required: true, unique: true },
        count: { type: Number, required: true },
        expiresAt: { type: Date, required: true },
      },
      mutable,
    ).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  },
  {
    name: "DemoToken",
    collection: "demo_tokens",
    schema: new Schema(
      {
        tokenHash: { type: String, required: true, unique: true },
        ipHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        usedAt: Date,
      },
      mutable,
    ).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
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
