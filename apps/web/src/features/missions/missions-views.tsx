"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Clock3,
  Copy,
  GitBranch,
  Play,
  Plus,
  Search,
  Target,
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

function boxButton(primary = false) {
  // Use !text-* so global `a/button { color: inherit }` cannot wash out contrast.
  return primary
    ? "box-btn box-btn-primary inline-flex min-h-11 items-center gap-2 border border-black bg-black px-5 text-[13px] font-semibold !text-white no-underline transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:!text-white"
    : "box-btn box-btn-secondary inline-flex min-h-11 items-center gap-2 border border-black bg-white px-5 text-[13px] font-semibold !text-black no-underline transition-colors hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:!text-black";
}

export function MissionsView() {
  const [queryText, setQueryText] = useState("");
  const query = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.listMissions(),
    refetchInterval: 5000,
  });

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    const needle = queryText.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((mission) => {
      const haystack = [
        mission.name,
        mission.description,
        mission.missionId,
        mission.state,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(needle);
    });
  }, [query.data?.items, queryText]);

  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Definitions"
        title="Missions"
        description="Versioned multi-step objectives with declared proofs, retry classes, and recovery actions."
        action={
          <Link href="/app/missions/new" className={boxButton(true)}>
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            New mission
          </Link>
        }
      />

      <section className="mt-0 border border-t-0 border-black bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black px-5 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center border border-black bg-[#f5f5f5]"
              aria-hidden="true"
            >
              <Search size={15} strokeWidth={1.75} />
            </span>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search missions</span>
              <input
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                placeholder="Search by name, description, or id"
                className="w-full border-0 bg-transparent text-[14px] text-black outline-none placeholder:text-[#9e9ea0]"
              />
            </label>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-[#707072]">
            <span>
              <strong className="font-semibold text-black">
                {query.data?.items.length ?? 0}
              </strong>{" "}
              total
            </span>
            <span className="hidden sm:inline">
              <strong className="font-semibold text-black">
                {items.length}
              </strong>{" "}
              shown
            </span>
          </div>
        </div>

        {query.isLoading ? (
          <div className="p-5">
            <LoadingBlock label="Loading missions" rows={5} />
          </div>
        ) : query.isError ? (
          <div className="p-5">
            <Empty
              title="Could not load missions"
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
            {/* Column header */}
            <div className="hidden grid-cols-[minmax(0,1.6fr)_140px_160px_120px] gap-4 border-b border-[#e5e5e5] bg-[#f5f5f5] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#707072] md:grid">
              <span>Mission</span>
              <span>State</span>
              <span>Created</span>
              <span className="text-right">Action</span>
            </div>
            {items.map((mission, index) => (
              <Link
                key={String(mission.missionId)}
                href={`/app/missions/${String(mission.missionId)}`}
                className="group grid grid-cols-1 gap-3 px-5 py-5 no-underline transition-colors hover:bg-[#fafafa] md:grid-cols-[minmax(0,1.6fr)_140px_160px_120px] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 grid size-9 shrink-0 place-items-center border border-black bg-white text-[11px] font-mono text-[#707072]"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate text-[15px] font-semibold tracking-[-0.015em] text-black">
                        {String(mission.name)}
                      </strong>
                      <p className="m-0 mt-1 line-clamp-2 text-[13px] text-[#707072]">
                        {String(mission.description ?? "No description")}
                      </p>
                      <p className="m-0 mt-2 font-mono text-[11px] text-[#9e9ea0]">
                        {short(mission.missionId)}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <Status value={mission.state ?? "READY"} />
                </div>
                <div className="text-[12px] text-[#707072]">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={13} strokeWidth={1.75} aria-hidden="true" />
                    {formatDate(mission.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-start md:justify-end">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-black">
                    Open
                    <ArrowRight
                      size={14}
                      strokeWidth={1.75}
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : queryText.trim() ? (
          <div className="p-5">
            <Empty
              title="No matching missions"
              body={`Nothing matches “${queryText.trim()}”. Clear the search or create a new definition.`}
              action={
                <button
                  type="button"
                  className={boxButton(false)}
                  onClick={() => setQueryText("")}
                >
                  Clear search
                </button>
              }
            />
          </div>
        ) : (
          <div className="p-5">
            <Empty
              title="No missions yet"
              body="Create a mission to freeze its steps, proofs, retry classes, and recovery rules."
              action={
                <Link href="/app/missions/new" className={boxButton(true)}>
                  <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                  Create mission
                </Link>
              }
            />
          </div>
        )}
      </section>

      <section
        aria-label="Mission guidance"
        className="grid border border-t-0 border-black sm:grid-cols-3"
      >
        {[
          {
            icon: Target,
            title: "Freeze intent",
            body: "Steps, proofs, and recovery rules are immutable per version.",
          },
          {
            icon: Play,
            title: "Run with checkpoints",
            body: "Each write is simulated, submitted via KeeperHub, then verified.",
          },
          {
            icon: GitBranch,
            title: "Recover safely",
            body: "Unknown outcomes stay retry-locked until independently reconciled.",
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

export function MissionView({ missionId }: { missionId: string }) {
  const query = useQuery({
    queryKey: ["mission", missionId],
    queryFn: () => api.mission(missionId),
    refetchInterval: 5000,
  });
  const [starting, setStarting] = useState(false);

  if (query.isLoading) {
    return (
      <ConsoleShell>
        <PageHeader
          eyebrow="Mission"
          title="Loading mission"
          description="Reading the frozen definition and recent runs."
          breadcrumbs={[
            { label: "Missions", href: "/app/missions" },
            { label: short(missionId) },
          ]}
        />
        <LoadingBlock label="Loading mission" rows={4} />
      </ConsoleShell>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ConsoleShell>
        <PageHeader
          eyebrow="Mission"
          title="Mission unavailable"
          description={getAetherErrorMessage(
            query.error,
            "This mission could not be loaded.",
          )}
          breadcrumbs={[
            { label: "Missions", href: "/app/missions" },
            { label: short(missionId) },
          ]}
        />
        <Empty
          title="Could not open this mission"
          body="It may have been archived, or your session may not have access."
          action={
            <Link href="/app/missions" className={boxButton(false)}>
              Back to missions
            </Link>
          }
        />
      </ConsoleShell>
    );
  }

  const mission = query.data;
  const versions = asArray(mission.versions);
  const runs = asArray(mission.runs);
  const latestVersion = versions[0];
  const activeRuns = runs.filter(
    (run) =>
      !["COMPLETED", "RECOVERED", "ABORTED_SAFE", "NEEDS_ATTENTION"].includes(
        String(run.state),
      ),
  ).length;

  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Mission"
        title={String(mission.name)}
        description={String(
          mission.description ?? "Versioned multi-step onchain mission.",
        )}
        breadcrumbs={[
          { label: "Missions", href: "/app/missions" },
          { label: String(mission.name) },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/app/missions" className={boxButton(false)}>
              All missions
            </Link>
            <button
              type="button"
              className={boxButton(true)}
              disabled={starting}
              onClick={async () => {
                setStarting(true);
                try {
                  const result = await api.createRun(missionId, { input: {} });
                  toast.success("Run started.");
                  window.location.href = `/app/runs/${String(result.runId)}`;
                } catch (error) {
                  toast.error(
                    getAetherErrorMessage(error, "Run could not be started."),
                  );
                  setStarting(false);
                }
              }}
            >
              <Play size={15} strokeWidth={1.75} aria-hidden="true" />
              {starting ? "Starting…" : "Run mission"}
            </button>
          </div>
        }
      />

      {/* Meta strip */}
      <section
        aria-label="Mission summary"
        className="grid border border-t-0 border-black sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          ["Mission ID", short(mission.missionId)],
          ["Created", formatDate(mission.createdAt)],
          ["Last updated", formatDate(mission.updatedAt)],
          ["Active runs", String(activeRuns)],
        ].map(([label, value], index, arr) => (
          <div
            key={label}
            className={[
              "min-h-[96px] bg-white px-5 py-4",
              "border-b border-black sm:border-b-0",
              index < arr.length - 1 ? "sm:border-r" : "",
            ].join(" ")}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#707072]">
              {label}
            </span>
            <strong className="mt-2 block text-[14px] font-semibold text-black">
              {value}
            </strong>
          </div>
        ))}
      </section>

      <div className="grid border border-t-0 border-black lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {/* Versions */}
        <section className="border-b border-black bg-white lg:border-b-0 lg:border-r">
          <header className="flex items-center justify-between gap-3 border-b border-black px-5 py-4">
            <div>
              <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[#707072]">
                Immutable
              </p>
              <h2 className="m-0 mt-1 text-[18px] font-medium tracking-[-0.02em] text-black">
                Frozen versions
              </h2>
            </div>
            <span className="border border-black bg-[#f5f5f5] px-2.5 py-1 text-[11px] font-semibold text-black">
              {versions.length}
            </span>
          </header>

          {versions.length ? (
            <div className="divide-y divide-[#e5e5e5]">
              {versions.map((version, index) => (
                <article
                  key={String(version.missionVersionId)}
                  className="px-5 py-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center border border-black bg-[#f5f5f5] font-mono text-[11px] text-[#707072]">
                          v{String(version.versionNumber ?? index + 1)}
                        </span>
                        <strong className="text-[14px] font-semibold text-black">
                          Version {String(version.versionNumber ?? index + 1)}
                        </strong>
                      </div>
                      <p className="m-0 mt-2 text-[12px] text-[#707072]">
                        Created {formatDate(version.createdAt)}
                      </p>
                    </div>
                    <Status value="IMMUTABLE" />
                  </div>
                  {version.hash ? (
                    <div className="mt-3">
                      <CopyValue
                        value={String(version.hash)}
                        label="Copy version hash"
                      />
                    </div>
                  ) : null}
                  {index === 0 ? (
                    <p className="m-0 mt-3 border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-[12px] text-[#525252]">
                      Latest frozen definition. New runs use this version unless
                      the mission is re-versioned.
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <Empty
                title="No frozen versions"
                body="A mission version is created when the definition is first saved."
              />
            </div>
          )}

          {latestVersion ? (
            <div className="border-t border-black px-5 py-4">
              <button
                type="button"
                className={boxButton(false)}
                onClick={async () => {
                  const hash = String(latestVersion.hash ?? "");
                  if (!hash) return;
                  try {
                    await navigator.clipboard.writeText(hash);
                    toast.success("Latest version hash copied.");
                  } catch {
                    toast.error("Could not copy hash.");
                  }
                }}
              >
                <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
                Copy latest hash
              </button>
            </div>
          ) : null}
        </section>

        {/* Runs */}
        <section className="bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-black px-5 py-4">
            <div>
              <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[#707072]">
                Flight records
              </p>
              <h2 className="m-0 mt-1 text-[18px] font-medium tracking-[-0.02em] text-black">
                Recent runs
              </h2>
            </div>
            <span className="border border-black bg-[#f5f5f5] px-2.5 py-1 text-[11px] font-semibold text-black">
              {runs.length}
            </span>
          </header>

          {runs.length ? (
            <div className="divide-y divide-[#e5e5e5]">
              {runs.map((run) => (
                <Link
                  key={String(run.runId)}
                  href={`/app/runs/${String(run.runId)}`}
                  className="group block px-5 py-5 no-underline transition-colors hover:bg-[#fafafa]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block font-mono text-[13px] font-semibold text-black">
                        {short(run.runId)}
                      </strong>
                      <p className="m-0 mt-1 text-[13px] text-[#525252]">
                        {String(run.stateReason ?? "No state reason recorded.")}
                      </p>
                    </div>
                    <Status value={run.state} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#707072]">
                    <span>Created {formatDate(run.createdAt)}</span>
                    <span>Updated {formatDate(run.updatedAt)}</span>
                    {run.terminalAt ? (
                      <span>Finished {formatDate(run.terminalAt)}</span>
                    ) : (
                      <span className="font-semibold text-[#9a5b00]">
                        In progress
                      </span>
                    )}
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-black">
                    Open run
                    <ArrowRight
                      size={13}
                      strokeWidth={1.75}
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <Empty
                title="No runs yet"
                body="Start the mission to create a persisted flight record with checkpoints and evidence."
                action={
                  <button
                    type="button"
                    className={boxButton(true)}
                    disabled={starting}
                    onClick={async () => {
                      setStarting(true);
                      try {
                        const result = await api.createRun(missionId, {
                          input: {},
                        });
                        toast.success("Run started.");
                        window.location.href = `/app/runs/${String(result.runId)}`;
                      } catch (error) {
                        toast.error(
                          getAetherErrorMessage(
                            error,
                            "Run could not be started.",
                          ),
                        );
                        setStarting(false);
                      }
                    }}
                  >
                    <Play size={15} strokeWidth={1.75} aria-hidden="true" />
                    {starting ? "Starting…" : "Run mission"}
                  </button>
                }
              />
            </div>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}
