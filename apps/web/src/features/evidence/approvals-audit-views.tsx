"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Clock3,
  FileCheck2,
  Filter,
  Search,
  ScrollText,
  ShieldAlert,
  X,
} from "lucide-react";
import { AetherClient, getAetherErrorMessage } from "@aether/sdk";
import {
  ConsoleShell,
  CopyValue,
  Empty,
  LoadingBlock,
  PageHeader,
  Status,
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

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      )
    : [];
}

function humanizeEvent(value: unknown) {
  return String(value ?? "event")
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function boxButton(primary = false) {
  return primary
    ? "box-btn box-btn-primary inline-flex min-h-11 items-center gap-2 border border-black bg-black px-5 text-[13px] font-semibold !text-white no-underline transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:!text-white"
    : "box-btn box-btn-secondary inline-flex min-h-11 items-center gap-2 border border-black bg-white px-5 text-[13px] font-semibold !text-black no-underline transition-colors hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:!text-black";
}

type ApprovalFilter = "all" | "PENDING" | "APPROVED" | "DENIED";

export function ApprovalsView({ approvalId }: { approvalId?: string }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ApprovalFilter>("all");
  const query = useQuery({
    queryKey: ["approvals", approvalId],
    queryFn: () => (approvalId ? api.approval(approvalId) : api.approvals()),
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: "approve" | "deny";
    }) =>
      api.decideApproval(
        id,
        decision,
        decision === "approve"
          ? "Approved in operator console."
          : "Denied in operator console.",
      ),
    onSuccess: async (_data, variables) => {
      toast.success(
        variables.decision === "approve"
          ? "Exact plan approved."
          : "Exact plan denied.",
      );
      await queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (error) =>
      toast.error(
        getAetherErrorMessage(error, "Approval decision could not be saved."),
      ),
  });

  const allItems = useMemo(() => {
    if (approvalId) {
      return query.data ? [query.data as Record<string, unknown>] : [];
    }
    return asArray((query.data as Record<string, unknown> | undefined)?.items);
  }, [approvalId, query.data]);

  const counts = useMemo(() => {
    return {
      all: allItems.length,
      PENDING: allItems.filter((item) => item.status === "PENDING").length,
      APPROVED: allItems.filter((item) => item.status === "APPROVED").length,
      DENIED: allItems.filter((item) => item.status === "DENIED").length,
    };
  }, [allItems]);

  const items = useMemo(() => {
    if (filter === "all") return allItems;
    return allItems.filter((item) => item.status === filter);
  }, [allItems, filter]);

  const filters: Array<{ id: ApprovalFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "PENDING", label: "Pending" },
    { id: "APPROVED", label: "Approved" },
    { id: "DENIED", label: "Denied" },
  ];

  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Authority"
        title="Approvals"
        description="Each decision is bound to one immutable plan hash and expiry. AI cannot approve or alter authority."
        action={
          <Link href="/app/missions" className={boxButton(false)}>
            Browse missions
          </Link>
        }
      />

      {/* Summary strip */}
      <section
        aria-label="Approval summary"
        className="grid border border-t-0 border-black sm:grid-cols-4"
      >
        {[
          ["Pending", counts.PENDING, "Need a human decision"],
          ["Approved", counts.APPROVED, "Bound plan authorized"],
          ["Denied", counts.DENIED, "Bound plan rejected"],
          ["Total", counts.all, "Records in workspace"],
        ].map(([label, value, detail], index, arr) => (
          <div
            key={String(label)}
            className={[
              "min-h-[100px] bg-white px-5 py-4",
              "border-b border-black sm:border-b-0",
              index < arr.length - 1 ? "sm:border-r" : "",
              label === "Pending" && Number(value) > 0 ? "bg-[#fff8f0]" : "",
            ].join(" ")}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#707072]">
              {label}
            </span>
            <strong
              className={[
                "mt-2 block text-[clamp(28px,4vw,40px)] font-medium leading-none tracking-[-0.04em]",
                label === "Pending" && Number(value) > 0
                  ? "text-[#9a5b00]"
                  : "text-black",
              ].join(" ")}
            >
              {value}
            </strong>
            <p className="m-0 mt-2 text-[11px] text-[#707072]">{detail}</p>
          </div>
        ))}
      </section>

      <section className="border border-t-0 border-black bg-white">
        {/* Filters */}
        {!approvalId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black px-5 py-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#707072]">
              <Filter size={14} strokeWidth={1.75} aria-hidden="true" />
              Filter
            </div>
            <div className="flex flex-wrap gap-1">
              {filters.map((item) => {
                const active = filter === item.id;
                const count =
                  item.id === "all" ? counts.all : counts[item.id] || 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={[
                      "inline-flex min-h-9 items-center gap-2 border px-3 text-[12px] font-semibold transition-colors",
                      active
                        ? "border-black bg-black !text-white"
                        : "border-[#cacacb] bg-white !text-black hover:border-black",
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    {item.label}
                    <span
                      className={[
                        "min-w-5 border px-1.5 py-0.5 text-[10px]",
                        active
                          ? "border-white/30 text-white"
                          : "border-[#e5e5e5] text-[#707072]",
                      ].join(" ")}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {query.isLoading ? (
          <div className="p-5">
            <LoadingBlock label="Loading approvals" rows={3} />
          </div>
        ) : query.isError ? (
          <div className="p-5">
            <Empty
              title="Could not load approvals"
              body={getAetherErrorMessage(
                query.error,
                "Check the API connection and your session.",
              )}
              action={
                <button
                  type="button"
                  className={boxButton(false)}
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              }
            />
          </div>
        ) : items.length ? (
          <div className="divide-y divide-black">
            {items.map((item, index) => {
              const pending = item.status === "PENDING";
              const decidingThis =
                decide.isPending &&
                decide.variables?.id === String(item.approvalId);
              return (
                <article
                  key={String(item.approvalId)}
                  className={[
                    "grid gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1.4fr)_auto]",
                    pending ? "bg-[#fffdf8]" : "bg-white",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid size-8 place-items-center border border-black bg-white font-mono text-[11px] text-[#707072]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[#707072]">
                        {String(item.scope ?? "PLAN").replaceAll("_", " ")}
                      </p>
                      <Status value={item.status} />
                    </div>
                    <h2 className="m-0 mt-3 text-[20px] font-medium tracking-[-0.03em] text-black">
                      {String(item.scope ?? "Plan").replaceAll("_", " ")}{" "}
                      decision
                    </h2>
                    <p className="m-0 mt-2 max-w-[56ch] text-[13px] leading-relaxed text-[#525252]">
                      {pending
                        ? "Simulation already bound this exact plan hash. Approve only if the economic request matches intent."
                        : "Decision is already recorded for this plan hash and cannot be reused for a different request."}
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="border border-[#e5e5e5] bg-white px-3 py-3">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9e9ea0]">
                          Plan hash
                        </span>
                        <div className="mt-1">
                          <CopyValue
                            value={String(item.planHash ?? "")}
                            label="Copy plan hash"
                          />
                        </div>
                      </div>
                      <div className="border border-[#e5e5e5] bg-white px-3 py-3">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9e9ea0]">
                          Approval id
                        </span>
                        <div className="mt-1">
                          <CopyValue
                            value={String(item.approvalId ?? "")}
                            label="Copy approval id"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#707072]">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3
                          size={13}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        Created {formatDate(item.createdAt)}
                      </span>
                      <span>Expires {formatDate(item.expiresAt)}</span>
                      {item.runId ? (
                        <Link
                          href={`/app/runs/${String(item.runId)}`}
                          className="font-semibold text-black underline-offset-2 hover:underline"
                        >
                          Open run {short(item.runId)}
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-4 lg:min-w-[220px] lg:items-end">
                    <div className="hidden border border-black bg-[#f5f5f5] p-3 text-[11px] leading-relaxed text-[#525252] lg:block">
                      <span className="mb-1 inline-flex items-center gap-1.5 font-semibold text-black">
                        <ShieldAlert size={13} strokeWidth={1.75} />
                        Authority rule
                      </span>
                      AI cannot approve. Only a human operator may authorize the
                      exact simulated request.
                    </div>
                    {pending ? (
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          type="button"
                          className={boxButton(false)}
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({
                              id: String(item.approvalId),
                              decision: "deny",
                            })
                          }
                        >
                          <X size={15} strokeWidth={1.75} aria-hidden="true" />
                          {decidingThis && decide.variables?.decision === "deny"
                            ? "Denying…"
                            : "Deny"}
                        </button>
                        <button
                          type="button"
                          className={boxButton(true)}
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({
                              id: String(item.approvalId),
                              decision: "approve",
                            })
                          }
                        >
                          <Check
                            size={15}
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          {decidingThis &&
                          decide.variables?.decision === "approve"
                            ? "Approving…"
                            : "Approve exact plan"}
                        </button>
                      </div>
                    ) : (
                      <p className="m-0 border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-[12px] text-[#525252] lg:text-right">
                        Recorded decision — no further action on this hash.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-5">
            <Empty
              title={
                filter === "all"
                  ? "No approvals waiting"
                  : `No ${filter.toLowerCase()} approvals`
              }
              body={
                filter === "all"
                  ? "When a mission needs human authority, the exact simulated plan appears here with its hash and expiry."
                  : "Try another filter, or wait for a run that requires authority."
              }
              action={
                filter === "all" ? (
                  <Link href="/app/missions" className={boxButton(false)}>
                    Browse missions
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={boxButton(false)}
                    onClick={() => setFilter("all")}
                  >
                    Show all
                  </button>
                )
              }
            />
          </div>
        )}
      </section>

      <section
        aria-label="Approval principles"
        className="grid border border-t-0 border-black sm:grid-cols-3"
      >
        {[
          {
            icon: FileCheck2,
            title: "Hash-bound",
            body: "Approve only the exact plan that was simulated — not a similar request.",
          },
          {
            icon: Clock3,
            title: "Time-bound",
            body: "Approvals expire. Stale decisions cannot authorize a later write.",
          },
          {
            icon: ShieldAlert,
            title: "Human-only",
            body: "Groq may summarize incidents but never grants authority.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="border-b border-black bg-[#f5f5f5] px-5 py-5 sm:border-b-0 sm:border-r sm:last:border-r-0"
          >
            <item.icon
              size={16}
              strokeWidth={1.75}
              className="text-black"
              aria-hidden="true"
            />
            <strong className="mt-3 block text-[13px] font-semibold text-black">
              {item.title}
            </strong>
            <p className="m-0 mt-1 text-[12px] leading-relaxed text-[#707072]">
              {item.body}
            </p>
          </div>
        ))}
      </section>
    </ConsoleShell>
  );
}

type AuditFilter = "all" | "mission" | "run" | "approval" | "execution";

export function AuditView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AuditFilter>("all");
  const query = useQuery({ queryKey: ["audit"], queryFn: () => api.audit() });

  const allItems = query.data?.items ?? [];

  const items = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allItems.filter((item) => {
      const eventType = String(item.eventType ?? "").toLowerCase();
      const subjectType = String(item.subjectType ?? "").toLowerCase();
      const subjectId = String(item.subjectId ?? "").toLowerCase();
      const eventHash = String(item.eventHash ?? "").toLowerCase();

      const bucket: AuditFilter =
        subjectType.includes("approval") || eventType.includes("approval")
          ? "approval"
          : subjectType.includes("run") || eventType.includes("run")
            ? "run"
            : subjectType.includes("mission") || eventType.includes("mission")
              ? "mission"
              : eventType.includes("execut") ||
                  eventType.includes("submit") ||
                  eventType.includes("keeper")
                ? "execution"
                : "all";

      if (filter !== "all" && bucket !== filter) return false;
      if (!needle) return true;
      return [
        eventType,
        subjectType,
        subjectId,
        eventHash,
        humanizeEvent(item.eventType),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [allItems, filter, search]);

  const filters: Array<{ id: AuditFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "mission", label: "Mission" },
    { id: "run", label: "Run" },
    { id: "approval", label: "Approval" },
    { id: "execution", label: "Execution" },
  ];

  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Evidence"
        title="Audit"
        description="Append-only records for state, authority, execution, verification, and recovery."
        action={
          <Link href="/app/overview" className={boxButton(false)}>
            Operations
          </Link>
        }
      />

      <section className="grid border border-t-0 border-black sm:grid-cols-3">
        {[
          ["Events", allItems.length, "Total append-only records"],
          ["Shown", items.length, "After search and filter"],
          ["Source of truth", "Mongo", "Not reconstructed from the browser"],
        ].map(([label, value, detail], index, arr) => (
          <div
            key={String(label)}
            className={[
              "min-h-[96px] bg-white px-5 py-4",
              "border-b border-black sm:border-b-0",
              index < arr.length - 1 ? "sm:border-r" : "",
            ].join(" ")}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#707072]">
              {label}
            </span>
            <strong className="mt-2 block text-[18px] font-semibold tracking-[-0.02em] text-black">
              {value}
            </strong>
            <p className="m-0 mt-1 text-[11px] text-[#707072]">{detail}</p>
          </div>
        ))}
      </section>

      <section className="border border-t-0 border-black bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-black px-5 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center border border-black bg-[#f5f5f5]"
              aria-hidden="true"
            >
              <Search size={15} strokeWidth={1.75} />
            </span>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search audit events</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search event type, subject, or hash"
                className="w-full border-0 bg-transparent text-[14px] text-black outline-none placeholder:text-[#9e9ea0]"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={[
                    "inline-flex min-h-9 items-center border px-3 text-[12px] font-semibold transition-colors",
                    active
                      ? "border-black bg-black !text-white"
                      : "border-[#cacacb] bg-white !text-black hover:border-black",
                  ].join(" ")}
                  aria-pressed={active}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {query.isLoading ? (
          <div className="p-5">
            <LoadingBlock label="Loading audit events" rows={6} />
          </div>
        ) : query.isError ? (
          <div className="p-5">
            <Empty
              title="Could not load audit"
              body={getAetherErrorMessage(
                query.error,
                "Check the API connection and your session.",
              )}
              action={
                <button
                  type="button"
                  className={boxButton(false)}
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              }
            />
          </div>
        ) : items.length ? (
          <div className="divide-y divide-[#e5e5e5]">
            <div className="hidden grid-cols-[56px_minmax(0,1.5fr)_minmax(0,1fr)_160px] gap-4 border-b border-[#e5e5e5] bg-[#f5f5f5] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#707072] md:grid">
              <span>#</span>
              <span>Event</span>
              <span>Subject</span>
              <span>When</span>
            </div>
            {items.map((item, index) => {
              const subjectType = String(item.subjectType ?? "subject");
              const subjectId = String(item.subjectId ?? "");
              const runHref =
                subjectType.toLowerCase().includes("run") && subjectId
                  ? `/app/runs/${subjectId}`
                  : subjectType.toLowerCase().includes("mission") && subjectId
                    ? `/app/missions/${subjectId}`
                    : subjectType.toLowerCase().includes("approval") &&
                        subjectId
                      ? `/app/approvals/${subjectId}`
                      : null;

              return (
                <div
                  key={String(item.eventId)}
                  className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[56px_minmax(0,1.5fr)_minmax(0,1fr)_160px] md:items-start md:gap-4"
                >
                  <span className="font-mono text-[11px] text-[#9e9ea0]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-start gap-2">
                      <ScrollText
                        size={15}
                        strokeWidth={1.75}
                        className="mt-0.5 shrink-0 text-black"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <strong className="block text-[14px] font-semibold tracking-[-0.01em] text-black">
                          {humanizeEvent(item.eventType)}
                        </strong>
                        <div className="mt-2">
                          <CopyValue
                            value={String(item.eventHash ?? item.eventId ?? "")}
                            label="Copy event hash"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 text-[12px] text-[#525252]">
                    <p className="m-0 font-semibold capitalize text-black">
                      {subjectType.replaceAll("_", " ")}
                    </p>
                    <p className="m-0 mt-1 font-mono text-[11px] text-[#707072]">
                      {short(subjectId)}
                    </p>
                    {runHref ? (
                      <Link
                        href={runHref}
                        className="mt-2 inline-block text-[12px] font-semibold text-black underline-offset-2 hover:underline"
                      >
                        Open subject →
                      </Link>
                    ) : null}
                  </div>
                  <div className="text-[12px] text-[#707072]">
                    {formatDate(item.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5">
            <Empty
              title={
                search.trim() || filter !== "all"
                  ? "No matching events"
                  : "No audit events yet"
              }
              body={
                search.trim() || filter !== "all"
                  ? "Try clearing search or switching filters."
                  : "As missions run, every material transition is appended here for operators and reviewers."
              }
              action={
                search.trim() || filter !== "all" ? (
                  <button
                    type="button"
                    className={boxButton(false)}
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    Reset filters
                  </button>
                ) : (
                  <Link href="/app/missions" className={boxButton(false)}>
                    Browse missions
                  </Link>
                )
              }
            />
          </div>
        )}
      </section>
    </ConsoleShell>
  );
}
