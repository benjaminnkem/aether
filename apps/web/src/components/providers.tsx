"use client";

import { aetherClient } from "@aether/sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

const isMockMode = process.env.NEXT_PUBLIC_AETHER_DATA_MODE !== "api";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const [ready, setReady] = useState(!isMockMode);

  useEffect(() => {
    if (!isMockMode) return;
    void import("@aether/mock-data/browser").then(
      ({ worker, mockTransport }) => {
        aetherClient.setTransport(mockTransport);
        setReady(true);
        void worker
          .start({
            onUnhandledRequest: "bypass",
            serviceWorker: { url: "/mockServiceWorker.js" },
          })
          .catch(() => undefined);
      },
    );
  }, []);

  return (
    <QueryClientProvider client={client}>
      {ready ? (
        children
      ) : (
        <div className="a-empty" role="status">
          <Image src="/brand/aether-mark.svg" alt="" width="44" height="44" />
          <h3>Starting Aether mock control plane</h3>
          <p>Loading deterministic protocol state and execution adapters.</p>
        </div>
      )}
    </QueryClientProvider>
  );
}
