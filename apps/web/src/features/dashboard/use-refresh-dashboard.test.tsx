import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@aether/sdk";
import { useRefreshDashboard } from "./use-refresh-dashboard";

describe("useRefreshDashboard", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("invalidates and actively refetches the selected tenant dashboard", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.session, {
      authenticated: true,
      user: { id: "usr-live", email: "operator@example.com" },
      context: {
        organizationId: "org-live",
        protocolId: "pro-live",
        role: "owner",
      },
      destination: "dashboard",
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRefreshDashboard(), { wrapper });

    await act(() => result.current());

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.dashboard("org-live", "pro-live"),
      refetchType: "active",
    });
  });
});
