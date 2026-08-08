import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aetherClient, safeAetherError } from "@/server/aether";
import { configuration } from "@/server/config";
import {
  idempotencyKey,
  missionFor,
  resolveIntent,
  SavingsInputError,
} from "@/server/mission";
import {
  assertMutationOrigin,
  issueRunViewToken,
  requireWalletSession,
  SessionError,
} from "@/server/session";
import { lendingMissionFor, LendingConfigurationError } from "@/server/lending";

const requestSchema = z
  .object({
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .max(80),
    borrowAmount: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .max(80)
      .optional(),
    clientRequestId: z.string().uuid(),
    scenario: z.enum(["NORMAL", "BLOCKED_BORROWING"]).default("NORMAL"),
  })
  .strict();
const missionResponseSchema = z
  .object({ missionId: z.string().min(1) })
  .passthrough();
const runResponseSchema = z.object({ runId: z.string().min(1) }).passthrough();

export async function POST(request: NextRequest) {
  try {
    assertMutationOrigin(request);
    const beneficiary = await requireWalletSession();
    const lending =
      new URL(request.url).searchParams.get("product") === "lending";
    const config = configuration();
    if (
      lending
        ? !config.lendingLiveExecutionEnabled
        : !config.liveExecutionEnabled
    ) {
      return NextResponse.json(
        {
          code: "LIVE_EXECUTION_DISABLED",
          message: `Live ${lending ? "lending" : "savings"} execution is disabled. No mission or transaction was created.`,
        },
        { status: 503 },
      );
    }
    const input = requestSchema.parse(await request.json());
    if (!lending && input.scenario !== "NORMAL") {
      return NextResponse.json(
        {
          code: "INVALID_AGENT_REQUEST",
          message: "The selected scenario is available only for lending.",
        },
        { status: 400 },
      );
    }
    const intent = lending
      ? undefined
      : resolveIntent(beneficiary, input.amount, input.clientRequestId);
    const missionInput = lending
      ? lendingMissionFor(
          beneficiary,
          input.amount,
          input.borrowAmount ?? "",
          input.clientRequestId,
          input.scenario,
        )
      : missionFor(intent!);
    const client = aetherClient();
    const mission = missionResponseSchema.parse(
      await client.createMission(
        missionInput,
        idempotencyKey("mission", missionInput),
      ),
    );
    const runRequest = {
      input: {},
      externalId: `${lending ? `lending:${input.scenario.toLowerCase()}` : "savings"}:${input.clientRequestId}`,
    };
    const run = runResponseSchema.parse(
      await client.createRun(
        mission.missionId,
        runRequest,
        idempotencyKey("run", { missionId: mission.missionId, ...runRequest }),
      ),
    );
    return NextResponse.json(
      {
        runId: run.runId,
        missionId: mission.missionId,
        viewToken: issueRunViewToken(run.runId, beneficiary),
        operationKey:
          intent?.operationKey ??
          `lending:${input.scenario.toLowerCase()}:${input.clientRequestId}`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json(
        { code: "AUTHENTICATION_REQUIRED", message: error.message },
        { status: error.status },
      );
    }
    if (
      error instanceof z.ZodError ||
      error instanceof SavingsInputError ||
      error instanceof LendingConfigurationError
    ) {
      return NextResponse.json(
        {
          code: "INVALID_AGENT_REQUEST",
          message:
            error instanceof SavingsInputError ||
            error instanceof LendingConfigurationError
              ? error.message
              : "The agent request is invalid.",
        },
        { status: 400 },
      );
    }
    const normalized = safeAetherError(error);
    return NextResponse.json(normalized.body, { status: normalized.status });
  }
}
