import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { aetherClient } from "@aether/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionActions } from "./session-actions";

function renderActions(
  session: Awaited<ReturnType<typeof aetherClient.getSession>>,
) {
  vi.spyOn(aetherClient, "getSession").mockResolvedValue(session);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionActions hero />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("session-aware landing actions", () => {
  it("shows anonymous account creation without a demo action", async () => {
    renderActions(null);
    expect(
      await screen.findByRole("button", { name: /create account/i }),
    ).toBeVisible();
    expect(screen.queryByText(/demo|testnet app/i)).not.toBeInTheDocument();
  });

  it("routes an onboarded user to the dashboard", async () => {
    renderActions({
      authenticated: true,
      user: { id: "usr_1", email: "owner@example.invalid" },
      context: {
        organizationId: "org_1",
        protocolId: "pro_1",
        role: "owner",
      },
      destination: "dashboard",
    });
    expect(
      await screen.findByRole("button", { name: /go to dashboard/i }),
    ).toBeVisible();
  });

  it("routes a signed-in user without a tenant back to setup", async () => {
    renderActions({
      authenticated: true,
      user: { id: "usr_2", email: "new@example.invalid" },
      destination: "onboarding",
    });
    expect(
      await screen.findByRole("button", { name: /continue setup/i }),
    ).toBeVisible();
  });
});
