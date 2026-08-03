import { DocumentCode2, Eye, ShieldSecurity, TickCircle } from "iconsax-react";
import { Card, CodeBlock, Status } from "@aether/ui";
import { activeLiveChain } from "@aether/shared";
import {
  HeroBackground,
  MarketingShell,
} from "@/components/marketing/marketing-shell";
import { ProductComposition } from "@/components/marketing/product-composition";
import { MotionReveal, StickySequence } from "@/components/marketing/motion";
import {
  SessionActions,
  SessionProductCta,
} from "@/components/auth/session-actions";

const desiredYaml = `version: v2.4.1
chainId: ${activeLiveChain.chainId}
resources:
  OracleAdapter:
    oracle: 0x2C8A7E78...44311
    heartbeat: 1800s
  FeeController:
    fee: 50 bps`;

export default function HomePage() {
  return (
    <MarketingShell>
      <section className="hero">
        <HeroBackground />
        <div className="marketing-container">
          <MotionReveal className="hero-copy">
            <div className="eyebrow">
              Desired-state control for smart contracts
            </div>
            <h1>Keep protocols in their intended onchain state.</h1>
            <p>
              Aether observes deployed contracts, detects dangerous drift, plans
              safe corrections, executes approved actions through KeeperHub, and
              independently verifies the result.
            </p>
            <div className="hero-actions">
              <SessionActions hero />
            </div>
            <div className="trust-line">
              Execution reliability powered by KeeperHub integration. Aether
              remains responsible for policy, approval, and independent
              verification.
            </div>
          </MotionReveal>
          <ProductComposition />
        </div>
      </section>

      <section className="marketing-section" id="how-it-works">
        <div className="marketing-container">
          <div className="section-head">
            <div className="eyebrow">Desired versus observed</div>
            <h2>Intent stays legible. Reality stays measurable.</h2>
            <p>
              Versioned declarations define what should exist. Block-pinned
              observations show what actually exists, including partial reads
              and provider freshness.
            </p>
          </div>
          <StickySequence>
            <div className="marketing-grid">
              <div className="marketing-copy">
                <h3>One schema, two useful views.</h3>
                <p>
                  Operators edit safe forms; engineers review canonical YAML.
                  Chain overrides, bigint units, provenance, and activation
                  impact stay explicit.
                </p>
                <ul className="marketing-list">
                  <li>
                    <TickCircle size={17} color="#E4F222" /> Runtime schema
                    validation
                  </li>
                  <li>
                    <TickCircle size={17} color="#E4F222" /> GitHub commit and
                    PR provenance
                  </li>
                  <li>
                    <TickCircle size={17} color="#E4F222" /> Human-readable
                    canonical unit previews
                  </li>
                </ul>
              </div>
              <Card className="product-visual">
                <CodeBlock code={desiredYaml} />
                <div style={{ marginTop: 10 }} className="state-compare">
                  <div className="state-pane">
                    <span>Desired</span>
                    <div className="state-line">
                      <em>oracle</em>
                      <strong>0x2C8A…4311</strong>
                    </div>
                    <div className="state-line">
                      <em>fee</em>
                      <strong>50 bps</strong>
                    </div>
                  </div>
                  <div className="state-pane">
                    <span>Observed at block 17,924,118</span>
                    <div className="state-line is-drift">
                      <em>oracle</em>
                      <strong>0x6F2B…E912</strong>
                    </div>
                    <div className="state-line">
                      <em>fee</em>
                      <strong>50 bps</strong>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </StickySequence>
        </div>
      </section>

      {[
        {
          eyebrow: "Detect what changed",
          title: "Evidence before conclusions.",
          copy: "Aether traces the transaction, sender, decoded call, events, repository history, governance records, and prior operations. It separates an unauthorized change from a stale declaration.",
          Icon: Eye,
        },
        {
          eyebrow: "Plan safely",
          title: "Every write earns its place.",
          copy: "Plans are immutable graphs with reads, deterministic policy, exact-request simulation, approvals, finality, postconditions, and forward-correction options.",
          Icon: DocumentCode2,
        },
        {
          eyebrow: "Execute reliably",
          title: "Execution is observable, retry-safe, and bounded.",
          copy: "KeeperHub runs expose node status, logs, gas, transaction hashes, retries, and partial completion without granting the AI signing authority.",
          Icon: ShieldSecurity,
        },
      ].map(({ eyebrow, title, copy, Icon }, index) => (
        <section
          className="marketing-section"
          id={index === 0 ? "product" : index === 2 ? "security" : undefined}
          key={eyebrow}
        >
          <div className="marketing-container marketing-grid">
            <div className="marketing-copy">
              <div className="eyebrow">{eyebrow}</div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <SessionProductCta />
            </div>
            <Card
              className="product-visual"
              style={{ display: "grid", placeItems: "center" }}
            >
              <div style={{ width: "86%" }}>
                <Icon size={26} color={index === 2 ? "#E4F222" : "#8A8F98"} />
                <h3
                  style={{
                    color: "var(--paper)",
                    fontWeight: 500,
                    fontSize: 18,
                  }}
                >
                  {index === 0
                    ? "Oracle changed outside approved intent"
                    : index === 1
                      ? "Restore approved OracleAdapter"
                      : "KH-8314 · node 5 of 8"}
                </h3>
                <div className="mini-graph">
                  <div className="mini-node">Observe</div>
                  <div className="mini-node">Authorize</div>
                  <div className="mini-node is-current">Execute</div>
                  <div className="mini-node">Verify</div>
                </div>
                <Status
                  status={
                    index === 0
                      ? "critical"
                      : index === 1
                        ? "awaiting_approval"
                        : "executing"
                  }
                />
              </div>
            </Card>
          </div>
        </section>
      ))}

      <section className="marketing-section">
        <div className="marketing-container">
          <div className="section-head">
            <div className="eyebrow">Verified convergence</div>
            <h2>Confirmation is not the finish line.</h2>
            <p>
              Aether re-reads storage through independent infrastructure,
              confirms expected events, checks side effects, and evaluates
              blocking invariants before reporting success.
            </p>
          </div>
          <div className="security-model">
            <div>
              <span>01</span>
              <h3>AI proposes</h3>
              <p>Evidence-backed investigation and typed plans.</p>
            </div>
            <div>
              <span>02</span>
              <h3>Policy authorizes</h3>
              <p>Deterministic allowlists, limits, and invariants.</p>
            </div>
            <div>
              <span>03</span>
              <h3>KeeperHub executes</h3>
              <p>Reliable approved workflow and transaction execution.</p>
            </div>
            <div>
              <span>04</span>
              <h3>Aether verifies</h3>
              <p>Independent postconditions and audit evidence.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="marketing-section">
        <div className="marketing-container">
          <div className="section-head">
            <div className="eyebrow">Built for protocol teams</div>
            <h2>One operational record, every responsible role.</h2>
          </div>
          <div className="integration-strip">
            {[
              "Protocol engineers",
              "Security reviewers",
              "Operations",
              "Governance",
              "Multisig signers",
              "Auditors",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="integration-strip" style={{ marginTop: 12 }}>
            {[
              "GitHub",
              "Safe / governance",
              "EVM networks",
              "KeeperHub",
              "RPC providers",
              "Alerts",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>
      <section className="marketing-section">
        <div className="marketing-container">
          <ProductComposition />
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <SessionActions hero />
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
