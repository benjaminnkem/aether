import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Dashboard } from "@aether/shared";
import { Overview } from "./overview";

const now = "2026-08-03T12:00:00.000Z";

function dashboard(partial?: Partial<Dashboard>): Dashboard {
  return {
    organization: { id: "org_1", name: "Aether Labs", role: "owner" },
    protocols: [
      {
        id: "pro_1",
        organizationId: "org_1",
        name: "Arcadia Market",
        environment: "Ethereum Sepolia",
        health: 74,
        status: "critical",
        release: "v2.4.1",
        repository: "owner/repo",
        governance: "0x1111111111111111111111111111111111111111",
        chains: ["11155111"],
        openDrift: 1,
        lastScanAt: now,
      },
    ],
    records: {
      drift: [
        {
          id: "finding-1",
          title: "Oracle address diverged",
          subtitle: "Pinned observation",
          status: "open",
          severity: "critical",
          timestamp: now,
        },
      ],
      operations: [],
      executions: [],
    },
    metrics: [
      { label: "Open drift", value: "1", detail: "Unresolved finding" },
      { label: "Networks", value: "1", detail: "Configured" },
    ],
    notifications: [],
    realtime: "connected",
    overviewSummary: {
      healthScore: 42,
      alignedResources: 0,
      totalResources: 1,
      findingsBySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
      connections: [
        { id: "github", label: "GitHub", status: "warning" },
        { id: "keeperhub", label: "KeeperHub", status: "healthy" },
      ],
      lifecycle: { completed: 0, total: 4, current: "idle" },
      lastObservedAt: now,
    },
    ...partial,
  };
}

describe("Overview", () => {
  it("surfaces critical drift attention and a primary path to review", () => {
    render(<Overview data={dashboard()} />);
    expect(
      screen.getByText(/critical drift requires evidence review/i),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /review drift/i })).toHaveAttribute(
      "href",
      "/app/drift",
    );
    expect(screen.getByText(/attention required/i)).toBeVisible();
    expect(screen.getByLabelText(/protocol health 42 percent/i)).toBeVisible();
  });

  it("shows aligned empty state when no open drift remains", () => {
    render(
      <Overview
        data={dashboard({
          records: { drift: [], operations: [], executions: [] },
          overviewSummary: {
            healthScore: 100,
            alignedResources: 1,
            totalResources: 1,
            findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
            connections: [
              { id: "github", label: "GitHub", status: "healthy" },
              { id: "keeperhub", label: "KeeperHub", status: "healthy" },
            ],
            lifecycle: { completed: 4, total: 4, current: "verified" },
            lastObservedAt: now,
          },
          protocols: [
            {
              id: "pro_1",
              organizationId: "org_1",
              name: "Arcadia Market",
              environment: "Ethereum Sepolia",
              health: 100,
              status: "healthy",
              release: "v2.4.1",
              repository: "owner/repo",
              governance: "0x1111111111111111111111111111111111111111",
              chains: ["11155111"],
              openDrift: 0,
              lastScanAt: now,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/state converged/i)).toBeVisible();
    expect(screen.getByText(/no active drift/i)).toBeVisible();
  });
});
