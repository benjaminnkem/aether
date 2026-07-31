import { desiredStateSchema, dashboardSchema } from "@aether/shared";
import { describe, expect, it } from "vitest";

describe("browser contracts", () => {
  it("accepts an honest empty dashboard", () => {
    expect(() =>
      dashboardSchema.parse({
        organization: null,
        protocols: [],
        records: {},
        metrics: [],
        notifications: [],
        realtime: "connected",
      }),
    ).not.toThrow();
  });

  it("rejects a desired state for the wrong chain", () => {
    expect(() =>
      desiredStateSchema.parse({
        version: "v1.0.0",
        networkId: "mainnet",
        chainId: 1,
      }),
    ).toThrow();
  });
});
