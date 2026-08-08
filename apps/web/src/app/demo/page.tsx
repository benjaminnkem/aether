"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";

const scenarios = [
  [
    "HAPPY_PATH",
    "Happy path",
    "Three fixed Sepolia writes execute and pass independent verification.",
  ],
  [
    "PARTIAL_FAILURE",
    "Partial failure and recovery",
    "Two writes land, the next simulation fails, then revoke and restore transactions prove the safe state.",
  ],
  [
    "UNKNOWN_OUTCOME",
    "Unknown outcome",
    "The acknowledgement is discarded after the real provider call. Retry stays locked until chain evidence finds the original write.",
  ],
] as const;
export default function DemoPage() {
  const base = process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1";
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["demo-scenarios"],
    queryFn: async () => {
      const response = await fetch(`${base}/demo/scenarios`);
      if (!response.ok) throw new Error("Demo status is unavailable.");
      return response.json() as Promise<{
        liveExecutionEnabled: boolean;
        replays: Array<Record<string, unknown>>;
        launchToken: string;
      }>;
    },
  });
  return (
    <main id="main-content" className="demo-page">
      <header className="demo-hero">
        <Link className="brand" href="/">
          AETHER
        </Link>
        <p className="eyebrow">Sepolia demonstration</p>
        <h1>See every write, proof, and recovery action.</h1>
        <p>
          These fixed scenarios use the same mission coordinator, KeeperHub
          adapter, persistence, and RPC verification as normal runs. No
          arbitrary addresses, calldata, or amounts are accepted.
        </p>
      </header>
      <section className="demo-grid">
        {scenarios.map(([id, title, description]) => (
          <article key={id}>
            <span>0{scenarios.findIndex((item) => item[0] === id) + 1}</span>
            <h2>{title}</h2>
            <p>{description}</p>
            <button
              className="pill pill-primary"
              disabled={!query.data?.liveExecutionEnabled}
              onClick={async () => {
                setMessage("Starting fixed scenario…");
                const response = await fetch(`${base}/demo/runs`, {
                  method: "POST",
                  credentials: "include",
                  headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": crypto.randomUUID(),
                  },
                  body: JSON.stringify({
                    scenario: id,
                    launchToken: query.data?.launchToken,
                  }),
                });
                const result = (await response.json()) as Record<
                  string,
                  unknown
                >;
                if (response.ok) {
                  const runId = String(result.runId);
                  sessionStorage.setItem(
                    `aether:demo-run:${runId}`,
                    String(result.viewToken),
                  );
                  window.location.href = `/demo/runs/${runId}`;
                } else
                  setMessage(
                    String(result.message ?? "Scenario could not start."),
                  );
              }}
            >
              {query.data?.liveExecutionEnabled
                ? "Run on Sepolia"
                : "Live execution disabled"}
            </button>
          </article>
        ))}
      </section>
      <p className="demo-message" aria-live="polite">
        {message}
      </p>
      <section className="section">
        <h2>Verified replays</h2>
        {query.data?.replays.length ? (
          query.data.replays.map((receipt) => (
            <div className="list-row" key={String(receipt.receiptId)}>
              <div>
                <strong>Previously verified Sepolia run</strong>
                <p className="mono">{String(receipt.receiptHash)}</p>
              </div>
              <span>Replay</span>
            </div>
          ))
        ) : (
          <p>
            No verified replay bundle has been imported. Aether will not
            fabricate transaction evidence.
          </p>
        )}
      </section>
    </main>
  );
}
