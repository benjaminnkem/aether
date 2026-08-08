import {
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import { z } from "zod";
import {
  missionStateSchema,
  stepStateSchema,
  TERMINAL_MISSION_STATES,
  type MissionDefinition,
  type MissionState,
} from "@aether/shared";
import { contentHash, CredentialCipher } from "@aether/backend";
import { MissionStore } from "./mission-store";
import {
  DualRpcObserver,
  GroqIncidentSummarizer,
  KeeperHubHttpClient,
  ProviderRequestError,
} from "./providers";

type Doc = Record<string, unknown>;

@Injectable()
export class RunCoordinator
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer?: NodeJS.Timeout;
  private stopping = false;
  private scanning = false;
  private readonly active = new Map<string, Promise<void>>();
  constructor(
    private readonly store: MissionStore,
    private readonly keeper: KeeperHubHttpClient,
    private readonly rpc: DualRpcObserver,
    private readonly groq: GroqIncidentSummarizer,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.scan(), 1000);
    this.timer.unref();
    void this.scan();
  }
  async onApplicationShutdown() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.active.values()]);
  }
  start(runId: string) {
    if (!this.active.has(runId)) {
      const work = this.driveSpecific(runId).finally(() =>
        this.active.delete(runId),
      );
      this.active.set(runId, work);
    }
    return this.active.get(runId)!;
  }
  async control(
    workspaceId: string,
    runId: string,
    action: "pause" | "resume" | "cancel",
  ) {
    const claim = await this.store.claimRun(runId, workspaceId);
    if (!claim)
      throw new Error(
        "Run is currently owned by another process or is unavailable.",
      );
    const token = Number(claim.fencingToken);
    const state = missionStateSchema.parse(claim.state);
    if (action === "pause")
      await this.store.transitionRun(
        workspaceId,
        runId,
        token,
        "PAUSED",
        "Run paused by an operator.",
      );
    if (action === "resume") {
      if (state !== "PAUSED") throw new Error("Only a paused run can resume.");
      await this.store.transitionRun(
        workspaceId,
        runId,
        token,
        "PREFLIGHT",
        "Run resumed. Current reality will be checked again.",
      );
    }
    if (action === "cancel") {
      const attempts = await this.store.connection
        .collection("execution_attempts")
        .countDocuments({
          workspaceId,
          runId,
          status: { $in: ["ACKNOWLEDGED", "CONFIRMED", "RECONCILING"] },
        });
      if (attempts === 0 && ["PREFLIGHT", "PAUSED"].includes(state))
        await this.store.transitionRun(
          workspaceId,
          runId,
          token,
          "ABORTED_SAFE",
          "Run cancelled before an irreversible effect.",
        );
      else
        await this.store.transitionRun(
          workspaceId,
          runId,
          token,
          "DEGRADED",
          "Objective cancelled after execution began. Evaluating declared recovery.",
        );
    }
    await this.store.releaseLease(runId, token, new Date());
    this.start(runId);
    return this.store.getRun(
      { workspaceId, actorId: "aether-runtime", role: "OWNER" },
      runId,
    );
  }
  async applyApproval(workspaceId: string, runId: string, scope: string) {
    const claim = await this.store.claimRun(runId, workspaceId);
    if (!claim) return;
    const token = Number(claim.fencingToken);
    if (claim.state !== "AWAITING_APPROVAL") {
      await this.store.releaseLease(runId, token, new Date());
      return;
    }
    if (scope === "FORWARD") {
      const step = await this.store.connection
        .collection("mission_step_runs")
        .findOne({ workspaceId, runId, state: "AWAITING_APPROVAL" });
      if (step)
        await this.store.transitionStep(
          workspaceId,
          runId,
          String(step.stepId),
          "READY_TO_SUBMIT",
          "Approval accepted for the exact plan.",
        );
      await this.store.transitionRun(
        workspaceId,
        runId,
        token,
        "EXECUTING",
        "Required approval was granted.",
      );
    } else
      await this.store.transitionRun(
        workspaceId,
        runId,
        token,
        "RECOVERING",
        "Recovery approval was granted.",
      );
    await this.store.releaseLease(runId, token, new Date());
    this.start(runId);
  }
  private async scan() {
    if (this.stopping || this.scanning) return;
    this.scanning = true;
    try {
      for (let count = 0; count < 10; count += 1) {
        const run = await this.store.claimDueRun();
        if (!run) break;
        const runId = String(run.runId);
        const work = this.driveClaimed(run).finally(() =>
          this.active.delete(runId),
        );
        this.active.set(runId, work);
      }
      for (let count = 0; count < 5; count += 1) {
        if (!(await this.deliverWebhook())) break;
      }
    } finally {
      this.scanning = false;
    }
  }
  private async deliverWebhook() {
    const now = new Date();
    const delivery = await this.store.connection
      .collection("webhook_deliveries")
      .findOneAndUpdate(
        {
          status: { $in: ["PENDING", "RETRY"] },
          nextAttemptAt: { $lte: now },
          $or: [
            { leaseExpiresAt: { $exists: false } },
            { leaseExpiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            leaseOwner: this.store.runnerId,
            leaseExpiresAt: new Date(now.getTime() + 30_000),
            status: "DELIVERING",
          },
          $inc: { fencingToken: 1, attemptCount: 1 },
        },
        { returnDocument: "after", sort: { nextAttemptAt: 1 } },
      );
    if (!delivery) return false;
    const endpoint = await this.store.connection
      .collection("webhook_endpoints")
      .findOne({
        workspaceId: delivery.workspaceId,
        webhookId: delivery.webhookId,
        disabledAt: { $exists: false },
      });
    if (!endpoint?.encryptedSecret) {
      await this.store.connection.collection("webhook_deliveries").updateOne(
        { _id: delivery._id, fencingToken: delivery.fencingToken },
        {
          $set: {
            status: "FAILED",
            error: "Webhook endpoint is unavailable.",
            updatedAt: new Date(),
          },
          $unset: { leaseOwner: "", leaseExpiresAt: "" },
        },
      );
      return true;
    }
    const body = JSON.stringify(delivery.payload);
    const cipher = new CredentialCipher(
      requiredText("AETHER_CREDENTIAL_ENCRYPTION_KEY"),
    );
    const secret = cipher.decrypt(String(endpoint.encryptedSecret), {
      workspaceId: String(delivery.workspaceId),
      provider: `webhook:${String(delivery.webhookId)}`,
      version: Number(endpoint.secretVersion),
    });
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    try {
      const response = await fetch(String(endpoint.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-aether-delivery-id": String(delivery.deliveryId),
          "x-aether-signature-256": `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok)
        throw new Error(`Endpoint returned ${response.status}.`);
      await this.store.connection.collection("webhook_deliveries").updateOne(
        { _id: delivery._id, fencingToken: delivery.fencingToken },
        {
          $set: {
            status: "DELIVERED",
            responseStatus: response.status,
            deliveredAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: { leaseOwner: "", leaseExpiresAt: "" },
        },
      );
    } catch (error) {
      const attempts = Number(delivery.attemptCount);
      const failed = attempts >= 8;
      await this.store.connection.collection("webhook_deliveries").updateOne(
        { _id: delivery._id, fencingToken: delivery.fencingToken },
        {
          $set: {
            status: failed ? "FAILED" : "RETRY",
            error: (error instanceof Error
              ? error.message
              : "Webhook delivery failed."
            ).slice(0, 240),
            nextAttemptAt: new Date(
              Date.now() + Math.min(60 * 60_000, 1000 * 2 ** attempts),
            ),
            updatedAt: new Date(),
          },
          $unset: { leaseOwner: "", leaseExpiresAt: "" },
        },
      );
    }
    return true;
  }
  private async driveSpecific(runId: string) {
    const run = await this.store.claimRun(runId);
    if (run) await this.driveClaimed(run);
  }
  private async driveClaimed(claimed: Doc) {
    const runId = String(claimed.runId);
    const workspaceId = String(claimed.workspaceId);
    const fencingToken = Number(claimed.fencingToken);
    try {
      for (
        let transitions = 0;
        transitions < 100 && !this.stopping;
        transitions += 1
      ) {
        await this.store.heartbeat(runId, fencingToken);
        const runtime = await this.store.missionRuntime(workspaceId, runId);
        const state = missionStateSchema.parse(runtime.run.state);
        if (
          TERMINAL_MISSION_STATES.has(state) ||
          state === "PAUSED" ||
          state === "AWAITING_APPROVAL"
        )
          break;
        const outcome = await this.advance({
          workspaceId,
          runId,
          fencingToken,
          state,
          definition: runtime.definition,
          version: runtime.version,
          steps: runtime.steps,
        });
        await this.store.clearTransientRetries(
          workspaceId,
          runId,
          fencingToken,
        );
        if (outcome.delayMs !== undefined) {
          await this.store.releaseLease(
            runId,
            fencingToken,
            new Date(Date.now() + outcome.delayMs),
          );
          return;
        }
        if (outcome.stop) break;
      }
      await this.store.releaseLease(
        runId,
        fencingToken,
        new Date(Date.now() + 1000),
      );
    } catch (error) {
      const retryable = retryableRunError(error);
      if (retryable) {
        const maximumAttempts = numberEnv(
          "AETHER_RPC_TRANSIENT_MAX_RETRIES",
          12,
        );
        const scheduled = await this.store
          .recordTransientRetry(
            workspaceId,
            runId,
            fencingToken,
            retryable.reason,
            maximumAttempts,
          )
          .catch(() => undefined);
        if (scheduled && !scheduled.exhausted) {
          await this.store
            .releaseLease(
              runId,
              fencingToken,
              new Date(
                Date.now() +
                  retryDelayMs(scheduled.attempt, retryable.retryAfterMs),
              ),
            )
            .catch(() => undefined);
          return;
        }
      }
      const terminalError = retryable
        ? new Error(
            `RPC verification remained unavailable after the configured retry limit: ${retryable.reason}`,
          )
        : error;
      await this.failClosed(
        workspaceId,
        runId,
        fencingToken,
        terminalError,
      ).catch(() => undefined);
      await this.store
        .releaseLease(runId, fencingToken, new Date(Date.now() + 5000))
        .catch(() => undefined);
    }
  }
  private async advance(context: {
    workspaceId: string;
    runId: string;
    fencingToken: number;
    state: MissionState;
    definition: MissionDefinition;
    version: Doc;
    steps: Doc[];
  }): Promise<{ delayMs?: number; stop?: boolean }> {
    if (context.state === "PREFLIGHT") {
      const policy = await this.store.connection
        .collection("workspace_policies")
        .findOne({ workspaceId: context.workspaceId });
      if (policy?.emergencyPause) {
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "PAUSED",
          "New writes are paused by workspace policy.",
        );
        return { stop: true };
      }
      if (
        policy &&
        context.definition.steps.length >
          Number(policy.maximumWritesPerMission ?? 0)
      ) {
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "NEEDS_ATTENTION",
          "Mission exceeds the workspace write-count limit.",
        );
        return { stop: true };
      }
      if (
        policy &&
        context.definition.steps.some(
          (step) =>
            BigInt(step.action.valueWei) >
            BigInt(String(policy.maximumValueWei ?? "0")),
        )
      ) {
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "NEEDS_ATTENTION",
          "Mission exceeds the workspace value limit.",
        );
        return { stop: true };
      }
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "EXECUTING",
        "Preflight passed. Executing the first step.",
      );
      return {};
    }
    if (context.state === "VERIFYING") {
      const invariantResults = await this.evaluateInvariants(
        context.workspaceId,
        context.runId,
        context.definition,
      );
      const receipt = await this.store.createReceipt(
        context.workspaceId,
        context.runId,
        "COMPLETED",
        invariantResults,
      );
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "COMPLETED",
        "Mission objective and critical invariants verified.",
        receipt,
      );
      return { stop: true };
    }
    if (context.state === "VERIFYING_RECOVERY") {
      const invariantResults = await this.evaluateInvariants(
        context.workspaceId,
        context.runId,
        context.definition,
      );
      const receipt = await this.store.createReceipt(
        context.workspaceId,
        context.runId,
        "RECOVERED",
        invariantResults,
      );
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "RECOVERED",
        "Authorized safe state independently verified.",
        receipt,
      );
      return { stop: true };
    }
    if (context.state === "DEGRADED") {
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "INVESTIGATING",
        "Recording the incident before choosing the deterministic disposition.",
      );
      return {};
    }
    if (context.state === "INVESTIGATING") {
      const existing = await this.store.connection
        .collection("investigations")
        .findOne({ workspaceId: context.workspaceId, runId: context.runId });
      if (!existing) {
        const evidence = context.steps.map((step) => ({
          id: String(step.stepRunId),
          fact: `${String(step.stepId)} is ${String(step.state)}`,
        }));
        const hash = contentHash(evidence);
        const started = Date.now();
        try {
          const output = await this.groq.summarize({
            objective: context.definition.objective,
            evidence,
          });
          await this.store.appendInvestigation(
            context.workspaceId,
            context.runId,
            "AVAILABLE",
            output,
            evidence.map((item) => item.id),
            hash,
            Date.now() - started,
          );
        } catch (error) {
          await this.store.appendInvestigation(
            context.workspaceId,
            context.runId,
            "UNAVAILABLE",
            { summary: "Incident summary unavailable" },
            evidence.map((item) => item.id),
            hash,
            Date.now() - started,
            {
              code:
                error instanceof ProviderRequestError && error.code
                  ? error.code
                  : "GROQ_REQUEST_FAILED",
              status:
                error instanceof ProviderRequestError
                  ? error.status
                  : undefined,
            },
          );
        }
      }
      if (context.definition.recoveryPolicy.onKnownFailure === "COMPENSATE") {
        await this.store.ensureRecoveryPlan(
          context.workspaceId,
          context.runId,
          context.definition,
        );
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "RECOVERING",
          "Starting the declared recovery actions.",
        );
        return {};
      }
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "NEEDS_ATTENTION",
        "No authorized automatic recovery is available.",
      );
      return { stop: true };
    }
    if (context.state === "RECONCILING") return this.reconcile(context);
    if (context.state === "RECOVERING") return this.recover(context);
    if (context.state !== "EXECUTING") return { stop: true };
    const verified = new Set(
      context.steps
        .filter((item) =>
          ["VERIFIED", "SKIPPED", "COMPENSATED"].includes(String(item.state)),
        )
        .map((item) => String(item.stepId)),
    );
    const next = context.steps.find(
      (item) =>
        !verified.has(String(item.stepId)) &&
        (
          context.definition.steps.find((step) => step.id === item.stepId)
            ?.dependsOn ?? []
        ).every((dependency) => verified.has(dependency)),
    );
    if (!next) {
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "VERIFYING",
        "All mission steps are verified. Checking terminal invariants.",
      );
      return {};
    }
    return this.forward(context, next);
  }

  private async forward(
    context: {
      workspaceId: string;
      runId: string;
      fencingToken: number;
      definition: MissionDefinition;
      version: Doc;
    },
    stepRun: Doc,
  ): Promise<{ delayMs?: number; stop?: boolean }> {
    const stepId = String(stepRun.stepId);
    const definition = context.definition.steps.find(
      (item) => item.id === stepId,
    );
    if (!definition) throw new Error("Step definition is unavailable.");
    const state = stepStateSchema.parse(stepRun.state);
    if (state === "PENDING") {
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        stepId,
        "PRECONDITION_CHECK",
        "Checking step preconditions.",
        { startedAt: new Date() },
      );
      return {};
    }
    if (state === "PRECONDITION_CHECK") {
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        stepId,
        "SIMULATING",
        "Simulating the exact write through KeeperHub.",
      );
      return {};
    }
    if (state === "SIMULATING") {
      let simulation: Doc;
      try {
        simulation = (await this.keeper.simulate(
          context.workspaceId,
          definition.action,
        )) as unknown as Doc;
      } catch (error) {
        await this.store.persistPlanAndSimulation({
          workspaceId: context.workspaceId,
          runId: context.runId,
          stepRunId: String(stepRun.stepRunId),
          stepId,
          generation: Number(stepRun.attemptGeneration ?? 0),
          kind: "FORWARD",
          action: definition.action,
          proof: definition.proof,
          missionVersionHash: String(context.version.hash),
          simulation: simulationFailureEvidence(error),
        });
        await this.store.transitionStep(
          context.workspaceId,
          context.runId,
          stepId,
          "SIMULATION_FAILED",
          "Simulation failed. Nothing was broadcast.",
        );
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "DEGRADED",
          "A step could not pass simulation. Earlier verified effects may require recovery.",
        );
        return {};
      }
      const plan = await this.store.persistPlanAndSimulation({
        workspaceId: context.workspaceId,
        runId: context.runId,
        stepRunId: String(stepRun.stepRunId),
        stepId,
        generation: Number(stepRun.attemptGeneration ?? 0),
        kind: "FORWARD",
        action: definition.action,
        proof: definition.proof,
        missionVersionHash: String(context.version.hash),
        simulation,
      });
      if (!simulation.success || simulation.wouldRevert) {
        await this.store.transitionStep(
          context.workspaceId,
          context.runId,
          stepId,
          "SIMULATION_FAILED",
          "Simulation predicts the write would fail.",
        );
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "DEGRADED",
          "A step cannot proceed safely.",
        );
        return {};
      }
      if (!context.definition.authorityPolicy.autoApproveForward) {
        const approval = await this.store.requestApproval(
          context.workspaceId,
          context.runId,
          plan.planHash,
          "FORWARD",
        );
        await this.store.transitionStep(
          context.workspaceId,
          context.runId,
          stepId,
          "AWAITING_APPROVAL",
          "Waiting for approval bound to the exact plan.",
          { approvalId: approval.approvalId },
        );
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "AWAITING_APPROVAL",
          "A step requires approval.",
        );
        return { stop: true };
      }
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        stepId,
        "READY_TO_SUBMIT",
        "Simulation and policy checks passed.",
      );
      return {};
    }
    if (state === "AWAITING_APPROVAL") return { stop: true };
    if (state === "READY_TO_SUBMIT") {
      const plan = await this.store.connection
        .collection("operation_plans")
        .findOne({ workspaceId: context.workspaceId, planId: stepRun.planId });
      if (!plan) throw new Error("Operation plan is unavailable.");
      if (!this.rpc.primary)
        throw new Error("Primary Sepolia RPC is unavailable.");
      const observationStartBlock = (
        await this.rpc.primary.blockNumber()
      ).toString();
      const attempt = await this.store.createAttempt({
        workspaceId: context.workspaceId,
        runId: context.runId,
        stepRunId: String(stepRun.stepRunId),
        generation: Number(stepRun.attemptGeneration ?? 0),
        operationKey: String(plan.operationKey),
        planId: String(plan.planId),
        requestHash: String(plan.requestBodyHash),
        fencingToken: context.fencingToken,
        observationStartBlock,
      });
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        stepId,
        "SUBMITTING",
        "Execution intent persisted. Sending the write once.",
      );
      return this.submitAttempt(
        context,
        stepRun,
        definition.action,
        attempt.executionAttemptId,
        attempt.keeperHubIdempotencyKey,
      );
    }
    if (state === "SUBMITTING") {
      const attempt = await this.latestAttempt(
        context.workspaceId,
        String(stepRun.stepRunId),
      );
      if (!attempt) {
        await this.store.transitionStep(
          context.workspaceId,
          context.runId,
          stepId,
          "READY_TO_SUBMIT",
          "No provider request began; recreating the durable attempt.",
          { attemptGeneration: Number(stepRun.attemptGeneration ?? 0) + 1 },
        );
        return {};
      }
      if (attempt.status === "RATE_LIMITED")
        return this.submitAttempt(
          context,
          stepRun,
          definition.action,
          String(attempt.executionAttemptId),
          String(attempt.keeperHubIdempotencyKey),
        );
      if (attempt.keeperHubExecutionId)
        return this.pollAttempt(context, stepRun, attempt);
      await this.unknown(
        context,
        stepRun,
        attempt,
        "Submission was persisted but no provider acknowledgement is available.",
      );
      return {};
    }
    if (state === "EXECUTED") {
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        stepId,
        "VERIFYING",
        "Checking canonical Sepolia evidence.",
      );
      return {};
    }
    if (state === "VERIFYING") {
      const attempt = await this.latestAttempt(
        context.workspaceId,
        String(stepRun.stepRunId),
      );
      if (!attempt?.transactionHash) {
        await this.unknown(
          context,
          stepRun,
          attempt,
          "Transaction hash is unavailable during verification.",
        );
        return {};
      }
      const receipt = await this.rpc.agreedReceipt(
        String(attempt.transactionHash),
        minimumConfirmations(),
      );
      if (!receipt || receipt.confirmations < minimumConfirmations())
        return { delayMs: 5000 };
      if (!receipt.success) {
        await this.store.transitionStep(
          context.workspaceId,
          context.runId,
          stepId,
          "FAILED_KNOWN",
          "The canonical transaction receipt reports failure.",
        );
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "DEGRADED",
          "A submitted step failed onchain.",
        );
        return {};
      }
      const proofResult = await this.verifyProof(
        definition.proof,
        receipt as unknown as Doc,
      );
      if (proofResult.result === "UNKNOWN") return { delayMs: 5000 };
      if (proofResult.result === "FAIL") {
        await this.store.transitionStep(
          context.workspaceId,
          context.runId,
          stepId,
          "FAILED_KNOWN",
          "The transaction landed but the declared postcondition did not pass.",
        );
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "DEGRADED",
          "A step did not produce its required onchain state.",
        );
        return {};
      }
      const observationId = await this.store.appendObservation(
        context.workspaceId,
        context.runId,
        String(stepRun.stepRunId),
        "rpc-consensus",
        receipt as unknown as Doc,
      );
      await this.store.updateAttempt(
        context.workspaceId,
        context.runId,
        String(attempt.executionAttemptId),
        {
          status: "CONFIRMED",
          terminalAt: new Date(),
          resubmissionLocked: false,
        },
        "execution.verified",
      );
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        stepId,
        "VERIFIED",
        "Step independently verified.",
        {
          observationIds: [
            ...((stepRun.observationIds as string[]) ?? []),
            observationId,
          ],
        },
      );
      return {};
    }
    if (["SIMULATION_FAILED", "FAILED_KNOWN"].includes(state)) {
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "DEGRADED",
        "The mission cannot continue from the current state.",
      );
      return {};
    }
    return { stop: true };
  }

  private async submitAttempt(
    context: { workspaceId: string; runId: string; fencingToken: number },
    stepRun: Doc,
    action: MissionDefinition["steps"][number]["action"],
    attemptId: string,
    key: string,
  ) {
    try {
      const submission = await this.keeper.submit(
        context.workspaceId,
        key,
        action,
      );
      const fault = await this.store.connection
        .collection("mission_runs")
        .findOneAndUpdate(
          {
            workspaceId: context.workspaceId,
            runId: context.runId,
            demoScenario: "UNKNOWN_OUTCOME",
            demoFaultAfterProviderCall: true,
            demoFaultConsumedAt: { $exists: false },
          },
          { $set: { demoFaultConsumedAt: new Date() } },
          { returnDocument: "after" },
        );
      if (fault)
        throw new ProviderRequestError(
          "Demo fault injector discarded the provider acknowledgement after the call completed.",
          undefined,
          undefined,
          true,
        );
      await this.store.updateAttempt(
        context.workspaceId,
        context.runId,
        attemptId,
        {
          status: "ACKNOWLEDGED",
          keeperHubExecutionId: submission.executionId,
          providerStatus: submission.status,
          acknowledgedAt: new Date(),
        },
        "execution.acknowledged",
      );
      if (submission.status === "failed") {
        await this.store.transitionStep(
          context.workspaceId,
          context.runId,
          String(stepRun.stepId),
          "FAILED_KNOWN",
          "KeeperHub rejected the write before a successful result.",
        );
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "DEGRADED",
          "A step failed with a known provider result.",
        );
        return {};
      }
      return { delayMs: submission.status === "completed" ? 0 : 2000 };
    } catch (error) {
      if (
        error instanceof ProviderRequestError &&
        error.status === 429 &&
        !error.ambiguous
      ) {
        await this.store.updateAttempt(
          context.workspaceId,
          context.runId,
          attemptId,
          { status: "RATE_LIMITED" },
          "execution.rate_limited",
        );
        return { delayMs: error.retryAfterMs ?? 1000 };
      }
      const attempt = await this.store.connection
        .collection("execution_attempts")
        .findOne({
          workspaceId: context.workspaceId,
          executionAttemptId: attemptId,
        });
      await this.unknown(
        context,
        stepRun,
        attempt,
        error instanceof Error
          ? error.message
          : "Submission outcome is unknown.",
      );
      return {};
    }
  }
  private async pollAttempt(
    context: { workspaceId: string; runId: string; fencingToken: number },
    stepRun: Doc,
    attempt: Doc,
  ) {
    const { result, pollAfterMs } = await this.keeper.status(
      context.workspaceId,
      String(attempt.keeperHubExecutionId),
    );
    if (["pending", "running"].includes(result.status)) {
      await this.store.updateAttempt(
        context.workspaceId,
        context.runId,
        String(attempt.executionAttemptId),
        { providerStatus: result.status },
        "execution.pending",
      );
      return { delayMs: pollAfterMs };
    }
    if (result.status === "failed") {
      await this.store.updateAttempt(
        context.workspaceId,
        context.runId,
        String(attempt.executionAttemptId),
        {
          status: "FAILED",
          providerStatus: result.status,
          transactionHash: result.transactionHash ?? undefined,
          providerTransactionLink: result.transactionLink ?? undefined,
          providerError: result.error,
          terminalAt: new Date(),
        },
        "execution.failed",
      );
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        String(stepRun.stepId),
        "FAILED_KNOWN",
        "KeeperHub reports a known execution failure.",
      );
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "DEGRADED",
        "A step failed after submission.",
      );
      return {};
    }
    if (!result.transactionHash) {
      await this.unknown(
        context,
        stepRun,
        attempt,
        "KeeperHub completed without a transaction hash.",
      );
      return {};
    }
    await this.store.updateAttempt(
      context.workspaceId,
      context.runId,
      String(attempt.executionAttemptId),
      {
        status: "ACKNOWLEDGED",
        providerStatus: result.status,
        transactionHash: result.transactionHash,
        providerTransactionLink: result.transactionLink ?? undefined,
        terminalAt: result.completedAt
          ? new Date(result.completedAt)
          : undefined,
      },
      "execution.landed_provider_report",
    );
    await this.store.transitionStep(
      context.workspaceId,
      context.runId,
      String(stepRun.stepId),
      "EXECUTED",
      "KeeperHub returned a transaction. Independent verification is required.",
    );
    return {};
  }
  private async unknown(
    context: { workspaceId: string; runId: string; fencingToken: number },
    stepRun: Doc,
    attempt: Doc | null | undefined,
    reason: string,
  ) {
    if (!attempt) throw new Error(reason);
    await this.store.createReconciliation(
      context.workspaceId,
      context.runId,
      String(attempt.executionAttemptId),
      reason,
    );
    const currentStepRun = await this.store.connection
      .collection("mission_step_runs")
      .findOne({
        workspaceId: context.workspaceId,
        runId: context.runId,
        stepRunId: stepRun.stepRunId,
      });
    if (!currentStepRun)
      throw new Error("The step checkpoint is unavailable for reconciliation.");
    const state = stepStateSchema.parse(currentStepRun.state);
    if (state === "SUBMITTING" || state === "COMPENSATING")
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        String(currentStepRun.stepId),
        "OUTCOME_UNKNOWN",
        "Outcome unknown. Retry locked.",
      );
    const run = await this.store.connection
      .collection("mission_runs")
      .findOne({ workspaceId: context.workspaceId, runId: context.runId });
    if (run && run.state !== "RECONCILING")
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "RECONCILING",
        "Submission outcome is unknown. Checking provider and chain evidence.",
      );
  }

  private async reconcile(context: {
    workspaceId: string;
    runId: string;
    fencingToken: number;
    definition: MissionDefinition;
    steps: Doc[];
  }) {
    const stepRun = context.steps.find((item) =>
      ["OUTCOME_UNKNOWN", "RECONCILING"].includes(String(item.state)),
    );
    if (!stepRun) {
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "NEEDS_ATTENTION",
        "Reconciliation has no matching step evidence.",
      );
      return { stop: true };
    }
    if (stepRun.state === "OUTCOME_UNKNOWN")
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        String(stepRun.stepId),
        "RECONCILING",
        "Checking the original write without resubmitting.",
      );
    const attempt = await this.latestAttempt(
      context.workspaceId,
      String(stepRun.stepRunId),
    );
    if (!attempt) {
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        String(stepRun.stepId),
        "NEEDS_ATTENTION",
        "The original execution attempt cannot be found.",
      );
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "NEEDS_ATTENTION",
        "Reconciliation evidence is incomplete.",
      );
      return { stop: true };
    }
    if (attempt.transactionHash) {
      const receipt = await this.rpc.agreedReceipt(
        String(attempt.transactionHash),
        minimumConfirmations(),
      );
      if (!receipt || receipt.confirmations < minimumConfirmations())
        return { delayMs: 5000 };
      await this.resolveLanded(
        context,
        stepRun,
        attempt,
        receipt as unknown as Doc,
      );
      return {};
    }
    if (attempt.keeperHubExecutionId) {
      try {
        const status = await this.keeper.status(
          context.workspaceId,
          String(attempt.keeperHubExecutionId),
        );
        if (["pending", "running"].includes(status.result.status))
          return { delayMs: status.pollAfterMs };
        if (status.result.transactionHash) {
          await this.store.updateAttempt(
            context.workspaceId,
            context.runId,
            String(attempt.executionAttemptId),
            {
              transactionHash: status.result.transactionHash,
              providerTransactionLink:
                status.result.transactionLink ?? undefined,
            },
            "reconciliation.transaction_found",
          );
          return { delayMs: 1000 };
        }
      } catch {
        return { delayMs: 5000 };
      }
    }
    const definition = context.definition.steps.find(
      (item) => item.id === stepRun.stepId,
    );
    if (
      definition?.proof.kind === "EVENT" &&
      this.rpc.primary &&
      this.rpc.secondary &&
      attempt.observationStartBlock
    ) {
      const head = await this.rpc.primary.blockNumber();
      const fromBlock = BigInt(String(attempt.observationStartBlock));
      const topics = [definition.proof.topic0, ...definition.proof.indexed];
      const [primaryLogs, secondaryLogs] = await Promise.all([
        this.rpc.primary.logs({
          address: definition.proof.address,
          fromBlock,
          toBlock: head,
          topics,
        }),
        this.rpc.secondary.logs({
          address: definition.proof.address,
          fromBlock,
          toBlock: head,
          topics,
        }),
      ]);
      const primaryHashes = transactionHashes(primaryLogs);
      const secondaryHashes = transactionHashes(secondaryLogs);
      const transactionHash = [...primaryHashes].find((hash) =>
        secondaryHashes.has(hash),
      );
      if (transactionHash) {
        await this.store.updateAttempt(
          context.workspaceId,
          context.runId,
          String(attempt.executionAttemptId),
          { transactionHash },
          "reconciliation.transaction_found_onchain",
        );
        return { delayMs: 1000 };
      }
      const age = Date.now() - new Date(String(attempt.createdAt)).getTime();
      if (
        age >= numberEnv("AETHER_RECONCILIATION_WINDOW_MS", 300000) &&
        head >= fromBlock + BigInt(minimumConfirmations()) &&
        definition.retryClass !== "NON_REPLAYABLE"
      ) {
        await this.store.connection
          .collection("reconciliation_cases")
          .updateOne(
            { executionAttemptId: attempt.executionAttemptId },
            {
              $set: {
                state: "RESOLVED",
                resolution: "NOT_LANDED_SAFE_TO_RETRY",
                decisionRationale:
                  "Both RPC providers found no declared effect across the bounded observation window.",
                resolvedAt: new Date(),
                updatedAt: new Date(),
              },
            },
          );
        await this.store.updateAttempt(
          context.workspaceId,
          context.runId,
          String(attempt.executionAttemptId),
          {
            status: "NOT_LANDED",
            resubmissionLocked: false,
            terminalAt: new Date(),
          },
          "reconciliation.not_landed",
        );
        await this.store.transitionStep(
          context.workspaceId,
          context.runId,
          String(stepRun.stepId),
          "READY_TO_SUBMIT",
          "Both providers proved the declared effect did not land. A new attempt generation is allowed.",
          { attemptGeneration: Number(stepRun.attemptGeneration ?? 0) + 1 },
        );
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "EXECUTING",
          "The original effect did not land. Continuing with a new attempt generation.",
        );
        return {};
      }
    }
    const opened = new Date(String(attempt.createdAt)).getTime();
    if (
      Date.now() - opened <
      numberEnv("AETHER_RECONCILIATION_WINDOW_MS", 300000)
    )
      return { delayMs: 5000 };
    await this.store.connection.collection("reconciliation_cases").updateOne(
      { executionAttemptId: attempt.executionAttemptId },
      {
        $set: {
          state: "RESOLVED",
          resolution: "INDETERMINATE",
          decisionRationale:
            "Neither provider nor independently agreed chain evidence proved the outcome.",
          resolvedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    await this.store.transitionStep(
      context.workspaceId,
      context.runId,
      String(stepRun.stepId),
      "NEEDS_ATTENTION",
      "Outcome remains indeterminate. Retry remains locked.",
    );
    await this.store.transitionRun(
      context.workspaceId,
      context.runId,
      context.fencingToken,
      "NEEDS_ATTENTION",
      "Outcome remains indeterminate. No further write is permitted.",
    );
    return { stop: true };
  }
  private async resolveLanded(
    context: { workspaceId: string; runId: string; fencingToken: number },
    stepRun: Doc,
    attempt: Doc,
    receipt: Doc,
  ) {
    const observationId = await this.store.appendObservation(
      context.workspaceId,
      context.runId,
      String(stepRun.stepRunId),
      "rpc-consensus",
      receipt,
    );
    await this.store.connection.collection("reconciliation_cases").updateOne(
      { executionAttemptId: attempt.executionAttemptId },
      {
        $set: {
          state: "RESOLVED",
          resolution: "LANDED",
          evidenceIds: [observationId],
          decisionRationale:
            "Two RPC providers agree on the canonical receipt.",
          resolvedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    await this.store.updateAttempt(
      context.workspaceId,
      context.runId,
      String(attempt.executionAttemptId),
      {
        status: "CONFIRMED",
        transactionHash: receipt.transactionHash,
        resubmissionLocked: false,
        terminalAt: new Date(),
      },
      "reconciliation.original_write_landed",
    );
    const plan = await this.store.connection
      .collection("operation_plans")
      .findOne({ workspaceId: context.workspaceId, planId: attempt.planId });
    if (plan?.kind === "COMPENSATION") {
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        String(stepRun.stepId),
        "COMPENSATING",
        "Original recovery write landed. It will not be resubmitted.",
      );
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "RECOVERING",
        "Original recovery write landed. Continuing without resubmission.",
      );
    } else {
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        String(stepRun.stepId),
        "EXECUTED",
        "Original write landed. It will not be resubmitted.",
      );
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "EXECUTING",
        "Original write landed. Continuing without resubmission.",
      );
    }
  }

  private async recover(context: {
    workspaceId: string;
    runId: string;
    fencingToken: number;
    definition: MissionDefinition;
    version: Doc;
    steps: Doc[];
  }) {
    const inProgress = context.steps.find(
      (run) => run.state === "COMPENSATING",
    );
    if (inProgress) return this.continueRecoveryAttempt(context, inProgress);
    const candidates = [...context.steps]
      .reverse()
      .filter((run) => run.state === "VERIFIED");
    const target = candidates.find(
      (run) =>
        context.definition.steps.find((step) => step.id === run.stepId)
          ?.compensation,
    );
    if (!target) {
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "VERIFYING_RECOVERY",
        "Declared recovery actions are complete. Verifying the safe state.",
      );
      return {};
    }
    const step = context.definition.steps.find(
      (item) => item.id === target.stepId,
    )!;
    const compensation = step.compensation!;
    const spent = context.steps
      .filter((item) => item.state === "COMPENSATED")
      .reduce(
        (total, item) =>
          total +
          BigInt(
            context.definition.steps.find(
              (definition) => definition.id === item.stepId,
            )?.compensation?.action.valueWei ?? "0",
          ),
        0n,
      );
    if (
      spent + BigInt(compensation.action.valueWei) >
      BigInt(context.definition.recoveryPolicy.maxRecoverySpendWei)
    ) {
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "NEEDS_ATTENTION",
        "Recovery exceeds the authorized spending limit.",
      );
      return { stop: true };
    }
    await this.store.transitionStep(
      context.workspaceId,
      context.runId,
      String(target.stepId),
      "COMPENSATING",
      "Executing the declared recovery action.",
    );
    let simulation: Doc;
    try {
      simulation = (await this.keeper.simulate(
        context.workspaceId,
        compensation.action,
      )) as unknown as Doc;
    } catch {
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        String(target.stepId),
        "NEEDS_ATTENTION",
        "Recovery simulation failed. Nothing was broadcast.",
      );
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "NEEDS_ATTENTION",
        "Recovery cannot proceed safely.",
      );
      return { stop: true };
    }
    if (!simulation.success || simulation.wouldRevert) {
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        String(target.stepId),
        "NEEDS_ATTENTION",
        "Recovery simulation predicts failure.",
      );
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "NEEDS_ATTENTION",
        "Recovery cannot proceed safely.",
      );
      return { stop: true };
    }
    const plan = await this.store.persistPlanAndSimulation({
      workspaceId: context.workspaceId,
      runId: context.runId,
      stepRunId: String(target.stepRunId),
      stepId: compensation.id,
      generation: Number(target.attemptGeneration ?? 0) + 1,
      kind: "COMPENSATION",
      action: compensation.action,
      proof: compensation.proof,
      missionVersionHash: String(context.version.hash),
      simulation,
    });
    if (!context.definition.authorityPolicy.autoApproveRecovery) {
      const approval = await this.store.requestApproval(
        context.workspaceId,
        context.runId,
        plan.planHash,
        "RECOVERY",
      );
      await this.store.transitionRun(
        context.workspaceId,
        context.runId,
        context.fencingToken,
        "AWAITING_APPROVAL",
        "Recovery requires approval.",
        { approvalId: approval.approvalId },
      );
      return { stop: true };
    }
    if (!this.rpc.primary)
      throw new Error("Primary Sepolia RPC is unavailable.");
    const attempt = await this.store.createAttempt({
      workspaceId: context.workspaceId,
      runId: context.runId,
      stepRunId: String(target.stepRunId),
      generation: Number(target.attemptGeneration ?? 0) + 1,
      operationKey: plan.operationKey,
      planId: plan.planId,
      requestHash: plan.requestBodyHash,
      fencingToken: context.fencingToken,
      observationStartBlock: (await this.rpc.primary.blockNumber()).toString(),
    });
    try {
      const submission = await this.keeper.submit(
        context.workspaceId,
        attempt.keeperHubIdempotencyKey,
        compensation.action,
      );
      await this.store.updateAttempt(
        context.workspaceId,
        context.runId,
        attempt.executionAttemptId,
        {
          status: "ACKNOWLEDGED",
          keeperHubExecutionId: submission.executionId,
          providerStatus: submission.status,
          acknowledgedAt: new Date(),
        },
        "recovery.acknowledged",
      );
      return { delayMs: submission.status === "completed" ? 0 : 2000 };
    } catch (error) {
      const stored = await this.store.connection
        .collection("execution_attempts")
        .findOne({ executionAttemptId: attempt.executionAttemptId });
      await this.unknown(
        context,
        target,
        stored,
        error instanceof Error ? error.message : "Recovery outcome is unknown.",
      );
      return {};
    }
  }

  private async continueRecoveryAttempt(
    context: {
      workspaceId: string;
      runId: string;
      fencingToken: number;
      definition: MissionDefinition;
    },
    target: Doc,
  ) {
    const step = context.definition.steps.find(
      (item) => item.id === target.stepId,
    );
    if (!step?.compensation)
      throw new Error("Recovery definition is unavailable.");
    let attempt = await this.latestAttempt(
      context.workspaceId,
      String(target.stepRunId),
    );
    if (!attempt) {
      const plan = await this.store.connection
        .collection("operation_plans")
        .findOne(
          {
            workspaceId: context.workspaceId,
            runId: context.runId,
            stepRunId: target.stepRunId,
            kind: "COMPENSATION",
          },
          { sort: { createdAt: -1 } },
        );
      if (!plan || !this.rpc.primary)
        throw new Error("Approved recovery plan is unavailable.");
      const created = await this.store.createAttempt({
        workspaceId: context.workspaceId,
        runId: context.runId,
        stepRunId: String(target.stepRunId),
        generation: Number(target.attemptGeneration ?? 0) + 1,
        operationKey: String(plan.operationKey),
        planId: String(plan.planId),
        requestHash: String(plan.requestBodyHash),
        fencingToken: context.fencingToken,
        observationStartBlock: (
          await this.rpc.primary.blockNumber()
        ).toString(),
      });
      try {
        const submission = await this.keeper.submit(
          context.workspaceId,
          created.keeperHubIdempotencyKey,
          step.compensation.action,
        );
        await this.store.updateAttempt(
          context.workspaceId,
          context.runId,
          created.executionAttemptId,
          {
            status: "ACKNOWLEDGED",
            keeperHubExecutionId: submission.executionId,
            providerStatus: submission.status,
            acknowledgedAt: new Date(),
          },
          "recovery.acknowledged",
        );
        return { delayMs: submission.status === "completed" ? 0 : 2000 };
      } catch (error) {
        attempt = await this.latestAttempt(
          context.workspaceId,
          String(target.stepRunId),
        );
        await this.unknown(
          context,
          target,
          attempt,
          error instanceof Error
            ? error.message
            : "Recovery outcome is unknown.",
        );
        return {};
      }
    }
    try {
      if (attempt.transactionHash) {
        const receipt = await this.rpc.agreedReceipt(
          String(attempt.transactionHash),
          minimumConfirmations(),
        );
        if (!receipt || receipt.confirmations < minimumConfirmations())
          return { delayMs: 5000 };
        if (!receipt.success)
          throw new Error("Recovery transaction failed onchain.");
        const proof = await this.verifyProof(
          step.compensation.proof,
          receipt as unknown as Doc,
        );
        if (proof.result === "UNKNOWN") return { delayMs: 5000 };
        if (proof.result === "FAIL")
          throw new Error("Recovery postcondition did not pass.");
        await this.store.appendObservation(
          context.workspaceId,
          context.runId,
          String(target.stepRunId),
          "rpc-consensus",
          receipt as unknown as Doc,
        );
        await this.store.updateAttempt(
          context.workspaceId,
          context.runId,
          String(attempt.executionAttemptId),
          {
            status: "CONFIRMED",
            terminalAt: new Date(),
            resubmissionLocked: false,
          },
          "recovery.verified",
        );
        await this.store.transitionStep(
          context.workspaceId,
          context.runId,
          String(target.stepId),
          "COMPENSATED",
          "Recovery action independently verified.",
        );
        return {};
      }
      if (!attempt.keeperHubExecutionId) {
        await this.unknown(
          context,
          target,
          attempt,
          "Recovery request has no provider acknowledgement.",
        );
        return {};
      }
      const poll = await this.keeper.status(
        context.workspaceId,
        String(attempt.keeperHubExecutionId),
      );
      if (["pending", "running"].includes(poll.result.status))
        return { delayMs: poll.pollAfterMs };
      if (poll.result.status === "failed") {
        await this.store.updateAttempt(
          context.workspaceId,
          context.runId,
          String(attempt.executionAttemptId),
          {
            status: "FAILED",
            providerStatus: poll.result.status,
            transactionHash: poll.result.transactionHash ?? undefined,
            providerTransactionLink: poll.result.transactionLink ?? undefined,
            terminalAt: new Date(),
          },
          "recovery.failed",
        );
        await this.store.transitionStep(
          context.workspaceId,
          context.runId,
          String(target.stepId),
          "NEEDS_ATTENTION",
          "The compensation failed. No undeclared retry is permitted.",
        );
        await this.store.transitionRun(
          context.workspaceId,
          context.runId,
          context.fencingToken,
          "NEEDS_ATTENTION",
          "Recovery did not reach the authorized safe state.",
        );
        return { stop: true };
      }
      if (!poll.result.transactionHash) {
        await this.unknown(
          context,
          target,
          attempt,
          "Recovery completed without a transaction hash.",
        );
        return {};
      }
      await this.store.updateAttempt(
        context.workspaceId,
        context.runId,
        String(attempt.executionAttemptId),
        {
          status: "ACKNOWLEDGED",
          providerStatus: poll.result.status,
          transactionHash: poll.result.transactionHash,
          providerTransactionLink: poll.result.transactionLink ?? undefined,
          terminalAt: poll.result.completedAt
            ? new Date(poll.result.completedAt)
            : undefined,
        },
        "recovery.landed_provider_report",
      );
      const receipt = await this.rpc.agreedReceipt(
        poll.result.transactionHash,
        minimumConfirmations(),
      );
      if (!receipt || receipt.confirmations < minimumConfirmations())
        return { delayMs: 5000 };
      if (!receipt.success)
        throw new Error("Recovery transaction failed onchain.");
      const proof = await this.verifyProof(
        step.compensation.proof,
        receipt as unknown as Doc,
      );
      if (proof.result === "UNKNOWN") return { delayMs: 5000 };
      if (proof.result === "FAIL")
        throw new Error("Recovery postcondition did not pass.");
      await this.store.appendObservation(
        context.workspaceId,
        context.runId,
        String(target.stepRunId),
        "rpc-consensus",
        receipt as unknown as Doc,
      );
      await this.store.updateAttempt(
        context.workspaceId,
        context.runId,
        String(attempt.executionAttemptId),
        {
          status: "CONFIRMED",
          transactionHash: poll.result.transactionHash,
          providerTransactionLink: poll.result.transactionLink ?? undefined,
          terminalAt: new Date(),
        },
        "recovery.verified",
      );
      await this.store.transitionStep(
        context.workspaceId,
        context.runId,
        String(target.stepId),
        "COMPENSATED",
        "Recovery action independently verified.",
      );
      return {};
    } catch (error) {
      await this.unknown(
        context,
        target,
        attempt,
        error instanceof Error ? error.message : "Recovery outcome is unknown.",
      );
      return {};
    }
  }

  private async verifyProof(
    proof: MissionDefinition["steps"][number]["proof"],
    receipt: Doc,
  ): Promise<{ result: "PASS" | "FAIL" | "UNKNOWN"; evidence: unknown }> {
    if (proof.kind === "RECEIPT")
      return {
        result:
          Number(receipt.confirmations ?? 0) >= proof.confirmations &&
          receipt.canonical === true &&
          receipt.success === true
            ? "PASS"
            : "UNKNOWN",
        evidence: receipt,
      };
    if (proof.kind === "EVENT") {
      const logs = Array.isArray(receipt.logs) ? (receipt.logs as Doc[]) : [];
      const match = logs.some(
        (log) =>
          String(log.address).toLowerCase() === proof.address.toLowerCase() &&
          Array.isArray(log.topics) &&
          String((log.topics as unknown[])[0]).toLowerCase() ===
            proof.topic0.toLowerCase() &&
          proof.indexed.every(
            (topic, index) =>
              String((log.topics as unknown[])[index + 1]).toLowerCase() ===
              topic.toLowerCase(),
          ) &&
          log.removed !== true,
      );
      return {
        result: match ? "PASS" : "FAIL",
        evidence: { matchingEvent: match },
      };
    }
    if (!this.rpc.primary || !this.rpc.secondary)
      return { result: "UNKNOWN", evidence: "Two RPC providers are required." };
    const action = proofReadAction(proof);
    const [primary, secondary] = await Promise.all([
      this.rpc.primary.call(action),
      this.rpc.secondary.call(action),
    ]);
    if (normalized(primary) !== normalized(secondary))
      return { result: "UNKNOWN", evidence: { providerDisagreement: true } };
    const actual = scalar(primary);
    const expected =
      proof.kind === "CONTRACT_READ" ? proof.expected : proof.amount;
    const operator =
      proof.kind === "CONTRACT_READ" ? proof.operator : proof.operator;
    return {
      result: compare(actual, expected, operator) ? "PASS" : "FAIL",
      evidence: { actual, expected, operator },
    };
  }

  private async evaluateInvariants(
    workspaceId: string,
    runId: string,
    definition: MissionDefinition,
  ) {
    const attempts = await this.store.connection
      .collection("execution_attempts")
      .find({ workspaceId, runId })
      .toArray();
    const [primaryChain, secondaryChain] =
      this.rpc.primary && this.rpc.secondary
        ? await Promise.all([
            this.rpc.primary.chainId(),
            this.rpc.secondary.chainId(),
          ])
        : [0, 0];
    const results: Array<{
      invariantId: string;
      result: "PASS" | "FAIL" | "UNKNOWN";
      evidence?: unknown;
    }> = [];
    for (const invariant of definition.invariants) {
      let result: "PASS" | "FAIL" | "UNKNOWN" = "UNKNOWN";
      let evidence: unknown;
      if (invariant.kind === "CHAIN_ID") {
        result =
          primaryChain === 11155111 && secondaryChain === 11155111
            ? "PASS"
            : "FAIL";
        evidence = { primaryChain, secondaryChain };
      } else if (invariant.kind === "TARGET_ALLOWLIST") {
        const allowed = new Set(
          definition.authorityPolicy.allowedTargets.map((value) =>
            value.toLowerCase(),
          ),
        );
        result = definition.steps.every((step) =>
          allowed.has(step.action.contractAddress.toLowerCase()),
        )
          ? "PASS"
          : "FAIL";
      } else if (invariant.kind === "FUNCTION_ALLOWLIST") {
        const allowed = new Set(definition.authorityPolicy.allowedFunctions);
        result = definition.steps.every((step) =>
          allowed.has(step.action.functionName),
        )
          ? "PASS"
          : "FAIL";
      } else if (invariant.kind === "NO_UNKNOWN_ATTEMPTS") {
        const unresolved = attempts.filter(
          (attempt) =>
            attempt.resubmissionLocked ||
            ["SUBMITTING", "RECONCILING", "UNKNOWN"].includes(
              String(attempt.status),
            ),
        ).length;
        result = unresolved === 0 ? "PASS" : "FAIL";
        evidence = { unresolved };
      } else if (invariant.kind === "MAX_WRITES") {
        const maximum = Number(invariant.parameters.maximum ?? "0");
        const writes = attempts.filter(
          (attempt) => attempt.status === "CONFIRMED",
        ).length;
        result =
          Number.isSafeInteger(maximum) && writes <= maximum ? "PASS" : "FAIL";
        evidence = { writes, maximum };
      } else if (invariant.kind === "DEADLINE") {
        const deadline = Date.parse(String(invariant.parameters.isoTime ?? ""));
        result =
          Number.isFinite(deadline) && Date.now() <= deadline ? "PASS" : "FAIL";
        evidence = { deadline: invariant.parameters.isoTime };
      } else {
        try {
          const proof = invariantProof(invariant);
          const checked = await this.verifyProof(proof, {});
          result = checked.result;
          evidence = checked.evidence;
        } catch (error) {
          result = "UNKNOWN";
          evidence =
            error instanceof Error
              ? error.message
              : "Invariant could not be evaluated.";
        }
      }
      results.push({ invariantId: invariant.id, result, evidence });
    }
    return results;
  }

  private async latestAttempt(workspaceId: string, stepRunId: string) {
    return this.store.connection
      .collection("execution_attempts")
      .findOne(
        { workspaceId, stepRunId },
        { sort: { generation: -1, createdAt: -1 } },
      );
  }
  private async failClosed(
    workspaceId: string,
    runId: string,
    fencingToken: number,
    error: unknown,
  ) {
    const run = await this.store.connection
      .collection("mission_runs")
      .findOne({ workspaceId, runId });
    if (
      !run ||
      TERMINAL_MISSION_STATES.has(missionStateSchema.parse(run.state))
    )
      return;
    const message = error instanceof Error ? error.message : "Runtime failure.";
    if (run.state === "SUBMITTING" || run.state === "RECONCILING") return;
    const target: MissionState = [
      "EXECUTING",
      "VERIFYING",
      "RECOVERING",
      "VERIFYING_RECOVERY",
    ].includes(String(run.state))
      ? "NEEDS_ATTENTION"
      : "NEEDS_ATTENTION";
    if (missionStateSchema.parse(run.state) !== target)
      await this.store.transitionRun(
        workspaceId,
        runId,
        fencingToken,
        target,
        `Execution stopped safely: ${message.slice(0, 300)}`,
      );
  }
}

export function retryableRunError(error: unknown) {
  if (!(error instanceof ProviderRequestError)) return undefined;
  const retryableStatus =
    error.status === 408 ||
    error.status === 425 ||
    error.status === 429 ||
    (error.status !== undefined && error.status >= 500);
  const retryableCode = [
    "RPC_TEMPORARY_FAILURE",
    "RPC_INVALID_RESPONSE",
    "RPC_DISAGREEMENT",
  ].includes(String(error.code));
  if (!retryableStatus && !retryableCode) return undefined;
  return {
    reason: error.message,
    retryAfterMs: error.retryAfterMs,
  };
}

export function retryDelayMs(attempt: number, providerDelay?: number) {
  if (providerDelay !== undefined)
    return Math.min(60_000, Math.max(1_000, providerDelay));
  return Math.min(60_000, 5_000 * 2 ** Math.min(4, Math.max(0, attempt - 1)));
}

function simulationFailureEvidence(error: unknown): Doc {
  if (error instanceof ProviderRequestError) {
    return {
      success: false,
      wouldRevert: false,
      status: "unavailable",
      error: error.message.slice(0, 1_000),
      providerStatus: error.status ?? null,
      retryAfterMs: error.retryAfterMs ?? null,
      failureCode: error.code ?? "KEEPERHUB_REQUEST_FAILED",
    };
  }
  if (error instanceof z.ZodError) {
    return {
      success: false,
      wouldRevert: false,
      status: "invalid_response",
      error:
        "KeeperHub returned a response that failed local schema validation.",
      failureCode: "KEEPERHUB_INVALID_RESPONSE",
      validationIssues: error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.map(String).join("."),
        code: issue.code,
      })),
    };
  }
  return {
    success: false,
    wouldRevert: false,
    status: "unavailable",
    error: "KeeperHub simulation did not produce usable evidence.",
    failureCode: "KEEPERHUB_SIMULATION_UNAVAILABLE",
  };
}

function minimumConfirmations() {
  return numberEnv("AETHER_MIN_CONFIRMATIONS", 3);
}
function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer.`);
  return value;
}
function requiredText(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
function transactionHashes(logs: unknown[]) {
  return new Set(
    logs.flatMap((log) =>
      typeof log === "object" &&
      log &&
      "transactionHash" in log &&
      typeof log.transactionHash === "string"
        ? [log.transactionHash.toLowerCase()]
        : [],
    ),
  );
}
function normalized(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );
}
function scalar(value: unknown): string {
  const item = Array.isArray(value) && value.length === 1 ? value[0] : value;
  return typeof item === "bigint" ? item.toString() : String(item);
}
function compare(
  actual: string,
  expected: string,
  operator: "EQ" | "NEQ" | "GTE" | "LTE",
) {
  if (operator === "EQ") return actual === expected;
  if (operator === "NEQ") return actual !== expected;
  try {
    const left = BigInt(actual);
    const right = BigInt(expected);
    return operator === "GTE" ? left >= right : left <= right;
  } catch {
    return false;
  }
}
const erc20ReadAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
];
function proofReadAction(proof: MissionDefinition["steps"][number]["proof"]) {
  if (proof.kind === "ERC20_BALANCE")
    return {
      contractAddress: proof.token,
      functionName: "balanceOf",
      functionArgs: [proof.account],
      abi: erc20ReadAbi,
    };
  if (proof.kind === "ERC20_ALLOWANCE")
    return {
      contractAddress: proof.token,
      functionName: "allowance",
      functionArgs: [proof.owner, proof.spender],
      abi: erc20ReadAbi,
    };
  if (proof.kind === "CONTRACT_READ")
    return {
      contractAddress: proof.address,
      functionName: proof.functionName,
      functionArgs: proof.args,
      abi: proof.abi,
    };
  throw new Error("Proof is not a contract read.");
}
function invariantProof(
  invariant: MissionDefinition["invariants"][number],
): MissionDefinition["steps"][number]["proof"] {
  const value = (key: string) => {
    const item = invariant.parameters[key];
    if (typeof item !== "string")
      throw new Error(`Invariant parameter ${key} is required.`);
    return item;
  };
  const operator = value("operator") as "EQ" | "GTE" | "LTE";
  if (invariant.kind === "ERC20_BALANCE")
    return {
      kind: "ERC20_BALANCE",
      token: value("token"),
      account: value("account"),
      operator,
      amount: value("amount"),
    } as MissionDefinition["steps"][number]["proof"];
  if (invariant.kind === "ERC20_ALLOWANCE")
    return {
      kind: "ERC20_ALLOWANCE",
      token: value("token"),
      owner: value("owner"),
      spender: value("spender"),
      operator,
      amount: value("amount"),
    } as MissionDefinition["steps"][number]["proof"];
  if (invariant.kind === "CONTRACT_READ")
    return {
      kind: "CONTRACT_READ",
      address: value("address"),
      functionName: value("functionName"),
      args: (invariant.parameters.args as string[] | undefined) ?? [],
      abi: JSON.parse(value("abi")) as Record<string, unknown>[],
      operator,
      expected: value("expected"),
    } as MissionDefinition["steps"][number]["proof"];
  throw new Error("Invariant kind has no chain proof evaluator.");
}
