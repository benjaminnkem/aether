import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAddress } from "viem";
import {
  assertMutationOrigin,
  establishWalletSession,
  requireApplicationSession,
  SessionError,
  verifyWalletChallenge,
} from "@/server/session";

const inputSchema = z
  .object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    assertMutationOrigin(request);
    await requireApplicationSession();
    const input = inputSchema.parse(await request.json());
    const address = await verifyWalletChallenge(
      getAddress(input.address),
      input.signature as `0x${string}`,
    );
    const response = NextResponse.json({ address });
    establishWalletSession(response, address);
    return response;
  } catch (error) {
    const status =
      error instanceof SessionError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : 500;
    return NextResponse.json(
      {
        code: "WALLET_VERIFICATION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Wallet verification failed.",
      },
      { status },
    );
  }
}
