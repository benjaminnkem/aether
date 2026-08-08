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
      <header className="console-header">
        <Link
          className="brand"
          href="/app/overview"
          aria-label="Aether overview"
        >
          AETHER
        </Link>
        <nav aria-label="Primary navigation">
          {navigation.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link className="pill pill-secondary" href="/demo">
          Demo
        </Link>
      </header>
      <main id="main-content" className="console-main">
        {children}
      </main>
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
    : /UNKNOWN|LOCKED|RECONCILING|ATTENTION|FAILED|DENIED/.test(text)
      ? "bad"
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
