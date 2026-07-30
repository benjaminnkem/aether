import { Card, CodeBlock, Status } from "@aether/ui";
import { MarketingShell } from "./marketing-shell";

const content = {
  product: {
    eyebrow: "Product",
    title: "A control plane for intended onchain state.",
    lede: "Aether links approved intent to block-pinned observation, evidence-backed investigation, deterministic authorization, KeeperHub execution, and independent verification.",
    sections: [
      [
        "Observe the whole protocol",
        "Track proxies, implementations, parameters, owners, roles, oracles, balances, schedules, and cross-chain release parity from known blocks.",
      ],
      [
        "Investigate with evidence",
        "Every finding connects to transaction calldata, sender, events, repository history, governance records, snapshots, and the policies that matter.",
      ],
      [
        "Operate through immutable plans",
        "Plans carry exact targets, functions, arguments, values, preconditions, simulations, approval thresholds, finality, and postconditions.",
      ],
      [
        "Correct forward",
        "When an irreversible write has confirmed, Aether maps completed effects and proposes a separately authorized correction instead of pretending to roll back.",
      ],
    ],
  },
  security: {
    eyebrow: "Security",
    title: "Intelligence cannot become authority.",
    lede: "Aether deliberately separates proposal, authorization, approval, execution, and verification so no model response can directly move protocol state.",
    sections: [
      [
        "Default deny",
        "Unknown chains, targets, code hashes, selectors, value transfers, and malformed units are blocked by deterministic policy.",
      ],
      [
        "Exact request integrity",
        "The normalized request simulated is the request approved and executed, except for provider-required execution metadata.",
      ],
      [
        "No browser secrets",
        "KeeperHub keys, GitHub installation tokens, AI credentials, notification secrets, and private keys never enter the web bundle.",
      ],
      [
        "Independent verification",
        "Confirmation is reconciled with fresh state reads, expected events, side-effect checks, postconditions, and invariant evaluation.",
      ],
    ],
  },
  "how-it-works": {
    eyebrow: "How it works",
    title: "From drift signal to verified convergence.",
    lede: "Aether turns an operational discrepancy into a traceable, policy-bounded sequence rather than an opaque script or chat command.",
    sections: [
      [
        "1. Observe",
        "Read desired and observed values at known blocks. Partial or stale provider results remain unknown, never silently matching.",
      ],
      [
        "2. Explain",
        "Correlate onchain evidence, releases, governance, prior operations, and explicit uncertainty into a reviewable investigation.",
      ],
      [
        "3. Authorize",
        "Validate the plan schema, evaluate policies and invariants, simulate exact requests, and collect role-based approvals on an immutable hash.",
      ],
      [
        "4. Execute and verify",
        "Submit with stable idempotency through KeeperHub, monitor every node, then independently verify the protocol returned to a safe state.",
      ],
    ],
  },
  docs: {
    eyebrow: "Product guide",
    title: "Operate Aether without guessing.",
    lede: "Start in deterministic mock mode, learn the state model, and review the full corrective lifecycle before any live provider is connected.",
    sections: [
      [
        "Quick start",
        "Install with pnpm, set NEXT_PUBLIC_AETHER_DATA_MODE=mock, run the web app, and open the development demo controller.",
      ],
      [
        "Desired state",
        "Use semantic versions, explicit chain IDs, checksummed addresses, canonical bigint strings, and declared units such as bps or wei.",
      ],
      [
        "Operation safety",
        "Read policy reasons and simulation output before approval. Approvals bind to a plan hash and expire after material state or policy changes.",
      ],
      [
        "Mock scenarios",
        "Trigger unauthorized oracle drift, expected releases, insufficient gas, missing roles, expired approvals, rate limits, partial execution, viewer mode, and stale RPC data.",
      ],
    ],
  },
} as const;

export function ContentPage({ kind }: { kind: keyof typeof content }) {
  const page = content[kind];
  return (
    <MarketingShell>
      <div className="marketing-container">
        <section className="subpage-hero">
          <div className="eyebrow">{page.eyebrow}</div>
          <h1 className="marketing-title">{page.title}</h1>
          <p className="subpage-lede">{page.lede}</p>
        </section>
        <section className="marketing-section" style={{ paddingTop: 0 }}>
          <div className="content-sections">
            {page.sections.map(([title, body], index) => (
              <article className="content-section" key={title}>
                <span
                  className="mono"
                  style={{ color: "var(--lime)", fontSize: 10 }}
                >
                  0{index + 1}
                </span>
                <h2>{title}</h2>
                <p>{body}</p>
                {kind === "security" ? (
                  <Status status="healthy" label="Deterministic control" />
                ) : null}
              </article>
            ))}
          </div>
          {kind === "docs" ? (
            <Card style={{ marginTop: 24, padding: 20 }}>
              <CodeBlock
                language="env"
                code={
                  "NEXT_PUBLIC_AETHER_DATA_MODE=mock\nNEXT_PUBLIC_AETHER_API_URL=/v1"
                }
              />
            </Card>
          ) : null}
        </section>
      </div>
    </MarketingShell>
  );
}
