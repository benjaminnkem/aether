import {
  policyEnvelopeSchema,
  simulationResultSchema,
  transactionRequestSchema,
  type PolicyEnvelope,
  type TransactionRequest,
  type BoundApproval,
} from "./contracts";
import { stableHash } from "./security";

export interface SafetyInput {
  request: TransactionRequest;
  policy: PolicyEnvelope;
  planHash: string;
  simulation: unknown;
  approvals: BoundApproval[];
  now?: Date;
}

export class SafetyViolation extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SafetyViolation";
  }
}

export class ExecutionSafety {
  static planHash(request: TransactionRequest, desiredStateVersionId: string) {
    return stableHash({
      desiredStateVersionId,
      request: transactionRequestSchema.parse(request),
    });
  }

  authorize(input: SafetyInput): void {
    const request = transactionRequestSchema.parse(input.request);
    const policy = policyEnvelopeSchema.parse(input.policy);
    const simulation = simulationResultSchema.parse(input.simulation);
    const now = input.now ?? new Date();

    if (!policy.allowedChainIds.includes(request.chainId)) {
      throw new SafetyViolation(
        "CHAIN_NOT_ALLOWED",
        "Chain is not allowlisted.",
      );
    }
    if (
      !policy.allowedTargets.some(
        (target) => target.toLowerCase() === request.target.toLowerCase(),
      )
    ) {
      throw new SafetyViolation(
        "TARGET_NOT_ALLOWED",
        "Target is not allowlisted.",
      );
    }
    if (!policy.allowedFunctions.includes(request.functionSignature)) {
      throw new SafetyViolation(
        "FUNCTION_NOT_ALLOWED",
        "Function is not allowlisted.",
      );
    }
    if (BigInt(request.valueWei) > BigInt(policy.maximumValueWei)) {
      throw new SafetyViolation(
        "VALUE_LIMIT_EXCEEDED",
        "Value exceeds policy.",
      );
    }
    if (request.valueWei !== "0") {
      throw new SafetyViolation(
        "MVP_ZERO_VALUE_REQUIRED",
        "The MVP correction must transfer zero value.",
      );
    }
    if (
      simulation.planHash !== input.planHash ||
      !simulation.success ||
      !simulation.postconditionMatched
    ) {
      throw new SafetyViolation(
        "SIMULATION_NOT_BOUND",
        "A successful exact-request simulation is required.",
      );
    }

    const distinctApprovers = new Set(
      input.approvals
        .filter(
          (approval) =>
            approval.decision === "approve" &&
            approval.planHash === input.planHash &&
            approval.simulationId === simulation.simulationId &&
            new Date(approval.expiresAt) > now,
        )
        .map((approval) => approval.actorId),
    );
    if (distinctApprovers.size < policy.approvalThreshold) {
      throw new SafetyViolation(
        "APPROVAL_THRESHOLD_NOT_MET",
        "Unexpired approvals bound to this plan and simulation are required.",
      );
    }
  }
}
