import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FlightRecorder,
  type ActiveRun,
  type PublicConfiguration,
} from "./agent-application";

const config: PublicConfiguration = {
  chainId: 11155111,
  chainName: "Ethereum Sepolia",
  liveExecutionEnabled: true,
  vaultAddress: "0x1111111111111111111111111111111111111111",
  tokenAddress: "0x2222222222222222222222222222222222222222",
  tokenSymbol: "USDC",
  tokenDecimals: 6,
  minimumAmount: "1",
  maximumAmount: "10",
  executorAddress: "0x3333333333333333333333333333333333333333",
  explorerUrl: "https://sepolia.etherscan.io",
};

const activeRun: ActiveRun = {
  runId: "run_1",
  missionId: "mission_1",
  viewToken: "view_token",
  operationKey: "save_1",
};

describe("Savings flight recorder evidence", () => {
  it("shows run dates, KeeperHub IDs, and every Sepolia transaction link", () => {
    const forwardHash = `0x${"1".repeat(64)}`;
    const recoveryHash = `0x${"2".repeat(64)}`;
    render(
      <FlightRecorder
        config={config}
        activeRun={activeRun}
        events={[]}
        message=""
        run={{
          runId: "run_1",
          state: "RECOVERED",
          stateReason: "Safe state verified.",
          objective: "Deposit one USDC.",
          createdAt: "2026-08-08T12:00:00.000Z",
          startedAt: "2026-08-08T12:00:01.000Z",
          updatedAt: "2026-08-08T12:05:00.000Z",
          terminalAt: "2026-08-08T12:05:00.000Z",
          steps: [
            {
              stepRunId: "step_run_1",
              stepId: "authorize",
              state: "VERIFIED",
              executionAttemptIds: ["attempt_1"],
              observationIds: ["observation_1"],
            },
          ],
          attempts: [],
          transactionEvidence: [
            {
              transactionHash: forwardHash,
              explorerUrl: `https://sepolia.etherscan.io/tx/${forwardHash}`,
              keeperHubExecutionId: "keeper_forward",
              kind: "FORWARD",
              stepId: "authorize",
              status: "CONFIRMED",
              createdAt: "2026-08-08T12:01:00.000Z",
            },
            {
              transactionHash: recoveryHash,
              explorerUrl: `https://sepolia.etherscan.io/tx/${recoveryHash}`,
              providerTransactionLink: `https://provider.example/tx/${recoveryHash}`,
              keeperHubExecutionId: "keeper_recovery",
              kind: "COMPENSATION",
              stepId: "revoke",
              status: "CONFIRMED",
              createdAt: "2026-08-08T12:03:00.000Z",
            },
          ],
          reconciliation: [],
        }}
      />,
    );

    expect(screen.getByText(/keeper_forward/)).toBeTruthy();
    expect(screen.getByText(/keeper_recovery/)).toBeTruthy();
    expect(screen.getByText("Execution attempts")).toBeTruthy();
    expect(screen.getAllByText(/8\/8\/2026/).length).toBeGreaterThan(0);
    expect(
      screen
        .getByRole("link", {
          name: `View transaction ${forwardHash} on Sepolia Etherscan`,
        })
        .getAttribute("href"),
    ).toBe(`https://sepolia.etherscan.io/tx/${forwardHash}`);
    expect(
      screen
        .getByRole("link", { name: "Open KeeperHub-provided link ↗" })
        .getAttribute("href"),
    ).toBe(`https://provider.example/tx/${recoveryHash}`);
  });
});
