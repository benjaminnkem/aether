import { describe, expect, it } from "vitest";
import {
  createScenarioDashboard,
  mockScenarioNames,
  mockTransport,
  resetScenario,
} from "./index";

describe("mock scenario engine", () => {
  it("implements every documented deterministic scenario", () => {
    expect(mockScenarioNames).toHaveLength(6);
    for (const scenario of mockScenarioNames) {
      expect(createScenarioDashboard(scenario.value).scenario).toBe(
        scenario.value,
      );
    }
  });

  it("returns protocol health after verified oracle correction", () => {
    const drift = createScenarioDashboard("unauthorized-oracle", 0);
    const verified = createScenarioDashboard("unauthorized-oracle", 6);
    expect(drift.protocols[0]?.health).toBe(64);
    expect(drift.records.drift?.[0]?.status).toBe("open");
    expect(verified.protocols[0]?.health).toBe(100);
    expect(verified.operation.status).toBe("resolved");
    expect(verified.records.drift).toHaveLength(0);
  });

  it("runs the complete oracle incident lifecycle through the transport", async () => {
    resetScenario();
    const detected = await mockTransport.setScenario("unauthorized-oracle");
    expect(detected.records.drift?.[0]?.status).toBe("open");
    let dashboard = detected;
    for (let stage = 0; stage < 2; stage += 1) {
      dashboard = await mockTransport.advanceLifecycle();
    }
    expect(dashboard.operation.status).toBe("plan_ready");
    dashboard = await mockTransport.approveOperation("approve");
    expect(dashboard.operation.status).toBe("approved");
    for (let stage = 0; stage < 3; stage += 1)
      dashboard = await mockTransport.advanceLifecycle();
    expect(dashboard.operation.status).toBe("resolved");
    expect(dashboard.protocols[0]?.health).toBe(100);
    expect(
      dashboard.records["audit-log"]?.some((event) =>
        event.title.includes("verified"),
      ),
    ).toBe(true);
  });

  it("locks retries for an unknown transaction outcome", () => {
    const dashboard = createScenarioDashboard("unknown-outcome");
    expect(dashboard.execution.status).toBe("unknown");
    expect(dashboard.execution.reconciliation).toContain("two RPC providers");
  });
});
