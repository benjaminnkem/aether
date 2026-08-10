"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AetherClient } from "@aether/sdk";

const api = new AetherClient(process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1");

const navigation = [
  ["Overview", "/app/overview", "Live posture"],
  ["Missions", "/app/missions", "Definitions"],
  ["Approvals", "/app/approvals", "Authority"],
  ["Audit", "/app/audit", "Evidence"],
  ["Settings", "/app/settings/integrations", "Workspace"],
] as const;

function initials(value: string) {
  const parts = value.split(/[\s@._-]+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "AE"
  );
}

function formatHeaderDate(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api.session(),
    staleTime: 30_000,
    retry: false,
  });
  const user = session.data?.user as Record<string, unknown> | undefined;
  const context = session.data?.context as Record<string, unknown> | undefined;
  const email = typeof user?.email === "string" ? user.email : "";
  const workspaceName =
    typeof context?.workspaceName === "string"
      ? context.workspaceName
      : typeof context?.workspaceId === "string"
        ? `Workspace ${String(context.workspaceId).slice(0, 8)}`
        : "Workspace";
  const role =
    typeof context?.role === "string" ? String(context.role) : "Operator";

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
          {navigation.map(([label, href, detail], index) => {
            const active =
              href === "/app/settings/integrations"
                ? pathname.startsWith("/app/settings")
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden="true">
                  {["I", "II", "III", "IV", "V"][index]}
                </span>
                <span className="console-nav-copy">
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="console-sidebar-foot">
          <div className="console-network">
            <i aria-hidden="true" />
            <span>
              <strong>Ethereum Sepolia</strong>
              Write network only
            </span>
          </div>
          <Link className="console-demo-link" href="/demo">
            Open demo scenarios <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </aside>
      <div className="console-stage">
        <header className="console-topbar">
          <div className="console-topbar-live">
            <span className="console-live-dot" aria-hidden="true" />
            <span>
              <strong>Mission engine</strong>
              <small>Independent verify · retry-locked unknowns</small>
            </span>
          </div>
          <div className="console-topbar-user">
            <div className="console-user-copy">
              <strong>{workspaceName}</strong>
              <small>
                {email || "Signed-in operator"} · {role.replaceAll("_", " ")}
              </small>
            </div>
            <span className="console-avatar" aria-hidden="true">
              {initials(email || workspaceName)}
            </span>
            <button
              type="button"
              className="console-signout"
              onClick={async () => {
                try {
                  await api.logout();
                } finally {
                  window.location.assign("/login");
                }
              }}
            >
              Sign out
            </button>
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
  breadcrumbs,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}) {
  return (
    <header className="page-header">
      <div>
        {breadcrumbs?.length ? (
          <nav className="console-breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`}>
                {index > 0 ? (
                  <span className="console-breadcrumbs-sep" aria-hidden="true">
                    /
                  </span>
                ) : null}
                {crumb.href ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <p className="eyebrow">
          {eyebrow.includes("·")
            ? eyebrow
            : `${formatHeaderDate()} · ${eyebrow}`}
        </p>
        <h1>{title}</h1>
        <p className="lede">{description}</p>
      </div>
      {action ? <div className="page-header-actions">{action}</div> : null}
    </header>
  );
}

export function Status({ value }: { value: unknown }) {
  const text = String(value ?? "UNKNOWN").replaceAll("_", " ");
  const tone =
    /COMPLETED|RECOVERED|VERIFIED|PASS|APPROVED|ACTIVE|IMMUTABLE/.test(text)
      ? "ok"
      : /FAILED|DENIED|REVOKED|ABORTED/.test(text)
        ? "bad"
        : /UNKNOWN|LOCKED|RECONCILING|ATTENTION|RECOVERING|PENDING|DEGRADED|AWAITING/.test(
              text,
            )
          ? "warn"
          : "neutral";
  return (
    <span className={`status status-${tone}`}>
      <i aria-hidden="true" />
      {text}
    </span>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({
  label = "Loading…",
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div className="loading-row" key={index} aria-hidden="true" />
      ))}
    </div>
  );
}

export function CopyValue({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="copy-value"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          /* clipboard may be unavailable */
        }
      }}
      aria-label={`${label} ${value}`}
    >
      <span className="mono">{value}</span>
      <span aria-hidden="true">Copy</span>
    </button>
  );
}
