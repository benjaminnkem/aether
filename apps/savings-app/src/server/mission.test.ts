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
