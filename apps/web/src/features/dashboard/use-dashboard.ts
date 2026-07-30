"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aetherClient, queryKeys } from "@aether/sdk";
import { useUiStore } from "@/stores/ui";

export function useDashboard() {
  const organizationId = useUiStore((state) => state.organizationId);
  const protocolId = useUiStore((state) => state.protocolId);
  const queryClient = useQueryClient();
  const key = queryKeys.dashboard(organizationId, protocolId);
  const query = useQuery({
    queryKey: key,
    queryFn: () => aetherClient.getDashboard(organizationId, protocolId),
  });
  const update = (
    data: Awaited<ReturnType<typeof aetherClient.getDashboard>>,
  ) => queryClient.setQueryData(key, data);
  const scenario = useMutation({
    mutationFn: aetherClient.setScenario.bind(aetherClient),
    onSuccess: update,
  });
  const advance = useMutation({
    mutationFn: aetherClient.advanceLifecycle.bind(aetherClient),
    onSuccess: update,
  });
  const approval = useMutation({
    mutationFn: aetherClient.approveOperation.bind(aetherClient),
    onSuccess: update,
  });
  return { ...query, scenario, advance, approval, organizationId, protocolId };
}
