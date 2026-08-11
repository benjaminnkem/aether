import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { HeroParticles } from "@/components/marketing/hero-particles";
import { LandingMotion } from "@/components/marketing/landing-motion";
import { LandingSessionLink } from "@/components/auth/landing-session-link";

const agentsRuntime =
  process.env.AETHER_AGENT_RUNTIME_ORIGIN ?? "http://localhost:3001";

const phases = [
  [
    "01",
    "Define",
    "Freeze intent, policy, proofs, and recovery before the first write.",
  ],
  ["02", "Execute", "Simulate the exact plan, then submit through KeeperHub."],
  [
    "03",
    "Observe",
    "Read canonical chain reality through independent RPC evidence.",
  ],
  [
    "04",
    "Reconcile",
    "Treat a missing response as unknown—not failed—and lock replay.",
  ],
  ["05", "Recover", "Run only bounded, pre-authorized compensating actions."],
  [
    "06",
    "Prove",
    "Close with a receipt backed by verified terminal invariants.",
  ],
] as const;

export default function HomePage() {
  return (
    <main id="main-content" className="marketing-page">
      <LandingMotion />
      <header className="landing-nav">
        <Link className="brand brand-lockup" href="/" aria-label="Aether home">
          <Image
            src="/brand/aether-mark-mono.svg"
            alt=""
            width={28}
            height={28}
          />
          <span>AETHER</span>
        </Link>
        <nav aria-label="Marketing navigation">
          <a href="#system">System</a>
          <a href="#agents">Agents</a>
          <Link href="/demo">Demo</Link>
          <LandingSessionLink />
          <Link className="pill pill-primary" href="/signup">
            Start building
          </Link>
        </nav>
      </header>

      <section className="campaign-hero" aria-labelledby="campaign-title">
        <div className="campaign-media" aria-hidden="true">
          <Image
            src="/visuals/mission-path-hero.png"
            alt=""
            fill
            priority
            sizes="100vw"
          />
          <div className="campaign-shade" />
        </div>
        <HeroParticles />
        <div className="campaign-signal" aria-hidden="true">
          <span>INTENT</span>
          <i />
          <span>REALITY</span>
          <i />
          <span>PROOF</span>
        </div>
        <div className="campaign-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="campaign-copy" data-reveal>
          <p className="eyebrow">
            Mission control for autonomous onchain agents
          </p>
          <h1 id="campaign-title">
            <span className="hero-line">
              <span>KNOW WHAT LANDED.</span>
            </span>
            <span className="hero-line">
              <span>RECOVER WHAT DIDN&apos;T.</span>
            </span>
          </h1>
          <p className="campaign-lede">
            Aether gives multi-step onchain work a memory, a truth layer, and a
            safe way home—without handing financial authority to AI.
          </p>
          <div className="campaign-actions">
            <Link className="pill pill-on-dark" href="/demo">
              Watch a mission recover
              <span aria-hidden="true">↗</span>
            </Link>
            <Link className="text-link" href="/app/overview">
              Open mission control <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="campaign-foot" aria-hidden="true">
          <span>Scroll to inspect the system</span>
          <span>Sepolia · KeeperHub · Independent RPC</span>
        </div>
      </section>

      <section className="statement-section" data-reveal>
        <p className="eyebrow">The missing layer</p>
        <h2>
          A TRANSACTION CAN SUCCEED
          <br />
          WHILE THE MISSION FAILS.
        </h2>
        <p>
          Execution is only one moment. Aether holds the entire objective: what
          the agent intended, what the chain proves, what cannot be repeated,
          and which safe state is still authorized.
        </p>
      </section>

      <section id="system" className="system-story" aria-label="Aether system">
        <div className="system-intro" data-reveal>
          <p className="eyebrow">One continuous record</p>
          <h2>FROM INTENT TO PROOF.</h2>
          <p>
            Six phases. One immutable chain of evidence. No hidden jump from
            provider response to “success.”
          </p>
        </div>
        <div className="phase-rail">
          {phases.map(([number, title, description], index) => (
            <article
              className="phase-card"
              key={title}
              data-reveal
              style={{ "--reveal-delay": `${index * 55}ms` } as CSSProperties}
            >
              <div className="phase-index">
                <span>{number}</span>
                <i aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="unknown-feature">
        <div className="unknown-visual" aria-hidden="true" data-reveal>
          <div className="signal-card signal-card-request">
            <span>KEEPERHUB REQUEST</span>
            <strong>SUBMITTED</strong>
            <small>14:28:09.042</small>
          </div>
          <div className="signal-gap">
            <span>RESPONSE LOST</span>
          </div>
          <div className="signal-card signal-card-lock">
            <span>AETHER CONTROL</span>
            <strong>RETRY LOCKED</strong>
            <small>Reconciliation active</small>
          </div>
          <svg viewBox="0 0 600 250" role="presentation">
            <path d="M40 124 C160 124 160 50 290 50 S430 124 560 124" />
            <path
              className="signal-return"
              d="M290 50 C355 50 355 205 460 205"
            />
          </svg>
        </div>
        <div className="unknown-copy" data-reveal>
          <p className="eyebrow">Uncertainty, handled honestly</p>
          <h2>UNKNOWN IS A STATE. NOT AN EXCUSE TO RETRY.</h2>
          <p>
            When a response disappears after a possible broadcast, Aether stops
            the duplicate before it happens. It reconciles provider and chain
            evidence, proves whether the original write landed, then
            continues—or escalates without inventing certainty.
          </p>
          <Link className="pill pill-primary" href="/demo">
            See unknown outcome live
          </Link>
        </div>
      </section>

      <section id="agents" className="agent-section">
        <div className="agent-heading" data-reveal>
          <p className="eyebrow">Built for real agent workflows</p>
          <h2>GIVE AGENTS A SAFE WAY TO FINISH.</h2>
        </div>
        <div className="agent-grid">
          <a
            className="agent-tile agent-tile-dark"
            href={`${agentsRuntime}?product=savings`}
            data-reveal
          >
            <span>01 / Savings</span>
            <div className="agent-symbol" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div>
              <h3>Deposit with a verified exit.</h3>
              <p>
                Preview the plan, sign ownership, follow each write, and keep
                recovery inside frozen authority.
              </p>
              <strong>Open savings agent →</strong>
            </div>
          </a>
          <a
            className="agent-tile agent-tile-light"
            href={`${agentsRuntime}?product=lending`}
            data-reveal
            style={{ "--reveal-delay": "90ms" } as CSSProperties}
          >
            <span>02 / Lending</span>
            <div className="position-graphic" aria-hidden="true">
              <span>SUPPLY</span>
              <i />
              <span>BORROW</span>
              <i />
              <span>RESTORE</span>
            </div>
            <div>
              <h3>Close the cycle—or prove the safe state.</h3>
              <p>
                Supply, borrow, repay, withdraw, and revoke with every effect
                independently accounted for.
              </p>
              <strong>Open lending agent →</strong>
            </div>
          </a>
        </div>
      </section>

      <section className="proof-section">
        <div className="proof-copy" data-reveal>
          <p className="eyebrow">Deterministic authority</p>
          <h2>AI CAN EXPLAIN. IT CANNOT SPEND.</h2>
        </div>
        <div className="proof-list">
          {[
            ["Every write", "Simulated and submitted through KeeperHub"],
            ["Every effect", "Verified from independent Sepolia evidence"],
            ["Every approval", "Bound to one immutable plan hash"],
            ["Every recovery", "Predeclared, bounded, and verified again"],
            ["Every terminal state", "Closed by critical invariant proof"],
          ].map(([label, value], index) => (
            <div key={label} data-reveal>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{label}</strong>
              <p>{value}</p>
              <i aria-hidden="true">✓</i>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta" data-reveal>
        <p className="eyebrow">Mission control is ready</p>
        <h2>MAKE IRREVERSIBLE WORK RECOVERABLE.</h2>
        <div>
          <Link className="pill pill-on-dark" href="/signup">
            Create your workspace
          </Link>
          <Link className="text-link text-link-light" href="/demo">
            Explore the Sepolia demo →
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <Link className="brand brand-lockup" href="/">
          <Image
            src="/brand/aether-mark-mono.svg"
            alt=""
            width={26}
            height={26}
          />
          <span>AETHER</span>
        </Link>
        <p>Mission control for autonomous onchain agents.</p>
        <nav aria-label="Footer navigation">
          <Link href="/demo">Demo</Link>
          <LandingSessionLink />
          <Link href="/signup">Create account</Link>
        </nav>
        <small>
          KeeperHub executes. Independent RPC providers verify. Groq advisory
          analysis has zero transaction authority.
        </small>
      </footer>
    </main>
  );
}
