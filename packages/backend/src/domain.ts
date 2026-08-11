import { createHash } from "node:crypto";
import type { MissionState, StepState } from "@aether/shared";

export class DomainTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Invalid state transition: ${from} -> ${to}`);
    this.name = "DomainTransitionError";
  }
}

const missionTransitions: Readonly<
  Record<MissionState, readonly MissionState[]>
> = {
  DRAFT: ["READY", "ABORTED_SAFE"],
  READY: ["PREFLIGHT", "PAUSED", "ABORTED_SAFE"],
  PREFLIGHT: [
    "EXECUTING",
    "AWAITING_APPROVAL",
    "DEGRADED",
    "PAUSED",
    "ABORTED_SAFE",
    "NEEDS_ATTENTION",
  ],
  EXECUTING: [
    "VERIFYING",
    "RECONCILING",
    "DEGRADED",
    "PAUSED",
    "AWAITING_APPROVAL",
    "NEEDS_ATTENTION",
  ],
  VERIFYING: [
    "EXECUTING",
    "COMPLETED",
    "RECONCILING",
    "DEGRADED",
    "NEEDS_ATTENTION",
  ],
  RECONCILING: [
    "EXECUTING",
    "VERIFYING",
    "RECOVERING",
    "DEGRADED",
    "NEEDS_ATTENTION",
  ],
  DEGRADED: [
    "INVESTIGATING",
    "RECOVERING",
    "AWAITING_APPROVAL",
    "NEEDS_ATTENTION",
  ],
  INVESTIGATING: ["RECOVERING", "AWAITING_APPROVAL", "NEEDS_ATTENTION"],
  AWAITING_APPROVAL: ["EXECUTING", "RECOVERING", "NEEDS_ATTENTION", "PAUSED"],
  RECOVERING: [
    "VERIFYING_RECOVERY",
    "RECONCILING",
    "AWAITING_APPROVAL",
    "NEEDS_ATTENTION",
  ],
  VERIFYING_RECOVERY: [
    "RECOVERING",
    "RECOVERED",
    "RECONCILING",
    "NEEDS_ATTENTION",
  ],
  PAUSED: [
    "PREFLIGHT",
    "EXECUTING",
    "RECONCILING",
    "RECOVERING",
    "ABORTED_SAFE",
  ],
  COMPLETED: [],
  RECOVERED: [],
  NEEDS_ATTENTION: ["RECONCILING"],
  ABORTED_SAFE: [],
};

const stepTransitions: Readonly<Record<StepState, readonly StepState[]>> = {
  PENDING: ["PRECONDITION_CHECK", "SKIPPED"],
  PRECONDITION_CHECK: ["SIMULATING", "FAILED_KNOWN", "NEEDS_ATTENTION"],
  SIMULATING: ["SIMULATION_FAILED", "AWAITING_APPROVAL", "READY_TO_SUBMIT"],
  SIMULATION_FAILED: ["COMPENSATING", "NEEDS_ATTENTION"],
  AWAITING_APPROVAL: ["READY_TO_SUBMIT", "COMPENSATING", "NEEDS_ATTENTION"],
  READY_TO_SUBMIT: ["SUBMITTING"],
  SUBMITTING: ["OUTCOME_UNKNOWN", "EXECUTED", "FAILED_KNOWN"],
  OUTCOME_UNKNOWN: ["RECONCILING"],
  RECONCILING: [
    "EXECUTED",
    "READY_TO_SUBMIT",
    "COMPENSATING",
    "NEEDS_ATTENTION",
  ],
  EXECUTED: ["VERIFYING"],
  VERIFYING: ["VERIFIED", "RECONCILING", "FAILED_KNOWN", "NEEDS_ATTENTION"],
  VERIFIED: ["COMPENSATING"],
  FAILED_KNOWN: ["COMPENSATING", "NEEDS_ATTENTION"],
  COMPENSATING: [
    "COMPENSATED",
    "OUTCOME_UNKNOWN",
    "FAILED_KNOWN",
    "NEEDS_ATTENTION",
  ],
  COMPENSATED: [],
  NEEDS_ATTENTION: [],
  SKIPPED: [],
};

export function assertMissionTransition(
  from: MissionState,
  to: MissionState,
): void {
  if (!missionTransitions[from].includes(to))
    throw new DomainTransitionError(from, to);
}
export function assertStepTransition(from: StepState, to: StepState): void {
  if (!stepTransitions[from].includes(to))
    throw new DomainTransitionError(from, to);
}
export function canonicalize(value: unknown): string {
  const visit = (input: unknown): unknown =>
    Array.isArray(input)
      ? input.map(visit)
      : input && typeof input === "object"
        ? Object.fromEntries(
            Object.entries(input as Record<string, unknown>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, item]) => [key, visit(item)]),
          )
        : input;
  return JSON.stringify(visit(value));
}
export function contentHash(value: unknown): string {
  return `0x${createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}
export function operationKey(
  runId: string,
  stepId: string,
  kind: "FORWARD" | "COMPENSATION",
  generation: number,
): string {
  return createHash("sha256")
    .update(`${runId}:${stepId}:${kind}:${generation}`)
    .digest("hex");
}
