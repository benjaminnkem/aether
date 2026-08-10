"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  ExternalLink,
  FileCheck2,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Network,
  ScrollText,
  Settings,
  Target,
} from "lucide-react";
import { AetherClient } from "@aether/sdk";

const api = new AetherClient(process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1");

type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number | string }
>;

const primaryNav: Array<{
  label: string;
  href: string;
  detail: string;
  icon: IconComponent;
  match: "exact" | "prefix" | "settings";
}> = [
  {
    label: "Operations",
    href: "/app/overview",
    detail: "Live posture",
    icon: LayoutDashboard,
    match: "exact",
  },
  {
    label: "Missions",
    href: "/app/missions",
    detail: "Definitions",
    icon: Target,
    match: "prefix",
  },
  {
    label: "Approvals",
    href: "/app/approvals",
    detail: "Authority",
    icon: FileCheck2,
    match: "prefix",
  },
  {
    label: "Audit",
    href: "/app/audit",
    detail: "Evidence",
    icon: ScrollText,
    match: "prefix",
  },
];

const workspaceNav: Array<{
  label: string;
  href: string;
  detail: string;
  icon: IconComponent;
  match: "settings";
}> = [
  {
    label: "Settings",
    href: "/app/settings/integrations",
    detail: "Workspace",
    icon: Settings,
    match: "settings",
  },
];

function isActive(pathname: string, href: string, match: string) {
  if (match === "settings") return pathname.startsWith("/app/settings");
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

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

function NavLink({
  label,
  href,
  detail,
  icon: Icon,
  active,
}: {
  label: string;
  href: string;
  detail: string;
  icon: IconComponent;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative flex min-h-12 items-center gap-3 border border-transparent px-3 text-left no-underline transition-colors",
        active
          ? "border-white/15 bg-white"
          : "hover:border-white/10 hover:bg-white/[0.06]",
      ].join(" ")}
    >
      <span
        className={[
          "grid size-8 shrink-0 place-items-center border",
          active
            ? "border-black/15 bg-[#f5f5f5] text-black"
            : "border-white/12 bg-transparent text-[#9e9ea0] group-hover:text-white",
        ].join(" ")}
        aria-hidden="true"
      >
        <Icon size={16} strokeWidth={1.75} className="text-current" />
      </span>
      <span className="min-w-0 flex-1">
        <strong
          className={[
            "block text-[13px] font-semibold tracking-[-0.01em]",
            active
              ? "text-black"
              : "text-[#c8c8c8] group-hover:text-white",
          ].join(" ")}
        >
          {label}
        </strong>
        <small
          className={[
            "mt-0.5 block text-[10px] font-medium uppercase tracking-[0.08em]",
            active ? "text-[#525252]" : "text-[#707072] group-hover:text-[#9e9ea0]",
          ].join(" ")}
        >
          {detail}
        </small>
      </span>
      {active ? (
        <span
          className="absolute inset-y-0 left-0 w-[2px] bg-black"
          aria-hidden="true"
        />
      ) : null}
    </Link>
  );
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
      <aside className="console-header flex h-screen flex-col border-r border-black bg-[#111] text-white">
        {/* Brand */}
        <div className="border-b border-white/10 px-4 py-5">
          <Link
            href="/app/overview"
            aria-label="Aether overview"
            className="flex items-center gap-3 no-underline"
          >
            <span
              className="grid size-9 place-items-center border border-white bg-white text-[13px] font-extrabold tracking-tight text-black"
              aria-hidden="true"
            >
              A
            </span>
            <span className="console-brand-wordmark text-[15px] font-semibold tracking-[0.14em]">
              AETHER
            </span>
          </Link>
        </div>

        {/* Primary nav */}
        <nav
          aria-label="Primary navigation"
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-5"
        >
          <div>
            <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#707072]">
              Control
            </p>
            <div className="grid gap-1">
              {primaryNav.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  active={isActive(pathname, item.href, item.match)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#707072]">
              Workspace
            </p>
            <div className="grid gap-1">
              {workspaceNav.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  active={isActive(pathname, item.href, item.match)}
                />
              ))}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t border-white/10">
          <div className="flex items-start gap-3 border-b border-white/10 px-4 py-4">
            <span
              className="mt-0.5 grid size-8 shrink-0 place-items-center border border-white/15 text-[#9e9ea0]"
              aria-hidden="true"
            >
              <Network size={15} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <i
                  className="inline-block size-1.5 bg-[#1eaa52]"
                  aria-hidden="true"
                />
                <strong className="text-[12px] font-semibold text-white">
                  Ethereum Sepolia
                </strong>
              </div>
              <p className="m-0 mt-1 text-[11px] leading-snug text-[#707072]">
                Only live write network. Mainnet is prohibited.
              </p>
            </div>
          </div>

          <Link
            href="/demo"
            className="flex min-h-12 items-center justify-between gap-3 px-4 text-[13px] font-semibold text-white no-underline transition-colors hover:bg-white/[0.06]"
          >
            <span className="inline-flex items-center gap-2.5">
              <FlaskConical size={16} strokeWidth={1.75} aria-hidden="true" />
              Demo scenarios
            </span>
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      </aside>

      <div className="console-stage min-w-0">
        <header className="console-topbar flex h-16 items-center justify-between border-b border-[#e5e5e5] bg-[rgba(245,245,245,0.96)] px-8 text-[12px] text-[#707072] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span
              className="inline-block size-1.5 bg-[#1eaa52]"
              aria-hidden="true"
            />
            <span>
              <strong className="block text-[12px] font-semibold text-black">
                Mission engine
              </strong>
              <small className="block text-[11px] text-[#707072]">
                Independent verify · retry-locked unknowns
              </small>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <strong className="block text-[12px] font-semibold text-black">
                {workspaceName}
              </strong>
              <small className="block text-[11px] text-[#707072]">
                {email || "Signed-in operator"} · {role.replaceAll("_", " ")}
              </small>
            </div>
            <span
              className="grid size-8 place-items-center border border-black bg-black text-[10px] font-bold text-white"
              aria-hidden="true"
            >
              {initials(email || workspaceName)}
            </span>
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-2 border border-[#cacacb] bg-white px-3.5 text-[12px] font-semibold text-black transition-colors hover:bg-[#f5f5f5]"
              onClick={async () => {
                try {
                  await api.logout();
                } finally {
                  window.location.assign("/login");
                }
              }}
            >
              <LogOut size={14} strokeWidth={1.75} aria-hidden="true" />
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
