"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } },
  }));
  const [ready, setReady] = useState(process.env.NEXT_PUBLIC_AETHER_DATA_MODE !== "mock");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AETHER_DATA_MODE !== "mock") return;
    void import("@aether/mock-data/browser").then(async ({ worker }) => {
      await worker.start({ onUnhandledRequest: "bypass", serviceWorker: { url: "/mockServiceWorker.js" } });
      setReady(true);
    });
  }, []);

  return <QueryClientProvider client={client}>{ready ? children : <div className="a-empty" role="status"><img src="/brand/aether-mark.svg" alt="" width="44" height="44" /><h3>Starting Aether mock control plane</h3><p>Loading deterministic protocol state and execution adapters.</p></div>}</QueryClientProvider>;
}
