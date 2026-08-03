"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@aether/sdk";
import { useSession } from "@/features/auth/use-session";

export function useRefreshDashboard() {
  const queryClient = useQueryClient();
  const session = useSession();
  const organizationId = session.data?.context?.organizationId ?? "";
  const protocolId = session.data?.context?.protocolId ?? "";

  return useCallback(() => {
    if (!organizationId || !protocolId) return Promise.resolve();
    return queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard(organizationId, protocolId),
      refetchType: "active",
    });
  }, [organizationId, protocolId, queryClient]);
}
