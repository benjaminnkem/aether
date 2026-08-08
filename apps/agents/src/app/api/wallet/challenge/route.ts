import { NextRequest, NextResponse } from "next/server";
import {
  assertMutationOrigin,
  issueWalletChallenge,
  requireApplicationSession,
  SessionError,
} from "@/server/session";

export async function POST(request: NextRequest) {
  try {
    assertMutationOrigin(request);
    await requireApplicationSession();
    const response = NextResponse.json({ message: "" });
    const message = issueWalletChallenge(response);
    return NextResponse.json({ message }, { headers: response.headers });
  } catch (error) {
    return NextResponse.json(
      {
        code: "WALLET_CHALLENGE_FAILED",
        message:
          error instanceof Error ? error.message : "Wallet challenge failed.",
      },
      { status: error instanceof SessionError ? error.status : 500 },
    );
  }
}
