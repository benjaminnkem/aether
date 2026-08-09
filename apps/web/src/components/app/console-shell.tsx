"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  ["Overview", "/app/overview"],
  ["Missions", "/app/missions"],
  ["Approvals", "/app/approvals"],
  ["Audit", "/app/audit"],
  ["Settings", "/app/settings/integrations"],
] as const;

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="console-shell">
      <aside className="console-header">
        <Link
          className="brand console-brand"
          href="/app/overview"
          aria-label="Aether overview"
        >
          <span className="console-brand-mark" aria-hidden="true">
            A
          </span>
          <span>AETHER</span>
        </Link>
        <nav aria-label="Primary navigation">
          {navigation.map(([label, href], index) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
            >
              <span aria-hidden="true">
                {["I", "II", "III", "IV", "V"][index]}
              </span>
              <strong>{label}</strong>
            </Link>
          ))}
        </nav>
        <div className="console-sidebar-foot">
          <div className="console-network">
            <i aria-hidden="true" />
            <span>
              <strong>Sepolia</strong>Write network
            </span>
          </div>
          <Link className="console-demo-link" href="/demo">
            Open demo <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </aside>
      <div className="console-stage">
        <header className="console-topbar">
          <div>
            <span className="console-live-dot" aria-hidden="true" />
            <span>Mission engine online</span>
          </div>
          <div>
            <span>Northstar workspace</span>
            <span className="console-avatar" aria-hidden="true">
              NS
            </span>
          </div>
        </header>
        <main id="main-content" className="console-main">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lede">{description}</p>
      </div>
      {action}
    </header>
  );
}

export function Status({ value }: { value: unknown }) {
  const text = String(value ?? "UNKNOWN").replaceAll("_", " ");
  const tone = /COMPLETED|RECOVERED|VERIFIED|PASS|APPROVED/.test(text)
    ? "ok"
    : /FAILED|DENIED/.test(text)
      ? "bad"
      : /UNKNOWN|LOCKED|RECONCILING|ATTENTION|RECOVERING/.test(text)
        ? "warn"
        : "neutral";
  return <span className={`status status-${tone}`}>{text}</span>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}
