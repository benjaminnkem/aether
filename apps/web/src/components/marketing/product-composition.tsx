import { ShieldTick, Warning2 } from "iconsax-react";
import { Badge, Status } from "@aether/ui";

export function ProductComposition() {
  return (
    <div className="product-frame">
      <div className="product-frame__chrome">
        <i />
        <i />
        <i />
        <span>Aether control plane · Base Sepolia</span>
      </div>
      <div className="hero-product">
        <aside className="hero-product__side">
          {[
            "Overview",
            "Protocol Setup",
            "Desired State",
            "Drift",
            "Audit Log",
          ].map((item, index) => (
            <div
              key={item}
              className={`hero-product__nav ${index === 0 ? "is-active" : ""}`}
            >
              {item}
            </div>
          ))}
        </aside>
        <div className="hero-product__main">
          <div className="eyebrow">Configured protocol · testnet</div>
          <h2
            style={{
              color: "var(--paper)",
              fontWeight: 500,
              fontSize: 22,
              margin: "10px 0 0",
            }}
          >
            Protocol health
          </h2>
          <div className="hero-metrics">
            <div className="hero-metric">
              <span>Health score</span>
              <strong>61%</strong>
              <Status status="critical" label="Critical drift" />
            </div>
            <div className="hero-metric">
              <span>Desired alignment</span>
              <strong>38 / 39</strong>
              <span>Typed resources</span>
            </div>
            <div className="hero-metric">
              <span>Last observed</span>
              <strong>18s</strong>
              <span>Pinned block evidence</span>
            </div>
          </div>
          <div className="hero-alert">
            <Warning2 size={20} color="#eb5757" />
            <div>
              <strong>Unauthorized oracle address</strong>
              <p>
                OracleAdapter on Base no longer matches approved desired state.
                Freshness and allowlist invariants fail.
              </p>
            </div>
            <Badge tone="danger">SEV-1</Badge>
          </div>
          <div className="mini-graph">
            <div className="mini-node">
              <ShieldTick size={14} /> Read state
            </div>
            <div className="mini-node">Policy check</div>
            <div className="mini-node is-current">KeeperHub execute</div>
            <div className="mini-node">Independent verify</div>
          </div>
          <div
            className="a-surface"
            style={{
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>
              <strong style={{ color: "var(--paper)", fontWeight: 500 }}>
                KH-8314
              </strong>{" "}
              <span style={{ color: "var(--fog)", fontSize: 11 }}>
                Oracle restoration workflow
              </span>
            </span>
            <Status status="executing" label="Executing through KeeperHub" />
          </div>
        </div>
      </div>
    </div>
  );
}
