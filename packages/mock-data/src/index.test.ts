import { describe, expect, it } from "vitest";
import {
  createScenarioDashboard,
  mockScenarioNames,
  mockTransport,
  resetScenario,
} from "./index";

describe("mock scenario engine", () => {
  it("implements every documented deterministic scenario", () => {
    expect(mockScenarioNames).toHaveLength(13);
    for (const scenario of mockScenarioNames) {
      expect(createScenarioDashboard(scenario.value).scenario).toBe(
        scenario.value,
      );
    }
  });

  it("returns protocol health after verified oracle correction", () => {
    const drift = createScenarioDashboard("unauthorized-oracle", 0);
    const verified = createScenarioDashboard("unauthorized-oracle", 6);
    expect(drift.protocols[0]?.health).toBe(61);
    expect(drift.records.drift?.[0]?.status).toBe("open");
    expect(verified.protocols[0]?.health).toBe(98);
    expect(verified.operation.status).toBe("resolved");
    expect(verified.records.drift?.[0]?.status).toBe("resolved");
  });

  it("runs the complete oracle incident lifecycle through the transport", async () => {
    resetScenario();
    const detected = await mockTransport.setScenario("unauthorized-oracle");
    expect(detected.records.incidents?.[0]?.status).toBe("open");
    let dashboard = detected;
    for (let stage = 0; stage < 6; stage += 1) {
      dashboard = await mockTransport.advanceLifecycle();
    }
    expect(dashboard.operation.status).toBe("resolved");
    expect(dashboard.protocols[0]?.health).toBe(98);
    expect(dashboard.notifications[0]?.title).toContain("verified");
    expect(dashboard.records["audit-log"]?.at(-1)?.title).toContain(
      "verification",
    );
  });

  it("isolates viewer permissions and stale provider state", () => {
    expect(createScenarioDashboard("viewer").organization.role).toBe("viewer");
    expect(createScenarioDashboard("stale-rpc").realtime).toBe("reconnecting");
  });
});
