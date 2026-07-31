"use client";

import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aetherClient, queryKeys } from "@aether/sdk";
import { useUiStore } from "@/stores/ui";

export function useDashboard() {
  const organizationId = useUiStore((state) => state.organizationId);
  const protocolId = useUiStore((state) => state.protocolId);
  const queryClient = useQueryClient();
  const key = useMemo(
    () => queryKeys.dashboard(organizationId, protocolId),
    [organizationId, protocolId],
  );
  useEffect(() => {
    const cursorKey = `aether:sse-cursor:${organizationId}:${protocolId}`;
    const afterSequence = Number(sessionStorage.getItem(cursorKey) ?? 0);
    return aetherClient.subscribeEvents(afterSequence, (event) => {
      if (organizationId && event.organizationId !== organizationId) return;
      if (protocolId && event.protocolId !== protocolId) return;
      sessionStorage.setItem(cursorKey, String(event.sequence));
      void queryClient.invalidateQueries({ queryKey: key });
    });
  }, [key, organizationId, protocolId, queryClient]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => aetherClient.getDashboard(organizationId, protocolId),
    retry: false,
  });
  const update = (
    data: Awaited<ReturnType<typeof aetherClient.getDashboard>>,
  ) => queryClient.setQueryData(key, data);
  const approval = useMutation({
    mutationFn: ({
      operationId,
      decision,
    }: {
      operationId: string;
      decision: "approve" | "reject";
    }) => aetherClient.approveOperation(operationId, decision),
    onSuccess: update,
  });
  const scan = useMutation({
    mutationFn: () => aetherClient.runScan(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return { ...query, approval, scan, organizationId, protocolId };
}
