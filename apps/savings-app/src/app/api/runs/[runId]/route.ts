import { NextRequest, NextResponse } from "next/server";
import { aetherClient, safeAetherError } from "@/server/aether";
import { assertRunViewToken, SessionError } from "@/server/session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  try {
    await assertRunViewToken(runId, request.headers.get("x-savings-run-token"));
    return NextResponse.json(await aetherClient().run(runId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json(
        { code: "RUN_ACCESS_DENIED", message: error.message },
        { status: error.status },
      );
    }
    const normalized = safeAetherError(error);
    return NextResponse.json(normalized.body, { status: normalized.status });
  }
}
