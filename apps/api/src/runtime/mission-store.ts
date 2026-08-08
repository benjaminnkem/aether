import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { randomBytes, randomUUID } from "node:crypto";
import type { ClientSession, Connection } from "mongoose";
import * as argon2 from "argon2";
import {
  assertMissionTransition,
  assertStepTransition,
  contentHash,
  operationKey,
  planHash,
  registerModels,
  type TenantContext,
} from "@aether/backend";
import {
  activeLiveChain,
  createMissionSchema,
  createRunSchema,
  missionDefinitionSchema,
  missionStateSchema,
  stepStateSchema,
  TERMINAL_MISSION_STATES,
  type MissionAction,
  type MissionDefinition,
  type MissionState,
  type StepState,
} from "@aether/shared";

type Document = Record<string, unknown>;

@Injectable()
export class MissionStore {
  private readonly instanceId = `api_${process.pid}_${randomUUID()}`;
  constructor(@InjectConnection() readonly connection: Connection) {
    registerModels(connection);
  }
  get runnerId() {
    return this.instanceId;
  }

  async createMission(tenant: TenantContext, raw: unknown, key: string) {
    const input = createMissionSchema.parse(raw);
    const requestHash = contentHash(input);
    const routeScope = "missions.create";
    const replay = await this.idempotentReplay(
      tenant.workspaceId,
      key,
      routeScope,
      requestHash,
    );
    if (replay) return replay;
    const missionId = `mis_${randomUUID()}`;
    const missionVersionId = `mv_${randomUUID()}`;
    const hash = contentHash(input.definition);
    const now = new Date();
    const response = {
      missionId,
      missionVersionId,
      versionNumber: 1,
      hash,
      name: input.name,
      description: input.description,
      state: "READY" as const,
    };
    await this.transaction(async (session) => {
      await this.connection.collection("missions").insertOne(
        {
          workspaceId: tenant.workspaceId,
          missionId,
          name: input.name,
          description: input.description,
          activeVersionId: missionVersionId,
          createdBy: tenant.actorId,
          createdAt: now,
          updatedAt: now,
        },
        { session },
      );
      await this.connection.collection("mission_versions").insertOne(
        {
          workspaceId: tenant.workspaceId,
          missionVersionId,
          missionId,
          versionNumber: 1,
          schemaVersion: 1,
          definition: input.definition,
          hash,
          createdBy: tenant.actorId,
          createdAt: now,
        },
        { session },
      );
      await this.audit(
        tenant,
        {
          eventType: "mission.created",
          subjectType: "MISSION",
          subjectId: missionId,
          metadata: { missionVersionId, hash },
          correlationId: key,
        },
        session,
      );
      await this.saveIdempotency(
        tenant.workspaceId,
        key,
        routeScope,
        requestHash,
        response,
        session,
      );
    });
    return response;
  }

  async listMissions(tenant: TenantContext, cursor?: string, limit = 25) {
    const bounded = Math.min(Math.max(limit, 1), 100);
    const filter: Document = {
      workspaceId: tenant.workspaceId,
      archivedAt: { $exists: false },
    };
    if (cursor) filter._id = { $lt: this.objectId(cursor) };
    const items = await this.connection
      .collection("missions")
      .find(filter)
      .sort({ _id: -1 })
      .limit(bounded + 1)
      .toArray();
    const more = items.length > bounded;
    if (more) items.pop();
    return {
      items: items.map(clean),
      nextCursor: more ? String(items.at(-1)?._id) : undefined,
    };
  }
  async getMission(tenant: TenantContext, missionId: string) {
    const mission = await this.connection
      .collection("missions")
      .findOne({ workspaceId: tenant.workspaceId, missionId });
    if (!mission) throw new NotFoundException("Mission not found.");
    const [versions, runs] = await Promise.all([
      this.connection
        .collection("mission_versions")
        .find({ workspaceId: tenant.workspaceId, missionId })
        .sort({ versionNumber: -1 })
        .toArray(),
      this.connection
        .collection("mission_runs")
        .find({ workspaceId: tenant.workspaceId, missionId })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray(),
    ]);
    return {
      ...clean(mission),
      versions: versions.map(clean),
      runs: runs.map(clean),
    };
  }
  async createVersion(
    tenant: TenantContext,
    missionId: string,
    raw: unknown,
    key: string,
  ) {
    const definition = missionDefinitionSchema.parse(raw);
    const requestHash = contentHash(definition);
    const routeScope = `missions.${missionId}.versions`;
    const replay = await this.idempotentReplay(
      tenant.workspaceId,
      key,
      routeScope,
      requestHash,
    );
    if (replay) return replay;
    const mission = await this.connection.collection("missions").findOne({
      workspaceId: tenant.workspaceId,
      missionId,
      archivedAt: { $exists: false },
    });
    if (!mission) throw new NotFoundException("Mission not found.");
    const latest = await this.connection
      .collection("mission_versions")
      .findOne(
        { workspaceId: tenant.workspaceId, missionId },
        { sort: { versionNumber: -1 } },
      );
    const versionNumber = Number(latest?.versionNumber ?? 0) + 1;
    const missionVersionId = `mv_${randomUUID()}`;
    const hash = contentHash(definition);
    const response = { missionId, missionVersionId, versionNumber, hash };
    await this.transaction(async (session) => {
      await this.connection.collection("mission_versions").insertOne(
        {
          workspaceId: tenant.workspaceId,
          missionVersionId,
          missionId,
          versionNumber,
          schemaVersion: 1,
          definition,
          hash,
          createdBy: tenant.actorId,
          createdAt: new Date(),
        },
        { session },
      );
      await this.connection.collection("missions").updateOne(
        { workspaceId: tenant.workspaceId, missionId },
        {
          $set: { activeVersionId: missionVersionId, updatedAt: new Date() },
        },
        { session },
      );
      await this.audit(
        tenant,
        {
          eventType: "mission.version_created",
          subjectType: "MISSION_VERSION",
          subjectId: missionVersionId,
          metadata: { missionId, versionNumber, hash },
          correlationId: key,
        },
        session,
      );
      await this.saveIdempotency(
        tenant.workspaceId,
        key,
        routeScope,
        requestHash,
        response,
        session,
      );
    });
    return response;
  }
  async archiveMission(tenant: TenantContext, missionId: string, key: string) {
    const requestHash = contentHash({ missionId });
    const routeScope = `missions.${missionId}.archive`;
    const replay = await this.idempotentReplay(
      tenant.workspaceId,
      key,
      routeScope,
      requestHash,
    );
    if (replay) return replay;
    const response = { missionId, archived: true };
    await this.transaction(async (session) => {
      const result = await this.connection.collection("missions").updateOne(
        {
          workspaceId: tenant.workspaceId,
          missionId,
          archivedAt: { $exists: false },
        },
        { $set: { archivedAt: new Date(), updatedAt: new Date() } },
        { session },
      );
      if (!result.matchedCount)
        throw new NotFoundException("Mission not found.");
      await this.audit(
        tenant,
        {
          eventType: "mission.archived",
          subjectType: "MISSION",
          subjectId: missionId,
          metadata: {},
          correlationId: key,
        },
        session,
      );
      await this.saveIdempotency(
        tenant.workspaceId,
        key,
        routeScope,
        requestHash,
        response,
        session,
      );
    });
    return response;
  }

  async createRun(
    tenant: TenantContext,
    missionId: string,
    raw: unknown,
    key: string,
  ) {
    const input = createRunSchema.parse(raw);
    const requestHash = contentHash(input);
    const routeScope = `missions.${missionId}.runs`;
    const replay = await this.idempotentReplay(
      tenant.workspaceId,
      key,
      routeScope,
      requestHash,
    );
    if (replay) return replay;
    const mission = await this.connection.collection("missions").findOne({
      workspaceId: tenant.workspaceId,
      missionId,
      archivedAt: { $exists: false },
    });
    if (!mission) throw new NotFoundException("Mission not found.");
    const version = await this.connection
      .collection("mission_versions")
      .findOne({
        workspaceId: tenant.workspaceId,
        missionVersionId: mission.activeVersionId,
      });
    if (!version)
      throw new ConflictException("Active mission version is unavailable.");
    const definition = missionDefinitionSchema.parse(version.definition);
    const runId = `run_${randomUUID()}`;
    const now = new Date();
    const response = {
      runId,
      missionId,
      missionVersionId: version.missionVersionId,
      state: "PREFLIGHT",
      streamUrl: `/v1/runs/${runId}/stream`,
    };
    await this.transaction(async (session) => {
      await this.connection.collection("mission_runs").insertOne(
        {
          workspaceId: tenant.workspaceId,
          runId,
          missionId,
          missionVersionId: version.missionVersionId,
          requestId: key,
          externalId: input.externalId,
          input: input.input,
          inputHash: contentHash(input.input),
          state: "PREFLIGHT",
          stateReason: "Run accepted for preflight.",
          startedAt: now,
          createdByActor: tenant.actorId,
          version: 0,
          nextActionAt: now,
          fencingToken: 0,
          createdAt: now,
          updatedAt: now,
        },
        { session },
      );
      await this.connection.collection("mission_step_runs").insertMany(
        definition.steps.map((step) => ({
          workspaceId: tenant.workspaceId,
          stepRunId: `sr_${randomUUID()}`,
          runId,
          stepId: step.id,
          attemptGeneration: 0,
          state: "PENDING",
          executionAttemptIds: [],
          observationIds: [],
          version: 0,
          createdAt: now,
          updatedAt: now,
        })),
        { session },
      );
      await this.timeline(
        tenant.workspaceId,
        runId,
        "run.created",
        "PREFLIGHT",
        "Run created. Preflight is starting.",
        { missionId },
        key,
        session,
      );
      await this.audit(
        tenant,
        {
          eventType: "mission.run_created",
          subjectType: "MISSION_RUN",
          subjectId: runId,
          metadata: { missionId, missionVersionId: version.missionVersionId },
          correlationId: key,
        },
        session,
      );
      await this.saveIdempotency(
        tenant.workspaceId,
        key,
        routeScope,
        requestHash,
        response,
        session,
      );
    });
    return response;
  }
  async getRun(tenant: TenantContext, runId: string) {
    const run = await this.connection
      .collection("mission_runs")
      .findOne({ workspaceId: tenant.workspaceId, runId });
    if (!run) throw new NotFoundException("Run not found.");
    const attemptIds = (
      await this.connection
        .collection("execution_attempts")
        .find({ workspaceId: tenant.workspaceId, runId })
        .project({ executionAttemptId: 1 })
        .toArray()
    ).map((item) => item.executionAttemptId);
    const [
      version,
      steps,
      plans,
      simulations,
      attempts,
      observations,
      reconciliation,
      recovery,
      investigation,
      receipt,
    ] = await Promise.all([
      this.connection.collection("mission_versions").findOne({
        workspaceId: tenant.workspaceId,
        missionVersionId: run.missionVersionId,
      }),
      this.connection
        .collection("mission_step_runs")
        .find({ workspaceId: tenant.workspaceId, runId })
        .sort({ createdAt: 1 })
        .toArray(),
      this.connection
        .collection("operation_plans")
        .find({ workspaceId: tenant.workspaceId, runId })
        .sort({ createdAt: 1 })
        .toArray(),
      this.connection
        .collection("simulation_records")
        .find({ workspaceId: tenant.workspaceId, runId })
        .sort({ createdAt: 1 })
        .toArray(),
      this.connection
        .collection("execution_attempts")
        .find({ workspaceId: tenant.workspaceId, runId })
        .sort({ createdAt: 1 })
        .toArray(),
      this.connection
        .collection("observations")
        .find({ workspaceId: tenant.workspaceId, runId })
        .sort({ createdAt: 1 })
        .toArray(),
      this.connection
        .collection("reconciliation_cases")
        .find({
          workspaceId: tenant.workspaceId,
          executionAttemptId: { $in: attemptIds },
        })
        .toArray(),
      this.connection
        .collection("recovery_plans")
        .findOne(
          { workspaceId: tenant.workspaceId, runId },
          { sort: { createdAt: -1 } },
        ),
      this.connection
        .collection("investigations")
        .findOne(
          { workspaceId: tenant.workspaceId, runId },
          { sort: { createdAt: -1 } },
        ),
      this.connection
        .collection("mission_receipts")
        .findOne({ workspaceId: tenant.workspaceId, runId }),
    ]);
    return {
      ...clean(run),
      objective:
        typeof version?.definition === "object" &&
        version.definition &&
        "objective" in version.definition
          ? version.definition.objective
          : undefined,
      steps: steps.map(clean),
      plans: plans.map(clean),
      simulations: simulations.map(clean),
      attempts: attempts.map(cleanAttempt),
      transactionEvidence: transactionEvidence(attempts, plans, steps, receipt),
      observations: observations.map(clean),
      reconciliation: reconciliation.map(clean),
      recovery: cleanOptional(recovery),
      investigation: cleanOptional(investigation),
      receipt: cleanOptional(receipt),
    };
  }
  async timelineEvents(
    tenant: TenantContext,
    runId: string,
    after = 0,
    limit = 500,
  ) {
    await this.assertRun(tenant.workspaceId, runId);
    return (
      await this.connection
        .collection("timeline_events")
        .find({
          workspaceId: tenant.workspaceId,
          runId,
          sequence: { $gt: after },
        })
        .sort({ sequence: 1 })
        .limit(Math.min(limit, 1000))
        .toArray()
    ).map(clean);
  }
  async receipt(tenant: TenantContext, runId: string) {
    const value = await this.connection
      .collection("mission_receipts")
      .findOne({ workspaceId: tenant.workspaceId, runId });
    if (!value) throw new NotFoundException("Receipt is not available.");
    return clean(value);
  }

  async claimDueRun() {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + 30_000);
    const result = await this.connection
      .collection("mission_runs")
      .findOneAndUpdate(
        {
          state: { $nin: [...TERMINAL_MISSION_STATES] },
          nextActionAt: { $lte: now },
          $or: [
            { leaseExpiresAt: { $exists: false } },
            { leaseExpiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            leaseOwner: this.instanceId,
            leaseExpiresAt,
            leaseHeartbeatAt: now,
          },
          $inc: { fencingToken: 1 },
        },
        { returnDocument: "after", sort: { nextActionAt: 1 } },
      );
    return result ? clean(result) : undefined;
  }
  async claimRun(runId: string, workspaceId?: string) {
    const now = new Date();
    const result = await this.connection
      .collection("mission_runs")
      .findOneAndUpdate(
        {
          runId,
          ...(workspaceId ? { workspaceId } : {}),
          state: { $nin: [...TERMINAL_MISSION_STATES] },
          $or: [
            { leaseExpiresAt: { $exists: false } },
            { leaseExpiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            leaseOwner: this.instanceId,
            leaseExpiresAt: new Date(now.getTime() + 30_000),
            leaseHeartbeatAt: now,
          },
          $inc: { fencingToken: 1 },
        },
        { returnDocument: "after" },
      );
    return result ? clean(result) : undefined;
  }
  async releaseLease(runId: string, fencingToken: number, nextActionAt?: Date) {
    await this.connection.collection("mission_runs").updateOne(
      { runId, leaseOwner: this.instanceId, fencingToken },
      {
        $set: { nextActionAt: nextActionAt ?? new Date() },
        $unset: { leaseOwner: "", leaseExpiresAt: "", leaseHeartbeatAt: "" },
      },
    );
  }
  async recordTransientRetry(
    workspaceId: string,
    runId: string,
    fencingToken: number,
    reason: string,
    maximumAttempts: number,
  ) {
    const current = await this.connection.collection("mission_runs").findOne({
      workspaceId,
      runId,
      leaseOwner: this.instanceId,
      fencingToken,
    });
    if (!current) throw new ConflictException("Run lease is stale.");
    const attempt = Number(current.transientFailureCount ?? 0) + 1;
    if (attempt > maximumAttempts) return { exhausted: true as const, attempt };
    const message = `RPC is temporarily unavailable. Verification will retry automatically (${attempt}/${maximumAttempts}).`;
    await this.transaction(async (session) => {
      const result = await this.connection.collection("mission_runs").updateOne(
        {
          workspaceId,
          runId,
          leaseOwner: this.instanceId,
          fencingToken,
          version: current.version,
        },
        {
          $set: {
            transientFailureCount: attempt,
            lastTransientFailureAt: new Date(),
            updatedAt: new Date(),
          },
          $inc: { version: 1 },
        },
        { session },
      );
      if (!result.matchedCount)
        throw new ConflictException("Run state changed concurrently.");
      await this.timeline(
        workspaceId,
        runId,
        "rpc.retry_scheduled",
        String(current.state),
        message,
        { reason: reason.slice(0, 300), attempt, maximumAttempts },
        runId,
        session,
      );
      await this.systemAudit(
        workspaceId,
        runId,
        "rpc.retry_scheduled",
        "MISSION_RUN",
        runId,
        { reason: reason.slice(0, 300), attempt, maximumAttempts },
        runId,
        session,
      );
    });
    return { exhausted: false as const, attempt };
  }
  async clearTransientRetries(
    workspaceId: string,
    runId: string,
    fencingToken: number,
  ) {
    await this.connection.collection("mission_runs").updateOne(
      {
        workspaceId,
        runId,
        leaseOwner: this.instanceId,
        fencingToken,
        transientFailureCount: { $exists: true },
      },
      {
        $unset: {
          transientFailureCount: "",
          lastTransientFailureAt: "",
        },
        $set: { updatedAt: new Date() },
      },
    );
  }
  async heartbeat(runId: string, fencingToken: number) {
    const now = new Date();
    const result = await this.connection.collection("mission_runs").updateOne(
      { runId, leaseOwner: this.instanceId, fencingToken },
      {
        $set: {
          leaseHeartbeatAt: now,
          leaseExpiresAt: new Date(now.getTime() + 30_000),
        },
      },
    );
    if (!result.matchedCount)
      throw new ConflictException("Run lease is stale.");
  }

  async transitionRun(
    workspaceId: string,
    runId: string,
    fencingToken: number,
    to: MissionState,
    reason: string,
    data: Document = {},
  ) {
    const current = await this.connection.collection("mission_runs").findOne({
      workspaceId,
      runId,
      leaseOwner: this.instanceId,
      fencingToken,
    });
    if (!current) throw new ConflictException("Run lease is stale.");
    const from = missionStateSchema.parse(current.state);
    assertMissionTransition(from, to);
    await this.transaction(async (session) => {
      const result = await this.connection.collection("mission_runs").updateOne(
        {
          workspaceId,
          runId,
          leaseOwner: this.instanceId,
          fencingToken,
          version: current.version,
        },
        {
          $set: {
            state: to,
            stateReason: reason,
            updatedAt: new Date(),
            nextActionAt: new Date(),
            ...(TERMINAL_MISSION_STATES.has(to)
              ? { terminalAt: new Date() }
              : {}),
          },
          $inc: { version: 1 },
        },
        { session },
      );
      if (!result.matchedCount)
        throw new ConflictException("Run state changed concurrently.");
      await this.timeline(
        workspaceId,
        runId,
        "run.state_changed",
        to,
        reason,
        { from, ...data },
        runId,
        session,
      );
      await this.systemAudit(
        workspaceId,
        runId,
        "mission.state_changed",
        "MISSION_RUN",
        runId,
        { from, to, reason },
        runId,
        session,
      );
    });
  }
  async transitionStep(
    workspaceId: string,
    runId: string,
    stepId: string,
    to: StepState,
    message: string,
    patch: Document = {},
  ) {
    const lease = await this.connection.collection("mission_runs").findOne(
      {
        workspaceId,
        runId,
        leaseOwner: this.instanceId,
        leaseExpiresAt: { $gt: new Date() },
      },
      { projection: { _id: 1 } },
    );
    if (!lease) throw new ConflictException("Run lease is stale.");
    const current = await this.connection
      .collection("mission_step_runs")
      .findOne({ workspaceId, runId, stepId });
    if (!current) throw new NotFoundException("Step run not found.");
    const from = stepStateSchema.parse(current.state);
    assertStepTransition(from, to);
    await this.transaction(async (session) => {
      const result = await this.connection
        .collection("mission_step_runs")
        .updateOne(
          { workspaceId, runId, stepId, version: current.version },
          {
            $set: {
              state: to,
              ...patch,
              updatedAt: new Date(),
              ...(to === "VERIFIED" ||
              to === "COMPENSATED" ||
              to === "NEEDS_ATTENTION"
                ? { terminalAt: new Date() }
                : {}),
            },
            $inc: { version: 1 },
          },
          { session },
        );
      if (!result.matchedCount)
        throw new ConflictException("Step state changed concurrently.");
      await this.timeline(
        workspaceId,
        runId,
        "step.state_changed",
        to,
        message,
        { stepId, from },
        runId,
        session,
      );
    });
  }

  async missionRuntime(
    workspaceId: string,
    runId: string,
  ): Promise<{
    run: Document;
    version: Document;
    definition: MissionDefinition;
    steps: Document[];
  }> {
    const run = await this.connection
      .collection("mission_runs")
      .findOne({ workspaceId, runId });
    if (!run) throw new NotFoundException("Run not found.");
    const version = await this.connection
      .collection("mission_versions")
      .findOne({ workspaceId, missionVersionId: run.missionVersionId });
    if (!version) throw new NotFoundException("Mission version not found.");
    const steps = await this.connection
      .collection("mission_step_runs")
      .find({ workspaceId, runId })
      .sort({ createdAt: 1 })
      .toArray();
    return {
      run,
      version,
      definition: missionDefinitionSchema.parse(version.definition),
      steps,
    };
  }
  async persistPlanAndSimulation(input: {
    workspaceId: string;
    runId: string;
    stepRunId: string;
    stepId: string;
    generation: number;
    kind: "FORWARD" | "COMPENSATION";
    action: MissionAction;
    proof: unknown;
    missionVersionHash: string;
    simulation: Document;
  }) {
    const opKey = operationKey(
      input.runId,
      input.stepId,
      input.kind,
      input.generation,
    );
    const requestBodyHash = contentHash(input.action);
    const calculatedPlanHash = planHash({
      missionVersionHash: input.missionVersionHash,
      runId: input.runId,
      stepId: input.stepId,
      kind: input.kind,
      action: input.action,
      proof: input.proof,
    });
    const planId = `plan_${randomUUID()}`;
    const simulationRecordId = `sim_${randomUUID()}`;
    await this.transaction(async (session) => {
      await this.connection.collection("operation_plans").insertOne(
        {
          workspaceId: input.workspaceId,
          planId,
          runId: input.runId,
          stepRunId: input.stepRunId,
          kind: input.kind,
          operationKey: opKey,
          requestBody: input.action,
          requestBodyHash,
          expectedPostconditions: input.proof,
          riskSummary:
            input.kind === "COMPENSATION" ? "Recovery write" : "Mission write",
          policyEvaluation: { result: "AUTO_APPROVED" },
          planHash: calculatedPlanHash,
          createdAt: new Date(),
        },
        { session },
      );
      await this.connection.collection("simulation_records").insertOne(
        {
          workspaceId: input.workspaceId,
          simulationRecordId,
          planId,
          provider: "KEEPERHUB",
          requestHash: requestBodyHash,
          requestBody: input.action,
          response: input.simulation,
          success: input.simulation.success,
          wouldRevert: input.simulation.wouldRevert,
          gasEstimate: input.simulation.gasEstimate,
          createdAt: new Date(),
        },
        { session },
      );
      await this.connection.collection("mission_step_runs").updateOne(
        { workspaceId: input.workspaceId, stepRunId: input.stepRunId },
        {
          $set: {
            planId,
            simulationRecordId,
            resolvedAction: input.action,
            resolvedActionHash: requestBodyHash,
          },
        },
        { session },
      );
      await this.systemAudit(
        input.workspaceId,
        input.runId,
        "operation.simulated",
        "OPERATION_PLAN",
        planId,
        {
          planHash: calculatedPlanHash,
          simulationRecordId,
          success: input.simulation.success,
        },
        input.runId,
        session,
      );
    });
    return {
      planId,
      simulationRecordId,
      planHash: calculatedPlanHash,
      requestBodyHash,
      operationKey: opKey,
    };
  }
  async createAttempt(input: {
    workspaceId: string;
    runId: string;
    stepRunId: string;
    generation: number;
    operationKey: string;
    planId: string;
    requestHash: string;
    fencingToken: number;
    observationStartBlock: string;
  }) {
    const executionAttemptId = `att_${randomUUID()}`;
    const keeperHubIdempotencyKey = `aether-${input.operationKey}-${input.generation}`;
    await this.transaction(async (session) => {
      await this.connection.collection("execution_attempts").insertOne(
        {
          ...input,
          executionAttemptId,
          keeperHubIdempotencyKey,
          status: "SUBMITTING",
          dispatchStartedAt: new Date(),
          resubmissionLocked: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { session },
      );
      await this.connection
        .collection("mission_step_runs")
        .updateOne(
          { workspaceId: input.workspaceId, stepRunId: input.stepRunId },
          { $addToSet: { executionAttemptIds: executionAttemptId } },
          { session },
        );
      await this.systemAudit(
        input.workspaceId,
        input.runId,
        "execution.intent_persisted",
        "EXECUTION_ATTEMPT",
        executionAttemptId,
        { keeperHubIdempotencyKey, requestHash: input.requestHash },
        input.runId,
        session,
      );
    });
    return { executionAttemptId, keeperHubIdempotencyKey };
  }
  async updateAttempt(
    workspaceId: string,
    runId: string,
    executionAttemptId: string,
    patch: Document,
    event: string,
  ) {
    await this.transaction(async (session) => {
      await this.connection
        .collection("execution_attempts")
        .updateOne(
          { workspaceId, executionAttemptId },
          { $set: { ...patch, updatedAt: new Date() } },
          { session },
        );
      await this.systemAudit(
        workspaceId,
        runId,
        event,
        "EXECUTION_ATTEMPT",
        executionAttemptId,
        patch,
        runId,
        session,
      );
      await this.timeline(
        workspaceId,
        runId,
        event,
        String(patch.status ?? event),
        humanEvent(event),
        { executionAttemptId, ...patch },
        runId,
        session,
      );
    });
  }
  async createReconciliation(
    workspaceId: string,
    runId: string,
    executionAttemptId: string,
    reason: string,
  ) {
    const reconciliationCaseId = `rec_${randomUUID()}`;
    await this.transaction(async (session) => {
      await this.connection.collection("execution_attempts").updateOne(
        { workspaceId, executionAttemptId },
        {
          $set: {
            status: "RECONCILING",
            resubmissionLocked: true,
            unknownAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { session },
      );
      await this.connection.collection("reconciliation_cases").updateOne(
        { executionAttemptId },
        {
          $setOnInsert: {
            workspaceId,
            reconciliationCaseId,
            executionAttemptId,
            reason,
            strategy: "PROVIDER_THEN_CHAIN",
            state: "OPEN",
            startedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true, session },
      );
      await this.timeline(
        workspaceId,
        runId,
        "execution.outcome_unknown",
        "RECONCILING",
        "Outcome unknown. Retry locked while chain evidence is checked.",
        { executionAttemptId, reconciliationCaseId },
        runId,
        session,
      );
    });
  }
  async appendObservation(
    workspaceId: string,
    runId: string,
    stepRunId: string,
    providerId: string,
    receipt: Document,
  ) {
    const observationId = `obs_${randomUUID()}`;
    await this.connection.collection("observations").insertOne({
      workspaceId,
      observationId,
      runId,
      stepRunId,
      chainId: 11155111,
      blockNumber: String(receipt.blockNumber),
      blockHash: receipt.blockHash,
      providerId,
      kind: "RECEIPT",
      query: { transactionHash: receipt.transactionHash },
      evidence: receipt,
      evidenceHash: contentHash(receipt),
      confirmationCount: receipt.confirmations,
      canonicalityStatus: receipt.canonical ? "CANONICAL" : "PROVISIONAL",
      createdAt: new Date(),
    });
    return observationId;
  }
  async appendInvestigation(
    workspaceId: string,
    runId: string,
    status: "AVAILABLE" | "UNAVAILABLE",
    output: unknown,
    evidenceIds: string[],
    evidenceHash: string,
    latencyMs: number,
    failure?: { code: string; status?: number },
  ) {
    const investigationId = `inv_${randomUUID()}`;
    await this.transaction(async (session) => {
      await this.connection.collection("investigations").insertOne(
        {
          workspaceId,
          investigationId,
          runId,
          trigger: "MISSION_DEGRADED",
          model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
          promptVersion: "incident-summary-v2",
          evidenceIds,
          evidenceHash,
          output,
          status,
          failureCode: failure?.code,
          providerStatus: failure?.status,
          latencyMs,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { session },
      );
      await this.timeline(
        workspaceId,
        runId,
        "investigation.recorded",
        status,
        status === "AVAILABLE"
          ? "Optional incident summary provided by Groq."
          : "Incident summary unavailable.",
        { investigationId, status },
        runId,
        session,
      );
    });
    return investigationId;
  }
  async ensureRecoveryPlan(
    workspaceId: string,
    runId: string,
    definition: MissionDefinition,
  ): Promise<Document> {
    const actions = [...definition.steps]
      .reverse()
      .filter((step) => step.compensation)
      .map((step) => ({
        forwardStepId: step.id,
        compensationId: step.compensation!.id,
        action: step.compensation!.action,
        proof: step.compensation!.proof,
      }));
    const payload = {
      runId,
      trigger: "PARTIAL_MISSION_FAILURE",
      targetSafeState: definition.recoveryPolicy.terminalSafeStates.join(", "),
      actions,
      preconditions: definition.invariants,
      expectedPostconditions: definition.invariants.filter(
        (invariant) => invariant.severity === "CRITICAL",
      ),
      estimatedRecoverySpendWei: actions
        .reduce((total, item) => total + BigInt(item.action.valueWei), 0n)
        .toString(),
      authorityEvaluation: {
        policy: "FROZEN_MISSION_VERSION",
        autoApprove: definition.authorityPolicy.autoApproveRecovery,
      },
    };
    const hash = contentHash(payload);
    const existing = await this.connection
      .collection("recovery_plans")
      .findOne({ workspaceId, runId, planHash: hash });
    if (existing) return clean(existing);
    const recoveryPlanId = `rplan_${randomUUID()}`;
    const record = {
      workspaceId,
      recoveryPlanId,
      ...payload,
      planHash: hash,
      status: "GENERATED",
      createdAt: new Date(),
    };
    await this.transaction(async (session) => {
      await this.connection
        .collection("recovery_plans")
        .insertOne(record, { session });
      await this.timeline(
        workspaceId,
        runId,
        "recovery.plan_created",
        "RECOVERING",
        "The immutable recovery plan was created from the frozen mission version.",
        { recoveryPlanId, planHash: hash, actionCount: actions.length },
        runId,
        session,
      );
    });
    return record;
  }
  async createReceipt(
    workspaceId: string,
    runId: string,
    terminalState: "COMPLETED" | "RECOVERED",
    invariantResults: Array<{
      invariantId: string;
      result: "PASS" | "FAIL" | "UNKNOWN";
      evidence?: unknown;
    }>,
  ) {
    const runtime = await this.missionRuntime(workspaceId, runId);
    const attempts = await this.connection
      .collection("execution_attempts")
      .find({ workspaceId, runId })
      .toArray();
    if (
      attempts.some(
        (attempt) =>
          attempt.resubmissionLocked ||
          ["UNKNOWN", "RECONCILING", "SUBMITTING"].includes(
            String(attempt.status),
          ),
      )
    )
      throw new ConflictException(
        "Cannot create a receipt with unresolved execution attempts.",
      );
    const critical = new Set(
      runtime.definition.invariants
        .filter((invariant) => invariant.severity === "CRITICAL")
        .map((invariant) => invariant.id),
    );
    if (
      invariantResults.some(
        (result) =>
          critical.has(result.invariantId) && result.result !== "PASS",
      )
    )
      throw new ConflictException(
        "Critical terminal invariants have not passed.",
      );
    const auditHead = await this.connection
      .collection("audit_events")
      .findOne({ workspaceId }, { sort: { createdAt: -1 } });
    const payload = {
      runId,
      missionId: runtime.run.missionId,
      missionVersionId: runtime.version.missionVersionId,
      missionVersionHash: runtime.version.hash,
      objective: runtime.definition.objective,
      terminalState,
      objectiveCompleted: terminalState === "COMPLETED",
      compensationOccurred: terminalState === "RECOVERED",
      executions: attempts.map((attempt) => ({
        executionAttemptId: attempt.executionAttemptId,
        keeperHubExecutionId: attempt.keeperHubExecutionId,
        transactionHash: attempt.transactionHash,
        providerTransactionLink: attempt.providerTransactionLink,
        status: attempt.status,
      })),
      invariantResults,
      auditChainHeadHash: auditHead?.eventHash,
    };
    const receiptHash = contentHash(payload);
    const receiptId = `rcpt_${randomUUID()}`;
    await this.transaction(async (session) => {
      await this.connection.collection("mission_receipts").insertOne(
        {
          workspaceId,
          receiptId,
          ...payload,
          receiptHash,
          createdAt: new Date(),
        },
        { session },
      );
      await this.connection
        .collection("mission_runs")
        .updateOne(
          { workspaceId, runId },
          { $set: { finalReceiptId: receiptId } },
          { session },
        );
      await this.systemAudit(
        workspaceId,
        runId,
        "mission.receipt_created",
        "MISSION_RECEIPT",
        receiptId,
        { receiptHash, terminalState },
        runId,
        session,
      );
    });
    return { receiptId, receiptHash };
  }

  async listApprovals(tenant: TenantContext) {
    return {
      items: (
        await this.connection
          .collection("approval_records")
          .find({ workspaceId: tenant.workspaceId })
          .sort({ requestedAt: -1 })
          .limit(100)
          .toArray()
      ).map(clean),
    };
  }
  async requestApproval(
    workspaceId: string,
    runId: string,
    planHashValue: string,
    scope: "FORWARD" | "RECOVERY",
  ) {
    const existing = await this.connection
      .collection("approval_records")
      .findOne({ workspaceId, runId, planHash: planHashValue });
    if (existing) return clean(existing);
    const approval = {
      workspaceId,
      approvalId: `apr_${randomUUID()}`,
      runId,
      planHash: planHashValue,
      scope,
      requiredRole: "OPERATOR",
      status: "PENDING",
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.connection.collection("approval_records").insertOne(approval);
    return clean(approval);
  }
  async getApproval(tenant: TenantContext, id: string) {
    const value = await this.connection
      .collection("approval_records")
      .findOne({ workspaceId: tenant.workspaceId, approvalId: id });
    if (!value) throw new NotFoundException("Approval not found.");
    return clean(value);
  }
  async decideApproval(
    tenant: TenantContext,
    id: string,
    status: "APPROVED" | "DENIED",
    reason: string,
    idempotencyKey: string,
  ) {
    return this.idempotentMutation(
      tenant,
      idempotencyKey,
      `approvals.decide:${id}`,
      { id, status, reason },
      async (session) => {
        const result = await this.connection
          .collection("approval_records")
          .findOneAndUpdate(
            {
              workspaceId: tenant.workspaceId,
              approvalId: id,
              status: "PENDING",
              expiresAt: { $gt: new Date() },
            },
            {
              $set: {
                status,
                decisionReason: reason,
                decidedAt: new Date(),
                decidedBy: tenant.actorId,
                updatedAt: new Date(),
              },
            },
            { returnDocument: "after", session },
          );
        if (!result)
          throw new ConflictException(
            "Approval is unavailable, expired, or already decided.",
          );
        return clean(result);
      },
    );
  }
  async listAudit(tenant: TenantContext, limit = 100) {
    return {
      items: (
        await this.connection
          .collection("audit_events")
          .find({ workspaceId: tenant.workspaceId })
          .sort({ createdAt: -1 })
          .limit(Math.min(limit, 200))
          .toArray()
      ).map(clean),
    };
  }
  async getAudit(tenant: TenantContext, id: string) {
    const value = await this.connection
      .collection("audit_events")
      .findOne({ workspaceId: tenant.workspaceId, eventId: id });
    if (!value) throw new NotFoundException("Audit event not found.");
    return clean(value);
  }
  async createApiKey(
    tenant: TenantContext,
    input: { name: string; scopes: string[] },
    idempotencyKey: string,
  ) {
    const requestHash = contentHash(input);
    const routeScope = "api-keys.create";
    const replay = await this.idempotentReplay(
      tenant.workspaceId,
      idempotencyKey,
      routeScope,
      requestHash,
    );
    if (replay) return { ...(replay as Document), plaintextAvailable: false };
    const random = randomBytes(32).toString("base64url");
    const plaintext = `aeth_${random}`;
    const prefix = plaintext.slice(0, 14);
    const apiKeyId = `key_${randomUUID()}`;
    const response = {
      apiKeyId,
      name: input.name,
      prefix,
      scopes: input.scopes,
    };
    const keyHash = await argon2.hash(plaintext, { type: argon2.argon2id });
    await this.transaction(async (session) => {
      await this.connection.collection("api_keys").insertOne(
        {
          workspaceId: tenant.workspaceId,
          apiKeyId,
          name: input.name,
          prefix,
          keyHash,
          scopes: input.scopes,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { session },
      );
      await this.saveIdempotency(
        tenant.workspaceId,
        idempotencyKey,
        routeScope,
        requestHash,
        response,
        session,
      );
    });
    return { ...response, key: plaintext, plaintextAvailable: true };
  }
  async listApiKeys(tenant: TenantContext) {
    return {
      items: (
        await this.connection
          .collection("api_keys")
          .find({ workspaceId: tenant.workspaceId })
          .project({ keyHash: 0 })
          .sort({ createdAt: -1 })
          .toArray()
      ).map(clean),
    };
  }
  async revokeApiKey(tenant: TenantContext, id: string) {
    await this.connection
      .collection("api_keys")
      .updateOne(
        { workspaceId: tenant.workspaceId, apiKeyId: id },
        { $set: { revokedAt: new Date() } },
      );
    return { apiKeyId: id, revoked: true };
  }

  async idempotentMutation<T extends Document>(
    tenant: TenantContext,
    key: string,
    routeScope: string,
    input: unknown,
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const requestHash = contentHash(input);
    const replay = await this.idempotentReplay(
      tenant.workspaceId,
      key,
      routeScope,
      requestHash,
    );
    if (replay) return replay as T;
    return this.transaction(async (session) => {
      const response = await work(session);
      await this.saveIdempotency(
        tenant.workspaceId,
        key,
        routeScope,
        requestHash,
        response,
        session,
      );
      return response;
    });
  }

  private async assertRun(workspaceId: string, runId: string) {
    if (
      !(await this.connection
        .collection("mission_runs")
        .findOne({ workspaceId, runId }))
    )
      throw new NotFoundException("Run not found.");
  }
  private async idempotentReplay(
    workspaceId: string,
    key: string,
    routeScope: string,
    requestHash: string,
  ) {
    const record = await this.connection
      .collection("idempotency_records")
      .findOne({ workspaceId, key, routeScope });
    if (!record) return undefined;
    if (record.requestHash !== requestHash)
      throw new ConflictException({
        code: "IDEMPOTENCY_CONFLICT",
        message: "Idempotency key was already used with a different request.",
      });
    return record.response;
  }
  private async saveIdempotency(
    workspaceId: string,
    key: string,
    routeScope: string,
    requestHash: string,
    response: unknown,
    session: ClientSession,
  ) {
    await this.connection.collection("idempotency_records").insertOne(
      {
        workspaceId,
        key,
        routeScope,
        requestHash,
        status: "COMPLETED",
        response,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { session },
    );
  }
  private async timeline(
    workspaceId: string,
    runId: string,
    type: string,
    state: string,
    message: string,
    data: Document,
    correlationId: string,
    session: ClientSession,
  ) {
    const previous = await this.connection
      .collection("timeline_events")
      .findOne({ runId }, { sort: { sequence: -1 }, session });
    const sequence = Number(previous?.sequence ?? 0) + 1;
    const eventId = `tle_${randomUUID()}`;
    const createdAt = new Date();
    const payload = {
      eventId,
      runId,
      sequence,
      type,
      state,
      message,
      data,
      correlationId,
      createdAt,
    };
    await this.connection
      .collection("timeline_events")
      .insertOne({ workspaceId, ...payload }, { session });
    const endpoints = await this.connection
      .collection("webhook_endpoints")
      .find(
        {
          workspaceId,
          disabledAt: { $exists: false },
          events: { $in: [type, "*"] },
        },
        { session },
      )
      .toArray();
    if (endpoints.length)
      await this.connection.collection("webhook_deliveries").insertMany(
        endpoints.map((endpoint) => ({
          workspaceId,
          deliveryId: `whd_${randomUUID()}`,
          webhookId: endpoint.webhookId,
          eventId,
          payload,
          status: "PENDING",
          attemptCount: 0,
          nextAttemptAt: createdAt,
          fencingToken: 0,
          createdAt,
          updatedAt: createdAt,
        })),
        { session },
      );
  }
  private async audit(
    tenant: TenantContext,
    event: {
      eventType: string;
      subjectType: string;
      subjectId: string;
      metadata: Document;
      correlationId: string;
    },
    session: ClientSession,
  ) {
    return this.systemAudit(
      tenant.workspaceId,
      undefined,
      event.eventType,
      event.subjectType,
      event.subjectId,
      event.metadata,
      event.correlationId,
      session,
      tenant.actorId,
      "USER",
    );
  }
  private async systemAudit(
    workspaceId: string,
    runId: string | undefined,
    eventType: string,
    subjectType: string,
    subjectId: string,
    metadata: Document,
    correlationId: string,
    session: ClientSession,
    actorId = "aether-runtime",
    actorType = "SYSTEM",
  ) {
    const previous = await this.connection
      .collection("audit_events")
      .findOne({ workspaceId }, { sort: { createdAt: -1 }, session });
    const payload = {
      workspaceId,
      runId,
      actorType,
      actorId,
      eventType,
      subjectType,
      subjectId,
      metadata,
      correlationId,
      previousEventHash: previous?.eventHash,
    };
    await this.connection.collection("audit_events").insertOne(
      {
        eventId: `aud_${randomUUID()}`,
        ...payload,
        eventHash: contentHash(payload),
        createdAt: new Date(),
      },
      { session },
    );
  }
  private async transaction<T>(work: (session: ClientSession) => Promise<T>) {
    const session = await this.connection.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  private objectId(value: string) {
    const ctor = this.connection.base.Types.ObjectId;
    return new ctor(value);
  }
}

function clean(value: Document) {
  const result = { ...value };
  delete result._id;
  delete result.__v;
  return result;
}
function cleanOptional(value: Document | null) {
  return value ? clean(value) : undefined;
}
function cleanAttempt(value: Document) {
  const result = clean(value);
  const link = safeExternalUrl(result.providerTransactionLink);
  if (link) result.providerTransactionLink = link;
  else delete result.providerTransactionLink;
  return result;
}

export function transactionEvidence(
  attempts: Document[],
  plans: Document[],
  steps: Document[],
  receipt: Document | null,
) {
  const plansById = new Map(plans.map((plan) => [plan.planId, plan]));
  const stepsById = new Map(steps.map((step) => [step.stepRunId, step]));
  const evidence = new Map<string, Document>();
  const explorer = activeLiveChain.explorerUrl;

  for (const attempt of attempts) {
    if (typeof attempt.transactionHash !== "string") continue;
    const hash = attempt.transactionHash.toLowerCase();
    const plan = plansById.get(attempt.planId);
    const step = stepsById.get(attempt.stepRunId);
    evidence.set(hash, {
      chainId: activeLiveChain.chainId,
      network: activeLiveChain.displayName,
      transactionHash: attempt.transactionHash,
      explorerUrl: explorer
        ? `${explorer}/tx/${attempt.transactionHash}`
        : null,
      providerTransactionLink: safeExternalUrl(attempt.providerTransactionLink),
      executionAttemptId: attempt.executionAttemptId,
      keeperHubExecutionId: attempt.keeperHubExecutionId,
      stepRunId: attempt.stepRunId,
      stepId: step?.stepId,
      kind: plan?.kind,
      status: attempt.status,
      providerStatus: attempt.providerStatus,
      createdAt: attempt.createdAt,
      dispatchStartedAt: attempt.dispatchStartedAt,
      acknowledgedAt: attempt.acknowledgedAt,
      terminalAt: attempt.terminalAt,
    });
  }

  const receiptExecutions = Array.isArray(receipt?.executions)
    ? receipt.executions
    : [];
  for (const rawExecution of receiptExecutions) {
    if (
      typeof rawExecution !== "object" ||
      rawExecution === null ||
      !("transactionHash" in rawExecution) ||
      typeof rawExecution.transactionHash !== "string"
    )
      continue;
    const hash = rawExecution.transactionHash.toLowerCase();
    if (evidence.has(hash)) continue;
    evidence.set(hash, {
      chainId: activeLiveChain.chainId,
      network: activeLiveChain.displayName,
      transactionHash: rawExecution.transactionHash,
      explorerUrl: explorer
        ? `${explorer}/tx/${rawExecution.transactionHash}`
        : null,
      executionAttemptId:
        "executionAttemptId" in rawExecution
          ? rawExecution.executionAttemptId
          : undefined,
      keeperHubExecutionId:
        "keeperHubExecutionId" in rawExecution
          ? rawExecution.keeperHubExecutionId
          : undefined,
      providerTransactionLink:
        "providerTransactionLink" in rawExecution
          ? safeExternalUrl(rawExecution.providerTransactionLink)
          : undefined,
      status: "status" in rawExecution ? rawExecution.status : undefined,
      receiptOnly: true,
    });
  }

  return [...evidence.values()];
}
function safeExternalUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}
function humanEvent(event: string) {
  return event
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
