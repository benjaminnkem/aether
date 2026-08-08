import { NextResponse } from "next/server";
import { configuration } from "@/server/config";
import { requireApplicationSession, SessionError } from "@/server/session";

export async function GET(request: Request) {
  try {
    await requireApplicationSession();
    const config = configuration();
    const lending =
      new URL(request.url).searchParams.get("product") === "lending";
    return NextResponse.json({
      chainId: 11155111,
      chainName: "Ethereum Sepolia",
      liveExecutionEnabled: lending
        ? config.lendingLiveExecutionEnabled
        : config.liveExecutionEnabled,
      vaultAddress: config.vaultAddress,
      tokenAddress: config.tokenAddress,
      tokenSymbol: config.tokenSymbol,
      tokenDecimals: config.tokenDecimals,
      minimumAmount: config.minimumAmount,
      maximumAmount: config.maximumAmount,
      executorAddress: config.executorAddress,
      explorerUrl: config.explorerUrl,
      product: lending ? "lending" : "savings",
      ...(lending
        ? {
            vaultAddress: config.lendingPoolAddress ?? "",
            tokenAddress: config.lendingCollateralTokenAddress ?? "",
            tokenSymbol: config.lendingCollateralSymbol ?? "",
            tokenDecimals: config.lendingCollateralDecimals ?? 0,
            minimumAmount: config.lendingMinimumCollateral ?? "",
            maximumAmount: config.lendingMaximumCollateral ?? "",
            collateralAmount: config.lendingMinimumCollateral ?? "",
            borrowAmount: config.lendingBorrowAmount ?? "",
            minimumBorrowAmount: config.lendingMinimumBorrow ?? "",
            maximumBorrowAmount: config.lendingMaximumBorrow ?? "",
            borrowTokenSymbol: config.lendingBorrowSymbol ?? "",
            lendingPoolAddress: config.lendingPoolAddress ?? "",
            collateralTokenAddress: config.lendingCollateralTokenAddress ?? "",
            borrowTokenAddress: config.lendingBorrowTokenAddress ?? "",
          }
        : {}),
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
