"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AetherClient } from "@aether/sdk";
import {
  ConsoleShell,
  Empty,
  LoadingBlock,
  PageHeader,
} from "@/components/app/console-shell";

const api = new AetherClient(process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1");

function short(value: unknown) {
  const text = String(value ?? "");
  return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text;
}

function formatDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.valueOf()) ? "Not recorded" : date.toLocaleString();
}

function humanizeEvent(value: unknown) {
  return String(value ?? "event")
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const guardrails = [
  ["Write network", "Ethereum Sepolia only"],
  ["Execution", "KeeperHub Direct Execution"],
  ["Verification", "Two independent RPC providers"],
  ["Uncertain result", "Replay remains locked"],
] as const;

export function OperationsOverview() {
  const missions = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.listMissions(),
  });
  const approvals = useQuery({
    queryKey: ["approvals"],
    queryFn: () => api.approvals(),
  });
  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: () => api.audit(),
  });

  const missionItems = missions.data?.items ?? [];
  const approvalItems = approvals.data?.items ?? [];
  const auditItems = audit.data?.items ?? [];
  const pendingApprovals = approvalItems.filter(
    (item) => item.status === "PENDING",
  ).length;
  const loading = missions.isLoading || approvals.isLoading || audit.isLoading;

  const posture = useMemo(() => {
    if (pendingApprovals > 0) {
      return {
        tone: "warn" as const,
        kicker: "Authority required",
        title: `${pendingApprovals} exact plan${pendingApprovals === 1 ? "" : "s"} waiting for a human decision.`,
        body: "Simulation already bound the plan hash. Approve or deny from the queue before KeeperHub can submit.",
        href: "/app/approvals",
        cta: "Review approvals",
      };
    }
    if (!missionItems.length) {
      return {
        tone: "neutral" as const,
        kicker: "Workspace ready",
        title: "No missions are defined yet.",
        body: "Freeze a multi-step objective with proofs and recovery rules, then start a run from the mission page.",
        href: "/app/missions/new",
        cta: "Create mission",
      };
    }
    return {
      tone: "ok" as const,
      kicker: "All systems operational",
      title: "Missions are inside their authorized envelope.",
      body: "No pending approvals are blocking progress. Unknown outcomes remain retry-locked until independently reconciled.",
      href: "/app/missions",
      cta: "Browse missions",
    };
  }, [missionItems.length, pendingApprovals]);

  const metrics: Array<{
    label: string;
    value: number;
    detail: string;
    href: string;
    emphasize?: boolean;
  }> = [
    {
      label: "Total missions",
      value: missionItems.length,
      detail: "Frozen definitions",
      href: "/app/missions",
    },
    {
      label: "Pending authority",
      value: pendingApprovals,
      detail: "Exact plans awaiting review",
      href: "/app/approvals",
      emphasize: pendingApprovals > 0,
    },
    {
      label: "Evidence events",
      value: auditItems.length,
      detail: "Append-only audit records",
      href: "/app/audit",
    },
  ];

  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Mission control"
        title="Operations"
        description="Intent, execution, chain reality, and recovery across every agent mission in this workspace."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/missions"
              className="box-btn box-btn-secondary inline-flex min-h-11 items-center border border-black bg-white px-5 text-[13px] font-semibold no-underline transition-colors hover:bg-[#f5f5f5]"
            >
              All missions
            </Link>

            <Link
              href="/app/missions/new"
              className="box-btn box-btn-primary inline-flex min-h-11 items-center border border-black bg-black px-5 text-[13px] font-semibold no-underline transition-opacity hover:opacity-90"
            >
              Create mission <span aria-hidden="true">＋</span>
            </Link>
          </div>
        }
      />

      {/* Command strip — boxy black panel */}
      <section
        aria-label="Operational summary"
        className={[
          "relative mt-2 grid min-h-[280px] grid-cols-1 overflow-hidden border border-black bg-[#111] text-white lg:grid-cols-[minmax(0,1.4fr)_220px]",
          posture.tone === "warn"
            ? "bg-[linear-gradient(135deg,#1a1208_0%,#111_55%)]"
            : "",
        ].join(" ")}
      >
        <div className="relative z-[1] flex flex-col justify-center gap-4 p-8 md:p-10">
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#c7c7c7]">
            <i
              className={[
                "inline-block size-1.5 rounded-full",
                posture.tone === "warn"
                  ? "bg-[#f0b429]"
                  : posture.tone === "ok"
                    ? "bg-[#1eaa52]"
                    : "bg-[#9e9ea0]",
              ].join(" ")}
              aria-hidden="true"
            />
            {posture.kicker}
          </span>
          <h2 className="m-0 max-w-[34ch] text-[clamp(28px,3.6vw,48px)] font-medium leading-[0.98] tracking-[-0.04em]">
            {posture.title}
          </h2>
          <p className="m-0 max-w-[52ch] text-[15px] leading-relaxed text-[#9e9ea0]">
            {posture.body}
          </p>
          <div className="mt-2">
            <Link
              href={posture.href}
              className="inline-flex min-h-11 items-center border border-white/20 bg-white/10 px-5 text-[13px] font-semibold text-white no-underline transition-colors hover:bg-white/16"
            >
              {posture.cta} →
            </Link>
          </div>
        </div>

        {/* Boxy mark instead of circular orbit */}
        <div
          className="relative hidden items-center justify-center border-l border-white/10 lg:flex"
          aria-hidden="true"
        >
          <div className="grid size-[168px] place-items-center border border-white/20">
            <div className="grid size-[108px] place-items-center border border-white/25">
              <div className="grid size-14 place-items-center bg-white text-[22px] font-extrabold tracking-tight text-black">
                A
              </div>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="mt-3">
          <LoadingBlock label="Loading workspace summary" rows={4} />
        </div>
      ) : (
        <>
          {/* Metrics — continuous boxy grid */}
          <section
            aria-label="Workspace metrics"
            className="mt-0 grid border border-t-0 border-black sm:grid-cols-3"
          >
            {metrics.map((metric) => (
              <Link
                key={metric.label}
                href={metric.href}
                className={[
                  "group flex min-h-[168px] flex-col border-black bg-white p-6 no-underline transition-colors hover:bg-[#f5f5f5] sm:border-r sm:last:border-r-0",
                  "border-b sm:border-b-0 last:border-b-0",
                  metric.emphasize ? "bg-[#fff8f0]" : "",
                ].join(" ")}
              >
                <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#707072]">
                  {metric.label}
                </span>
                <strong
                  className={[
                    "mt-auto text-[clamp(44px,5vw,58px)] font-medium leading-none tracking-[-0.05em]",
                    metric.emphasize ? "text-[#9a5b00]" : "text-black",
                  ].join(" ")}
                >
                  {metric.value}
                </strong>
                <small className="mt-3 text-[12px] text-[#707072]">
                  {metric.detail}
                  <span className="ml-2 opacity-0 transition-opacity group-hover:opacity-100">
                    →
                  </span>
                </small>
              </Link>
            ))}
          </section>

          {/* Two-column boxy panels */}
          <div className="mt-0 grid border border-t-0 border-black lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            {/* Activity */}
            <section className="border-b border-black bg-white lg:border-b-0 lg:border-r">
              <header className="flex items-end justify-between gap-4 border-b border-[#e5e5e5] px-6 py-5">
                <div>
                  <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[#707072]">
                    Live record
                  </p>
                  <h2 className="m-0 mt-1 text-[22px] font-medium tracking-[-0.03em] text-black">
                    Recent activity
                  </h2>
                </div>
                <Link
                  href="/app/audit"
                  className="text-[13px] font-semibold text-black underline-offset-4 hover:underline"
                >
                  View audit →
                </Link>
              </header>

              <div className="divide-y divide-[#e5e5e5]">
                {auditItems.length ? (
                  auditItems.slice(0, 6).map((item, index) => (
                    <div
                      key={String(item.eventId)}
                      className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-3 px-6 py-4"
                    >
                      <span className="font-mono text-[11px] text-[#9e9ea0]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <strong className="block text-[14px] font-semibold tracking-[-0.01em] text-black">
                          {humanizeEvent(item.eventType)}
                        </strong>
                        <p className="m-0 mt-1 truncate text-[12px] text-[#707072]">
                          {String(item.subjectType ?? "subject").replaceAll(
                            "_",
                            " ",
                          )}{" "}
                          · {short(item.subjectId)}
                        </p>
                      </div>
                      <small className="whitespace-nowrap text-[11px] text-[#9e9ea0]">
                        {formatDate(item.createdAt)}
                      </small>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2">
                    <Empty
                      title="The record is quiet"
                      body="Mission transitions, approvals, and chain evidence will appear here."
                      action={
                        <Link
                          href="/app/missions/new"
                          className="inline-flex min-h-10 items-center border border-black bg-white px-4 text-[13px] font-semibold text-black no-underline hover:bg-[#f5f5f5]"
                        >
                          Create first mission
                        </Link>
                      }
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Missions + guardrails */}
            <section className="bg-white">
              <header className="flex items-end justify-between gap-4 border-b border-[#e5e5e5] px-6 py-5">
                <div>
                  <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[#707072]">
                    Definitions
                  </p>
                  <h2 className="m-0 mt-1 text-[22px] font-medium tracking-[-0.03em] text-black">
                    Missions
                  </h2>
                </div>
                <Link
                  href="/app/missions"
                  className="text-[13px] font-semibold text-black underline-offset-4 hover:underline"
                >
                  View all →
                </Link>
              </header>

              {missionItems.length ? (
                <div className="divide-y divide-[#e5e5e5]">
                  {missionItems.slice(0, 4).map((mission) => (
                    <Link
                      key={String(mission.missionId)}
                      href={`/app/missions/${String(mission.missionId)}`}
                      className="flex items-center justify-between gap-4 px-6 py-4 no-underline transition-colors hover:bg-[#f5f5f5]"
                    >
                      <div className="min-w-0">
                        <strong className="block truncate text-[14px] font-semibold text-black">
                          {String(mission.name)}
                        </strong>
                        <p className="m-0 mt-1 line-clamp-2 text-[12px] text-[#707072]">
                          {String(mission.description ?? "No description")}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold text-black">
                        Open →
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-2">
                  <Empty
                    title="No missions yet"
                    body="Create a mission to freeze steps, proofs, and recovery rules."
                  />
                </div>
              )}

              <div className="border-t border-black">
                <div className="border-b border-[#e5e5e5] px-6 py-4">
                  <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[#707072]">
                    Execution boundary
                  </p>
                  <h3 className="m-0 mt-1 text-[16px] font-medium tracking-[-0.02em] text-black">
                    Guardrails that cannot be bypassed
                  </h3>
                </div>
                <dl className="m-0 divide-y divide-[#e5e5e5]">
                  {guardrails.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-1 gap-1 px-6 py-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4"
                    >
                      <dt className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#9e9ea0]">
                        {label}
                      </dt>
                      <dd className="m-0 text-[13px] font-medium text-black">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="border-t border-[#e5e5e5] px-6 py-4">
                  <Link
                    href="/app/settings/policy"
                    className="inline-flex min-h-10 items-center border border-black bg-white px-4 text-[13px] font-semibold text-black no-underline hover:bg-[#f5f5f5]"
                  >
                    Review policy
                  </Link>
                </div>
              </div>
            </section>
          </div>

          {/* Bottom action strip */}
          <section
            aria-label="Quick actions"
            className="grid border border-t-0 border-black sm:grid-cols-3"
          >
            {[
              {
                label: "Start a run",
                detail: "From a frozen mission definition",
                href: "/app/missions",
              },
              {
                label: "Authority queue",
                detail:
                  pendingApprovals > 0
                    ? `${pendingApprovals} waiting`
                    : "No pending plans",
                href: "/app/approvals",
              },
              {
                label: "Demo scenarios",
                detail: "Controlled fault injection",
                href: "/demo",
              },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex min-h-[96px] flex-col justify-center border-b border-black bg-[#f5f5f5] px-6 py-5 no-underline transition-colors hover:bg-white sm:border-b-0 sm:border-r sm:last:border-r-0"
              >
                <strong className="text-[14px] font-semibold text-black">
                  {item.label}
                </strong>
                <span className="mt-1 text-[12px] text-[#707072]">
                  {item.detail}
                </span>
              </Link>
            ))}
          </section>
        </>
      )}
    </ConsoleShell>
  );
}

export default OperationsOverview;
