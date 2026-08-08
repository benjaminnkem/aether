import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  accessTokenMatches,
  assertMutationOrigin,
  clearSessions,
  establishApplicationSession,
  requireApplicationSession,
  SessionError,
} from "@/server/session";

const bodySchema = z
  .object({ accessToken: z.string().min(1).max(256) })
  .strict();

export async function GET() {
  try {
    await requireApplicationSession();
    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertMutationOrigin(request);
    const body = bodySchema.parse(await request.json());
    if (!accessTokenMatches(body.accessToken))
      throw new SessionError("Access code is invalid.", 401);
    const response = NextResponse.json({ authenticated: true });
    establishApplicationSession(response);
    return response;
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertMutationOrigin(request);
    const response = NextResponse.json({ authenticated: false });
    clearSessions(response);
    return response;
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown) {
  const status =
    error instanceof SessionError
      ? error.status
      : error instanceof z.ZodError
        ? 400
        : 500;
  const message =
    error instanceof Error ? error.message : "Session request failed.";
  return NextResponse.json({ code: "SESSION_ERROR", message }, { status });
}
