import { NextRequest, NextResponse } from "next/server";
import { aetherStream, safeAetherError } from "@/server/aether";
import { assertRunViewToken, SessionError } from "@/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  try {
    await assertRunViewToken(runId, request.headers.get("x-savings-run-token"));
    const after = Number(request.nextUrl.searchParams.get("after") ?? "0");
    const upstream = await aetherStream(
      runId,
      Number.isSafeInteger(after) && after >= 0 ? after : 0,
      request.signal,
    );
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        {
          code: "AETHER_STREAM_UNAVAILABLE",
          message: "The persisted run stream is unavailable.",
        },
        { status: upstream.status || 502 },
      );
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
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
