import { beforeAll, describe, expect, it } from "vitest";
import { createMissionSchema } from "@aether/shared";

beforeAll(() => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    SAVINGS_AETHER_API_URL: "http://localhost:4000/v1",
    SAVINGS_AETHER_API_KEY: `aeth_${"a".repeat(64)}`,
    SAVINGS_APP_ORIGIN: "http://localhost:3001",
    SAVINGS_APP_ACCESS_TOKEN: "test-access-token-long-enough",
    SAVINGS_SESSION_SECRET:
      "test-session-secret-that-is-at-least-thirty-two-characters",
    SAVINGS_LIVE_EXECUTION_ENABLED: "true",
    SAVINGS_VAULT_ADDRESS: "0x1111111111111111111111111111111111111111",
    SAVINGS_TOKEN_ADDRESS: "0x2222222222222222222222222222222222222222",
    SAVINGS_TOKEN_SYMBOL: "TEST",
    SAVINGS_TOKEN_DECIMALS: "6",
    SAVINGS_MIN_AMOUNT: "1",
    SAVINGS_MAX_AMOUNT: "1000",
    SAVINGS_KEEPERHUB_EXECUTOR_ADDRESS:
      "0x3333333333333333333333333333333333333333",
    SAVINGS_EXPLORER_URL: "https://sepolia.etherscan.io",
    LENDING_POOL_ADDRESS: "0x5555555555555555555555555555555555555555",
    LENDING_COLLATERAL_TOKEN_ADDRESS:
      "0x6666666666666666666666666666666666666666",
    LENDING_COLLATERAL_SYMBOL: "USDC",
    LENDING_COLLATERAL_DECIMALS: "6",
    LENDING_MIN_COLLATERAL: "1",
    LENDING_MAX_COLLATERAL: "100",
    LENDING_BORROW_TOKEN_ADDRESS: "0x7777777777777777777777777777777777777777",
    LENDING_BORROW_SYMBOL: "WETH",
    LENDING_BORROW_DECIMALS: "18",
    LENDING_BORROW_AMOUNT: "0.0001",
    LENDING_MIN_BORROW: "0.00001",
    LENDING_MAX_BORROW: "0.001",
    LENDING_ATOKEN_ADDRESS: "0x8888888888888888888888888888888888888888",
    LENDING_VARIABLE_DEBT_TOKEN_ADDRESS:
      "0x9999999999999999999999999999999999999999",
  });
});

describe("lending mission factory", () => {
  it("binds a complete borrow-and-close cycle and recovery to configured contracts", async () => {
    const { lendingMissionFor } = await import("./lending");
    const mission = lendingMissionFor(
      "0x4444444444444444444444444444444444444444",
      "10",
      "0.0001",
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(mission.name).toBe("Borrow 0.0001 WETH against 10 USDC");
    expect(mission.definition.steps.map((step) => step.id)).toEqual([
      "approve-collateral",
      "supply-collateral",
      "authorize-repayment",
      "borrow-asset",
      "repay-asset",
      "withdraw-collateral",
      "revoke-collateral-approval",
      "revoke-repayment-approval",
    ]);
    expect(mission.definition.steps[1]?.proof).toMatchObject({
      kind: "ERC20_BALANCE",
      token: "0x8888888888888888888888888888888888888888",
      amount: "10000000",
    });
    expect(mission.definition.steps[1]?.compensation?.action.functionName).toBe(
      "withdraw",
    );
    expect(mission.definition.steps[3]?.retryClass).toBe("NON_REPLAYABLE");
    expect(mission.definition.steps[3]?.compensation).toMatchObject({
      id: "repay-borrowed-asset",
      action: { functionName: "repay" },
      proof: {
        kind: "ERC20_BALANCE",
        token: "0x9999999999999999999999999999999999999999",
        amount: "0",
      },
    });
    expect(mission.definition.steps[4]).toMatchObject({
      id: "repay-asset",
      action: { functionName: "repay" },
      proof: { kind: "ERC20_BALANCE", operator: "EQ", amount: "0" },
    });
    expect(mission.definition.steps[5]).toMatchObject({
      id: "withdraw-collateral",
      action: { functionName: "withdraw" },
      proof: { kind: "ERC20_BALANCE", operator: "EQ", amount: "0" },
    });
    expect(
      mission.definition.invariants.map((invariant) => invariant.id),
    ).toEqual(
      expect.arrayContaining([
        "no-collateral-position",
        "no-variable-debt",
        "no-collateral-allowance",
        "no-repayment-allowance",
      ]),
    );
    expect(mission.definition.authorityPolicy.allowedFunctions).toContain(
      "repay",
    );
  });

  it("builds a fixed blocked-borrowing mission with real prior effects and declared recovery", async () => {
    const { lendingMissionFor } = await import("./lending");
    const mission = lendingMissionFor(
      "0x4444444444444444444444444444444444444444",
      "10",
      "0.0001",
      "550e8400-e29b-41d4-a716-446655440001",
      "BLOCKED_BORROWING",
    );
    expect(mission.name).toBe("Borrow 0.0001 WETH against 10 USDC");
    expect(mission.definition.steps[3]).toMatchObject({
      id: "borrow-asset",
      executionGate: {
        kind: "BLOCKED",
        reason: expect.stringMatching(/before simulation/i),
      },
    });
    expect(mission.definition.steps.slice(0, 3).map((step) => step.id)).toEqual(
      ["approve-collateral", "supply-collateral", "authorize-repayment"],
    );
  });
});

describe("savings mission factory", () => {
  it("builds a strict two-write mission with exact proofs and compensation", async () => {
    const { missionFor, resolveIntent } = await import("./mission");
    const intent = resolveIntent(
      "0x4444444444444444444444444444444444444444",
      "12.5",
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(intent.amount).toBe("12500000");
    const mission = createMissionSchema.parse(missionFor(intent));
    expect(mission.definition.steps).toHaveLength(2);
    expect(mission.definition.steps[0]?.retryClass).toBe(
      "SEMANTICALLY_IDEMPOTENT",
    );
    expect(
      mission.definition.steps[0]?.compensation?.action.functionArgs,
    ).toEqual(["0x1111111111111111111111111111111111111111", "0"]);
    expect(mission.definition.steps[1]?.retryClass).toBe("PROVABLE_EFFECT");
    expect(mission.definition.steps[1]?.proof).toMatchObject({
      kind: "CONTRACT_READ",
      functionName: "depositAmount",
      expected: "12500000",
    });
  });

  it("rejects amounts outside the configured server limit", async () => {
    const { resolveIntent } = await import("./mission");
    expect(() =>
      resolveIntent(
        "0x4444444444444444444444444444444444444444",
        "1000.000001",
        "550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toThrow(/between 1 and 1000 TEST/);
  });
});
