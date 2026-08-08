import {
  actionSchema,
  type MissionAction,
  type MissionDefinition,
} from "@aether/shared";
import { contentHash } from "./domain";

export class SafetyViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafetyViolation";
  }
}

export function validateAction(
  action: MissionAction,
  definition: MissionDefinition,
): MissionAction {
  const parsed = actionSchema.parse(action);
  if (parsed.chainId !== 11155111)
    throw new SafetyViolation(
      "Writes are restricted to Ethereum Sepolia 11155111.",
    );
  if (
    !definition.authorityPolicy.allowedTargets.some(
      (item) => item.toLowerCase() === parsed.contractAddress.toLowerCase(),
    )
  )
    throw new SafetyViolation(
      "Target is not authorized by the mission version.",
    );
  if (
    !definition.authorityPolicy.allowedFunctions.includes(parsed.functionName)
  )
    throw new SafetyViolation(
      "Function is not authorized by the mission version.",
    );
  if (
    BigInt(parsed.valueWei) > BigInt(definition.authorityPolicy.maximumValueWei)
  )
    throw new SafetyViolation("Native value exceeds the mission limit.");
  return parsed;
}

export function planHash(input: {
  missionVersionHash: string;
  runId: string;
  stepId: string;
  kind: "FORWARD" | "COMPENSATION";
  action: MissionAction;
  proof: unknown;
}): string {
  return contentHash(input);
}

export function assertSimulationBinding(
  plan: { requestBodyHash: string },
  broadcastAction: MissionAction,
): void {
  if (plan.requestBodyHash !== contentHash(broadcastAction))
    throw new SafetyViolation(
      "Broadcast request differs from the simulated request.",
    );
}
