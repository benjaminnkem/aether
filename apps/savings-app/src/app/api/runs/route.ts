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

const requestSchema = z
  .object({
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .max(80),
    clientRequestId: z.string().uuid(),
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
    if (!configuration().liveExecutionEnabled) {
      return NextResponse.json(
        {
          code: "LIVE_EXECUTION_DISABLED",
          message:
            "Live savings execution is disabled. No mission or transaction was created.",
        },
        { status: 503 },
      );
    }
    const input = requestSchema.parse(await request.json());
    const intent = resolveIntent(
      beneficiary,
      input.amount,
      input.clientRequestId,
    );
    const missionInput = missionFor(intent);
    const client = aetherClient();
    const mission = missionResponseSchema.parse(
      await client.createMission(
        missionInput,
        idempotencyKey("mission", missionInput),
      ),
    );
    const runRequest = {
      input: {},
      externalId: `savings:${input.clientRequestId}`,
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
        operationKey: intent.operationKey,
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
    if (error instanceof z.ZodError || error instanceof SavingsInputError) {
      return NextResponse.json(
        {
          code: "INVALID_SAVINGS_REQUEST",
          message:
            error instanceof SavingsInputError
              ? error.message
              : "Savings request is invalid.",
        },
        { status: 400 },
      );
    }
    const normalized = safeAetherError(error);
    return NextResponse.json(normalized.body, { status: normalized.status });
  }
}
