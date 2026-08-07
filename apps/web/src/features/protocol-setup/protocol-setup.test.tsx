import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Dashboard } from "@aether/shared";
import ProtocolSetup from "./protocol-setup";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/dashboard/use-refresh-dashboard", () => ({
  useRefreshDashboard: () => vi.fn(async () => undefined),
}));

const now = "2026-08-03T12:00:00.000Z";

function baseDashboard(overrides?: Partial<Dashboard>): Dashboard {
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
      networks: [],
      contracts: [],
      connections: [
        {
          id: "github",
          title: "GitHub",
          subtitle: "Not connected",
          status: "warning",
          timestamp: now,
        },
        {
          id: "keeperhub",
          title: "KeeperHub",
          subtitle: "Not validated",
          status: "warning",
          timestamp: now,
        },
      ],
    },
    metrics: [],
    notifications: [],
    realtime: "connected",
    overviewSummary: {
      healthScore: 40,
      alignedResources: 0,
      totalResources: 1,
      findingsBySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
      connections: [],
      lifecycle: { completed: 0, total: 4, current: "setup" },
      lastObservedAt: now,
    },
    ...overrides,
  };
}

function renderSetup(data: Dashboard = baseDashboard()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProtocolSetup data={data} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("Protocol Setup", () => {
  it("guides the operator to the next incomplete section", async () => {
    const user = userEvent.setup();
    renderSetup();

    const next = screen.getByRole("status");
    expect(within(next).getByText(/next: networks/i)).toBeVisible();

    await user.click(
      within(next).getByRole("button", { name: /go to section/i }),
    );
    expect(
      screen.getByRole("heading", { name: /observed networks/i }),
    ).toBeVisible();
  });

  it("disables save until general settings are dirty and valid", async () => {
    const user = userEvent.setup();
    renderSetup();

    const save = screen.getByRole("button", { name: /save settings/i });
    expect(save).toBeDisabled();
    expect(screen.getByText(/no unsaved changes/i)).toBeVisible();

    const name = screen.getByLabelText(/protocol name/i);
    await user.clear(name);
    await user.type(name, "Arcadia Market v2");
    expect(screen.getByText(/unsaved changes/i)).toBeVisible();
    expect(save).toBeEnabled();
  });

  it("shows setup complete when every section is ready", () => {
    renderSetup(
      baseDashboard({
        records: {
          networks: [
            {
              id: "sepolia",
              title: "Ethereum Sepolia",
              subtitle: "Chain ID 11155111",
              status: "healthy",
              timestamp: now,
            },
          ],
          contracts: [
            {
              id: "market",
              title: "ArcadiaMarket",
              subtitle: "Proxy",
              status: "healthy",
              value: "0x2222222222222222222222222222222222222222",
              timestamp: now,
            },
          ],
          connections: [
            {
              id: "github",
              title: "GitHub",
              subtitle: "Connected",
              status: "healthy",
              meta: "owner · owner/repo · read-only",
              timestamp: now,
            },
            {
              id: "keeperhub",
              title: "KeeperHub",
              subtitle: "Connected",
              status: "healthy",
              meta: "Ethereum Sepolia · wallet funded · simulation ready",
              timestamp: now,
            },
          ],
        },
      }),
    );

    expect(screen.getByText(/setup complete/i)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /^desired state/i }),
    ).toHaveAttribute("href", "/app/desired-state");
    expect(
      screen.getByRole("link", { name: /open desired state/i }),
    ).toHaveAttribute("href", "/app/desired-state");
    expect(screen.getByLabelText(/protocol setup readiness/i)).toHaveClass(
      "is-complete",
    );
  });
});
