"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { aetherClient, queryKeys } from "@aether/sdk";

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => aetherClient.getSession(),
    staleTime: 60_000,
    retry: false,
  });
}

export function useClearSession() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.setQueryData(queryKeys.session, null);
    queryClient.removeQueries({ queryKey: ["dashboard"] });
  };
}
