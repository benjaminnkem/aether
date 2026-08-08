import Link from "next/link";

const agentsRuntime =
  process.env.AETHER_AGENT_RUNTIME_ORIGIN ?? "http://localhost:3001";

export default function HomePage() {
  return (
    <main id="main-content">
      <header className="landing-nav">
        <span className="brand">AETHER</span>
        <nav>
          <Link href="/demo">Demo</Link>
          <Link href="/login">Sign in</Link>
          <Link className="pill pill-primary" href="/signup">
            Create account
          </Link>
        </nav>
      </header>
      <section className="landing-hero">
        <p className="eyebrow">Mission control for onchain agents</p>
        <h1>
          KNOW WHAT LANDED.
          <br />
          RECOVER WHAT DIDN’T.
        </h1>
        <p>
          Aether records each intended Sepolia write, verifies chain reality
          independently, locks unsafe retries when a result is uncertain, and
          executes only pre-authorized recovery actions.
        </p>
        <div className="actions">
          <Link
            className="pill pill-secondary"
            href={`${agentsRuntime}?product=savings`}
          >
            Open savings agent
          </Link>
          <Link
            className="pill pill-secondary"
            href={`${agentsRuntime}?product=lending`}
          >
            Open lending agent app
          </Link>

          <Link className="pill pill-secondary" href="/app/overview">
            Open mission control
          </Link>

          <Link className="pill pill-primary" href="/demo">
            View Demos
          </Link>
        </div>
      </section>
      <section className="process" aria-label="Aether execution process">
        {["Define", "Execute", "Observe", "Reconcile", "Recover", "Prove"].map(
          (item, index) => (
            <div key={item}>
              <span>0{index + 1}</span>
              <strong>{item}</strong>
            </div>
          ),
        )}
      </section>
      <section className="landing-section">
        <div>
          <p className="eyebrow">Why mission-level records matter</p>
          <h2>
            A transaction provider can submit a write. A mission still needs to
            know what happened next.
          </h2>
        </div>
        <div className="fact-grid">
          <article>
            <h3>Intent is frozen</h3>
            <p>
              Plans, request hashes, simulations, policy, and approvals bind to
              the exact economic action.
            </p>
          </article>
          <article>
            <h3>Chain reality wins</h3>
            <p>
              KeeperHub executes. Two Sepolia RPC providers independently verify
              receipts and declared postconditions.
            </p>
          </article>
          <article>
            <h3>Unknown means locked</h3>
            <p>
              A lost response never triggers a blind duplicate. Reconciliation
              proves landed, safe to retry, or indeterminate.
            </p>
          </article>
          <article>
            <h3>Recovery is another mission</h3>
            <p>
              Compensation is simulated, authorized, executed, checkpointed, and
              verified like forward work.
            </p>
          </article>
        </div>
      </section>
      <footer>
        <span>Aether</span>
        <p>
          KeeperHub provides transaction execution. Optional incident summaries
          may be provided by Groq and have no transaction authority.
        </p>
      </footer>
    </main>
  );
}
