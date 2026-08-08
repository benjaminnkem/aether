import { NextResponse } from "next/server";
import { configuration } from "@/server/config";
import { requireApplicationSession, SessionError } from "@/server/session";

export async function GET() {
  try {
    await requireApplicationSession();
    const config = configuration();
    return NextResponse.json({
      chainId: 11155111,
      chainName: "Ethereum Sepolia",
      liveExecutionEnabled: config.liveExecutionEnabled,
      vaultAddress: config.vaultAddress,
      tokenAddress: config.tokenAddress,
      tokenSymbol: config.tokenSymbol,
      tokenDecimals: config.tokenDecimals,
      minimumAmount: config.minimumAmount,
      maximumAmount: config.maximumAmount,
      executorAddress: config.executorAddress,
      explorerUrl: config.explorerUrl,
    });
  } catch (error) {
    const status = error instanceof SessionError ? error.status : 503;
    return NextResponse.json(
      {
        code: "CONFIGURATION_UNAVAILABLE",
        message:
          error instanceof Error
            ? error.message
            : "Configuration is unavailable.",
      },
      { status },
    );
  }
}
