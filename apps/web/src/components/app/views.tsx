"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AetherClient, getAetherErrorMessage } from "@aether/sdk";
import { browserSafeChains, ETHEREUM_SEPOLIA_CHAIN_ID } from "@aether/shared";
import {
  ConsoleShell,
  CopyValue,
  Empty,
  LoadingBlock,
  PageHeader,
  Status,
} from "./console-shell";

const api = new AetherClient(process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1");
const sepoliaExplorer = browserSafeChains.find(
  (chain) => chain.chainId === ETHEREUM_SEPOLIA_CHAIN_ID,
)?.explorerUrl;

export function OverviewView() {
  const missions = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.listMissions(),
  });
  const approvals = useQuery({
    queryKey: ["approvals"],
    queryFn: () => api.approvals(),
  });
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => api.audit() });
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
        body: "Simulation already bound the plan hash. Approve or deny from the approvals queue before KeeperHub can submit.",
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

  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Mission control"
        title="Operations"
        description="Intent, execution, chain reality, and recovery across every agent mission in this workspace."
        action={
          <Link className="pill pill-primary" href="/app/missions/new">
            Create mission <span aria-hidden="true">＋</span>
          </Link>
        }
      />
      <section
        className={`overview-command overview-command--${posture.tone}`}
        aria-label="Operational summary"
      >
        <div className="overview-command-copy">
          <span className="overview-kicker">
            <i aria-hidden="true" /> {posture.kicker}
          </span>
          <h2>{posture.title}</h2>
          <p>{posture.body}</p>
          <Link
            className="pill pill-secondary overview-command-cta"
            href={posture.href}
          >
            {posture.cta}
          </Link>
        </div>
        <div className="overview-orbit" aria-hidden="true">
          <span>A</span>
          <i />
          <i />
          <i />
        </div>
      </section>
      {loading ? (
        <LoadingBlock label="Loading workspace summary" rows={4} />
      ) : (
        <>
          <section className="metric-grid" aria-label="Workspace metrics">
            <Link className="metric metric-link" href="/app/missions">
              <span>Total missions</span>
              <strong>{missionItems.length}</strong>
              <small>Frozen definitions</small>
            </Link>
            <Link className="metric metric-link" href="/app/approvals">
              <span>Pending authority</span>
              <strong>{pendingApprovals}</strong>
              <small>Exact plans awaiting review</small>
            </Link>
            <Link className="metric metric-link" href="/app/audit">
              <span>Evidence events</span>
              <strong>{auditItems.length}</strong>
              <small>Append-only audit records</small>
            </Link>
          </section>
          <div className="overview-grid">
            <section className="section overview-activity">
              <div className="row section-heading-row">
                <div>
                  <p className="eyebrow">Live record</p>
                  <h2>Recent activity</h2>
                </div>
                <Link href="/app/audit">View audit →</Link>
              </div>
              <div className="overview-feed">
                {auditItems.length ? (
                  auditItems.slice(0, 6).map((item, index) => (
                    <div key={String(item.eventId)}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <i aria-hidden="true" />
                      <div>
                        <strong>{humanizeEvent(item.eventType)}</strong>
                        <p>
                          {String(item.subjectType).replaceAll("_", " ")} ·{" "}
                          {short(item.subjectId)}
                        </p>
                      </div>
                      <small>{formatDate(item.createdAt)}</small>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="The record is quiet"
                    body="Mission transitions, approvals, and chain evidence will appear here."
                    action={
                      <Link
                        className="pill pill-secondary"
                        href="/app/missions/new"
                      >
                        Create first mission
                      </Link>
                    }
                  />
                )}
              </div>
            </section>
            <section className="section overview-missions">
              <div className="row section-heading-row">
                <div>
                  <p className="eyebrow">Definitions</p>
                  <h2>Missions</h2>
                </div>
                <Link href="/app/missions">View all →</Link>
              </div>
              {missionItems.length ? (
                <div className="overview-mission-list">
                  {missionItems.slice(0, 4).map((mission) => (
                    <Link
                      className="list-row"
                      key={String(mission.missionId)}
                      href={`/app/missions/${String(mission.missionId)}`}
                    >
                      <div>
                        <strong>{String(mission.name)}</strong>
                        <p>{String(mission.description ?? "No description")}</p>
                      </div>
                      <span>Open →</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No missions yet"
                  body="Create a mission to freeze steps, proofs, and recovery rules."
                />
              )}
              <div className="boundary-list overview-boundary-inline">
                <Fact label="Write network" value="Ethereum Sepolia only" />
                <Fact label="Execution" value="KeeperHub Direct Execution" />
                <Fact
                  label="Verification"
                  value="Two independent RPC providers"
                />
                <Fact label="Uncertain result" value="Replay remains locked" />
              </div>
            </section>
          </div>
        </>
      )}
    </ConsoleShell>
  );
}

export function MissionsView() {
  const query = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.listMissions(),
    refetchInterval: 5000,
  });
  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Definitions"
        title="Missions"
        description="Versioned multi-step objectives with declared proofs and recovery actions."
        action={
          <Link className="pill pill-primary" href="/app/missions/new">
            New mission
          </Link>
        }
      />
      {query.isLoading ? (
        <LoadingBlock label="Loading missions" rows={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : query.data?.items.length ? (
        <div className="list">
          {query.data.items.map((mission) => (
            <Link
              className="list-row"
              key={String(mission.missionId)}
              href={`/app/missions/${String(mission.missionId)}`}
            >
              <div>
                <strong>{String(mission.name)}</strong>
                <p>{String(mission.description ?? "No description")}</p>
                <p>Created {formatDate(mission.createdAt)}</p>
              </div>
              <span className="list-row-meta">
                <Status value={mission.state ?? "READY"} />
                <span>Open →</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="No missions yet"
          body="Create a mission to freeze its steps, proofs, retry classes, and recovery rules."
          action={
            <Link className="pill pill-primary" href="/app/missions/new">
              Create mission
            </Link>
          }
        />
      )}
    </ConsoleShell>
  );
}

export function NewMissionView() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="New definition"
        title="Create a mission"
        description="Submit a strict mission document. Amounts must be unsigned integer strings and every write needs a retry class."
        breadcrumbs={[
          { label: "Missions", href: "/app/missions" },
          { label: "New" },
        ]}
      />
      <div className="editor-guide section">
        <p className="eyebrow">Before you freeze</p>
        <ul>
          <li>Every write step needs a retry class and proof specification.</li>
          <li>
            Recovery actions must be declared up front — never improvised.
          </li>
          <li>
            Sepolia is the only launch network; mainnet targets are rejected.
          </li>
        </ul>
      </div>
      <form
        className="editor"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setMessage("Validating and saving…");
          const form = new FormData(event.currentTarget);
          try {
            const raw = String(form.get("definition") ?? "");
            const parsed = JSON.parse(raw) as unknown;
            const result = await api.createMission(parsed);
            toast.success("Mission created.");
            window.location.href = `/app/missions/${String((result as Record<string, unknown>).missionId)}`;
          } catch (error) {
            const body =
              error instanceof SyntaxError
                ? "Mission JSON is invalid. Fix the syntax and try again."
                : getAetherErrorMessage(error, "Mission could not be created.");
            setMessage(body);
            toast.error(body);
            setPending(false);
          }
        }}
      >
        <label>
          Mission document (JSON)
          <textarea
            name="definition"
            required
            spellCheck={false}
            defaultValue={missionTemplate}
            aria-describedby="mission-json-help"
          />
        </label>
        <p id="mission-json-help" className="field-help">
          The API validates this against the shared mission schema before
          anything is persisted.
        </p>
        <div className="form-footer">
          <span aria-live="polite">{message}</span>
          <div className="form-footer-actions">
            <Link className="pill pill-secondary" href="/app/missions">
              Cancel
            </Link>
            <button
              className="pill pill-primary"
              type="submit"
              disabled={pending}
            >
              {pending ? "Creating…" : "Create mission"}
            </button>
          </div>
        </div>
      </form>
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
  if (query.isLoading)
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
  if (query.isError || !query.data)
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
      </ConsoleShell>
    );
  const mission = query.data;
  const versions = asArray(mission.versions);
  const runs = asArray(mission.runs);
  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Mission"
        title={String(mission.name)}
        description={String(
          mission.description ?? "Versioned onchain mission.",
        )}
        breadcrumbs={[
          { label: "Missions", href: "/app/missions" },
          { label: String(mission.name) },
        ]}
        action={
          <button
            className="pill pill-primary"
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
            {starting ? "Starting…" : "Run mission"}
          </button>
        }
      />
      <section className="fact-grid mission-meta" aria-label="Mission dates">
        <Fact label="Created" value={formatDate(mission.createdAt)} />
        <Fact label="Last updated" value={formatDate(mission.updatedAt)} />
        <Fact label="Versions" value={versions.length} />
        <Fact label="Recorded runs" value={runs.length} />
      </section>
      <section className="section">
        <h2>Frozen versions</h2>
        {versions.length ? (
          versions.map((version) => (
            <div className="list-row" key={String(version.missionVersionId)}>
              <div>
                <strong>Version {String(version.versionNumber)}</strong>
                <CopyValue
                  value={String(version.hash ?? "")}
                  label="Copy hash"
                />
                <p>Created {formatDate(version.createdAt)}</p>
              </div>
              <Status value="IMMUTABLE" />
            </div>
          ))
        ) : (
          <Empty
            title="No frozen versions"
            body="A mission version is created when the definition is first saved."
          />
        )}
      </section>
      <section className="section">
        <h2>Recent runs</h2>
        {runs.length ? (
          runs.map((run) => (
            <Link
              className="list-row"
              key={String(run.runId)}
              href={`/app/runs/${String(run.runId)}`}
            >
              <div>
                <strong className="mono">{short(run.runId)}</strong>
                <p>{String(run.stateReason ?? "No state reason recorded.")}</p>
                <p>
                  Created {formatDate(run.createdAt)} · Updated{" "}
                  {formatDate(run.updatedAt)}
                </p>
                {run.terminalAt ? (
                  <p>Finished {formatDate(run.terminalAt)}</p>
                ) : null}
              </div>
              <Status value={run.state} />
            </Link>
          ))
        ) : (
          <Empty
            title="No runs yet"
            body="Start the mission to create a persisted flight record with checkpoints and evidence."
          />
        )}
      </section>
    </ConsoleShell>
  );
}

export function RunView({
  runId,
  demo = false,
}: {
  runId: string;
  demo?: boolean;
}) {
  const [cursor, setCursor] = useState(0);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [demoToken, setDemoToken] = useState<string | null>(demo ? null : "");
  useEffect(() => {
    if (demo)
      setDemoToken(sessionStorage.getItem(`aether:demo-run:${runId}`) ?? "");
  }, [demo, runId]);
  const query = useQuery({
    queryKey: [demo ? "demo-run" : "run", runId, cursor],
    queryFn: () =>
      demo ? api.demoRun(runId, String(demoToken)) : api.run(runId),
    refetchInterval: 5000,
    enabled: !demo || Boolean(demoToken),
  });

  const [run, setRun] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (demo && !demoToken) return;
    const controller = new AbortController();
    const listener = (event: Record<string, unknown>) => {
      if (!isTimelineEvent(event)) return;
      setCursor(event.sequence);
      setEvents((current) => [
        ...current.filter((item) => item.eventId !== event.eventId),
        event,
      ]);
    };
    const stream = demo
      ? api.streamDemoRun(
          runId,
          String(demoToken),
          cursor,
          listener,
          controller.signal,
        )
      : api.streamRun(runId, cursor, listener, controller.signal);
    void stream.catch(() => undefined);
    return () => controller.abort();
  }, [runId, cursor, demo, demoToken]);

  useEffect(() => {
    if (query.data) setRun(query.data);
  }, [query?.data]);

  if (demo && demoToken === "")
    return (
      <ConsoleShell>
        <PageHeader
          eyebrow="Demo flight recorder"
          title="Demo access unavailable"
          description="This browser tab no longer has the access token for this demo run. Start a new fixed scenario from the demo page."
          action={
            <Link className="pill pill-primary" href="/demo">
              Return to demo
            </Link>
          }
        />
      </ConsoleShell>
    );
  if (query.isError)
    return (
      <ConsoleShell>
        <PageHeader
          eyebrow={demo ? "Demo flight recorder" : "Flight recorder"}
          title="Run unavailable"
          description={getAetherErrorMessage(
            query.error,
            "The persisted run could not be loaded.",
          )}
        />
      </ConsoleShell>
    );
  if (!run)
    return (
      <ConsoleShell>
        <PageHeader
          eyebrow="Flight recorder"
          title="Loading run"
          description="Replaying persisted transitions."
        />
      </ConsoleShell>
    );
  const steps = asArray(run.steps);
  const attempts = asArray(run.attempts);
  const plans = asArray(run.plans);
  const reconciliation = asArray(run.reconciliation);
  const transactions = transactionRows(run);
  const missionId =
    typeof run.missionId === "string" ? run.missionId : undefined;
  return (
    <ConsoleShell>
      <PageHeader
        eyebrow={demo ? "Demo flight recorder" : "Flight recorder"}
        title={plainState(run.state).replace(/^\w/, (c) => c.toUpperCase())}
        description={String(
          run.stateReason ?? "Persisted run with independent verification.",
        )}
        breadcrumbs={
          demo
            ? [{ label: "Demo", href: "/demo" }, { label: short(run.runId) }]
            : [
                { label: "Missions", href: "/app/missions" },
                ...(missionId
                  ? [
                      {
                        label: "Mission",
                        href: `/app/missions/${missionId}`,
                      },
                    ]
                  : []),
                { label: short(run.runId) },
              ]
        }
        action={
          <div className="page-header-stack">
            <Status value={run.state} />
            <CopyValue value={String(run.runId ?? "")} label="Copy run id" />
          </div>
        }
      />
      <div className="flight-grid">
        <section className="fact-grid run-meta span-2" aria-label="Run dates">
          <Fact label="Run ID" value={short(run.runId)} />
          <Fact label="Created" value={formatDate(run.createdAt)} />
          <Fact label="Started" value={formatDate(run.startedAt)} />
          <Fact label="Last updated" value={formatDate(run.updatedAt)} />
          <Fact
            label="Finished"
            value={run.terminalAt ? formatDate(run.terminalAt) : "In progress"}
          />
          {run.recoveryStartedAt ? (
            <Fact
              label="Recovery started"
              value={formatDate(run.recoveryStartedAt)}
            />
          ) : null}
        </section>
        <section className="section span-2">
          <h2>Mission objective</h2>
          <p>
            {String(
              run.objective ?? "Objective is frozen in the mission version.",
            )}
          </p>
        </section>
        <section className="section span-2">
          <div className="row section-heading-row">
            <h2>Steps</h2>
            <span>
              {
                steps.filter((step) =>
                  ["VERIFIED", "COMPENSATED", "SKIPPED"].includes(
                    String(step.state),
                  ),
                ).length
              }
              /{steps.length} settled
            </span>
          </div>
          {steps.length ? (
            <div className="step-rail" aria-label="Step progress">
              {steps.map((step) => (
                <article className="step" key={String(step.stepRunId)}>
                  <div className="step-head">
                    <div>
                      <small>{String(step.stepId)}</small>
                      <strong>{plainState(step.state)}</strong>
                    </div>
                    <Status value={step.state} />
                  </div>
                  <dl>
                    <Fact label="Plan" value={short(step.planId)} />
                    <Fact
                      label="Simulation"
                      value={short(step.simulationRecordId)}
                    />
                    <Fact
                      label="Execution attempts"
                      value={listLength(step.executionAttemptIds)}
                    />
                    <Fact
                      label="Independent observations"
                      value={listLength(step.observationIds)}
                    />
                    <Fact label="Started" value={formatDate(step.startedAt)} />
                    <Fact
                      label="Finished"
                      value={
                        step.terminalAt
                          ? formatDate(step.terminalAt)
                          : "In progress"
                      }
                    />
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No steps recorded yet"
              body="Step checkpoints appear as the run advances through the frozen mission version."
            />
          )}
        </section>
        <section className="section span-2 transaction-section">
          <div className="row section-heading-row">
            <div>
              <h2>Sepolia transactions</h2>
              <p>
                Every transaction hash recorded for forward and recovery writes
                in this run.
              </p>
            </div>
            <span>{transactions.length} recorded</span>
          </div>
          {transactions.length ? (
            <div className="transaction-list">
              {transactions.map((transaction) => (
                <article
                  className="transaction-row"
                  key={String(transaction.transactionHash)}
                >
                  <div>
                    <strong>
                      {transaction.kind === "COMPENSATION"
                        ? "Recovery transaction"
                        : "Mission transaction"}
                    </strong>
                    <p>
                      {String(transaction.stepId ?? "Recorded write")} ·{" "}
                      {String(transaction.status ?? "RECORDED").replaceAll(
                        "_",
                        " ",
                      )}
                    </p>
                    <p>
                      KeeperHub execution:{" "}
                      <span className="mono">
                        {String(
                          transaction.keeperHubExecutionId ??
                            "Not acknowledged",
                        )}
                      </span>
                    </p>
                    <p className="mono transaction-hash">
                      {String(transaction.transactionHash)}
                    </p>
                    <p>
                      Recorded {formatDate(transaction.createdAt)}
                      {transaction.terminalAt
                        ? ` · Final provider update ${formatDate(transaction.terminalAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="transaction-actions">
                    <a
                      className="pill pill-secondary"
                      href={String(transaction.explorerUrl)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View transaction ${String(transaction.transactionHash)} on Sepolia Etherscan`}
                    >
                      View on Etherscan ↗
                    </a>
                    {typeof transaction.providerTransactionLink === "string" ? (
                      <a
                        className="inline-evidence-link"
                        href={transaction.providerTransactionLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open KeeperHub-provided link ↗
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>
              No transaction hash has been recorded. A simulation failure does
              not produce an onchain transaction.
            </p>
          )}
        </section>
        {reconciliation.length > 0 && (
          <section className="section alert span-2">
            <h2>Outcome unknown</h2>
            <p>
              Retry locked while provider records and chain evidence are
              reconciled.
            </p>
            {reconciliation.map((item) => (
              <div className="list-row" key={String(item.reconciliationCaseId)}>
                <div>
                  <strong>{String(item.resolution ?? "RECONCILING")}</strong>
                  <p>{String(item.decisionRationale ?? item.reason)}</p>
                </div>
                <Status value={item.resolution ?? "RETRY_LOCKED"} />
              </div>
            ))}
          </section>
        )}
        <section className="section span-2">
          <h2>Persisted timeline</h2>
          {events.length ? (
            events.map((event) => {
              const context = timelineEventContext(
                event,
                steps,
                attempts,
                plans,
                run.recoveryStartedAt,
              );
              return (
                <div className="timeline" key={String(event.eventId)}>
                  <span>{String(event.sequence)}</span>
                  <div>
                    {context ? (
                      <small className="timeline-step">
                        {context.phase} · Step: {context.stepId}
                      </small>
                    ) : null}
                    <strong>{String(event.message)}</strong>
                    <small>
                      {new Date(String(event.createdAt)).toLocaleString()}
                    </small>
                  </div>
                  <Status value={event.state} />
                </div>
              );
            })
          ) : (
            <p>Waiting for the next recorded transition…</p>
          )}
        </section>
        {Boolean(run.recovery) && (
          <Evidence title="Recovery plan" value={run.recovery} />
        )}
        {Boolean(run.investigation) && (
          <Evidence
            title="Optional incident summary provided by Groq"
            value={run.investigation}
          />
        )}
        {Boolean(run.receipt) && (
          <Evidence title="Final mission receipt" value={run.receipt} />
        )}
      </div>
    </ConsoleShell>
  );
}

export function ApprovalsView({ approvalId }: { approvalId?: string }) {
  const queryClient = useQueryClient();
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
  const items = approvalId
    ? query.data
      ? [query.data as Record<string, unknown>]
      : []
    : asArray((query.data as Record<string, unknown> | undefined)?.items);
  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Authority"
        title="Approvals"
        description="Each decision is bound to one immutable plan hash and expiry. AI cannot approve."
      />
      {query.isLoading ? (
        <LoadingBlock label="Loading approvals" rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : items.length ? (
        <div className="approval-list">
          {items.map((item) => (
            <article
              className="section approval-card"
              key={String(item.approvalId)}
            >
              <div className="row">
                <div>
                  <p className="eyebrow">{String(item.scope ?? "PLAN")}</p>
                  <h2>
                    {String(item.scope ?? "Plan").replaceAll("_", " ")} decision
                  </h2>
                  <CopyValue
                    value={String(item.planHash ?? "")}
                    label="Copy plan hash"
                  />
                  <p className="approval-meta">
                    Expires {formatDate(item.expiresAt)} · Created{" "}
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <Status value={item.status} />
              </div>
              {item.status === "PENDING" ? (
                <div className="actions">
                  <button
                    className="pill pill-secondary"
                    disabled={decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        id: String(item.approvalId),
                        decision: "deny",
                      })
                    }
                  >
                    Deny
                  </button>
                  <button
                    className="pill pill-primary"
                    disabled={decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        id: String(item.approvalId),
                        decision: "approve",
                      })
                    }
                  >
                    {decide.isPending ? "Saving…" : "Approve exact plan"}
                  </button>
                </div>
              ) : (
                <p className="approval-resolved">
                  Decision already recorded. The bound plan hash cannot be
                  reused for a different request.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="No approvals waiting"
          body="When a mission needs human authority, the exact simulated plan appears here with its hash and expiry."
          action={
            <Link className="pill pill-secondary" href="/app/missions">
              Browse missions
            </Link>
          }
        />
      )}
    </ConsoleShell>
  );
}

export function AuditView() {
  const query = useQuery({ queryKey: ["audit"], queryFn: () => api.audit() });
  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Evidence"
        title="Audit"
        description="Append-only records for state, authority, execution, verification, and recovery."
      />
      {query.isLoading ? (
        <LoadingBlock label="Loading audit events" rows={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : query.data?.items?.length ? (
        <div className="list">
          {query.data.items.map((item) => (
            <div className="list-row" key={String(item.eventId)}>
              <div>
                <strong>{humanizeEvent(item.eventType)}</strong>
                <p>
                  {String(item.subjectType ?? "subject").replaceAll("_", " ")} ·{" "}
                  {short(item.subjectId)}
                </p>
                <p>{formatDate(item.createdAt)}</p>
              </div>
              <CopyValue
                value={String(item.eventHash ?? item.eventId ?? "")}
                label="Copy evidence id"
              />
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="No audit events yet"
          body="As missions run, every material transition is appended here for operators and reviewers."
        />
      )}
    </ConsoleShell>
  );
}

export function SettingsView({
  section,
}: {
  section: "integrations" | "api-keys" | "policy";
}) {
  const keys = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.apiKeys(),
    enabled: section === "api-keys",
  });
  const policy = useQuery({
    queryKey: ["policy"],
    queryFn: () => api.policy(),
    enabled: section === "policy",
  });
  const tabs = [
    ["integrations", "Integrations", "/app/settings/integrations"],
    ["api-keys", "API keys", "/app/settings/api-keys"],
    ["policy", "Policy", "/app/settings/policy"],
  ] as const;
  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Workspace"
        title={
          section === "api-keys"
            ? "API keys"
            : section === "policy"
              ? "Execution policy"
              : "Integrations"
        }
        description={
          section === "integrations"
            ? "KeeperHub credentials and two Sepolia RPC providers remain server-side."
            : section === "api-keys"
              ? "Scoped credentials are hashed at rest and plaintext is shown once."
              : "Sepolia allowlist, write limits, recovery budget, and emergency pause."
        }
      />
      <nav className="settings-tabs" aria-label="Settings sections">
        {tabs.map(([id, label, href]) => (
          <Link
            key={id}
            href={href}
            className={section === id ? "is-active" : undefined}
            aria-current={section === id ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {section === "integrations" && (
        <div className="settings-panel">
          <div className="fact-grid">
            <Fact label="KeeperHub" value="Direct Execution" />
            <Fact
              label="RPC providers"
              value="Primary and secondary required"
            />
            <Fact label="Groq" value="Optional incident summary only" />
            <Fact label="Secrets" value="Never exposed to the browser" />
          </div>
          <p className="settings-note">
            Configure credentials through environment variables and provider
            doctors. The console only reports posture, never raw secrets.
          </p>
        </div>
      )}
      {section === "api-keys" &&
        (keys.isLoading ? (
          <LoadingBlock label="Loading API keys" />
        ) : keys.data?.items?.length ? (
          <div className="list">
            {keys.data.items.map((item) => (
              <div className="list-row" key={String(item.apiKeyId)}>
                <div>
                  <strong>{String(item.name)}</strong>
                  <p className="mono">{String(item.prefix)}…</p>
                </div>
                <Status value={item.revokedAt ? "REVOKED" : "ACTIVE"} />
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No API keys"
            body="Create scoped keys for external agents such as savings or lending clients. Plaintext is shown once."
          />
        ))}
      {section === "policy" &&
        (policy.isLoading ? (
          <LoadingBlock label="Loading policy" />
        ) : (
          <Evidence title="Current policy" value={policy.data ?? {}} />
        ))}
    </ConsoleShell>
  );
}

function Fact({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>
        {value === undefined || value === "" ? "Not recorded" : String(value)}
      </dd>
    </div>
  );
}
function Evidence({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="section evidence-block">
      <div className="row section-heading-row">
        <h2>{title}</h2>
      </div>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}
function ErrorState({ error }: { error: unknown }) {
  return (
    <Empty
      title="Could not load this view"
      body={getAetherErrorMessage(
        error,
        "Check the API connection and your session.",
      )}
      action={
        <button
          type="button"
          className="pill pill-secondary"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      }
    />
  );
}
function humanizeEvent(value: unknown) {
  return String(value ?? "event")
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      )
    : [];
}
function listLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}
function short(value: unknown) {
  const text = String(value ?? "");
  return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text;
}
function plainState(value: unknown) {
  return String(value ?? "Pending")
    .replaceAll("_", " ")
    .toLowerCase();
}
function formatDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.valueOf()) ? "Not recorded" : date.toLocaleString();
}
function transactionRows(
  run: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const normalized = asArray(run.transactionEvidence).filter(
    (item) => typeof item.transactionHash === "string",
  );
  if (normalized.length) return normalized;
  return asArray(run.attempts)
    .filter((attempt) => typeof attempt.transactionHash === "string")
    .map(
      (attempt): Record<string, unknown> => ({
        ...attempt,
        explorerUrl: sepoliaExplorer
          ? `${sepoliaExplorer}/tx/${String(attempt.transactionHash)}`
          : "#",
      }),
    );
}
function isTimelineEvent(value: Record<string, unknown>): value is Record<
  string,
  unknown
> & {
  eventId: string;
  sequence: number;
  message: string;
  createdAt: string;
} {
  return (
    typeof value.eventId === "string" &&
    typeof value.sequence === "number" &&
    typeof value.message === "string" &&
    typeof value.createdAt === "string"
  );
}

export function timelineStepId(
  event: Record<string, unknown>,
  steps: Array<Record<string, unknown>>,
  attempts: Array<Record<string, unknown>>,
) {
  const data =
    event.data && typeof event.data === "object" && !Array.isArray(event.data)
      ? (event.data as Record<string, unknown>)
      : undefined;
  if (typeof data?.stepId === "string") return data.stepId;
  if (typeof data?.executionAttemptId !== "string") return undefined;
  const attempt = attempts.find(
    (item) => item.executionAttemptId === data.executionAttemptId,
  );
  if (typeof attempt?.stepId === "string") return attempt.stepId;
  if (typeof attempt?.stepRunId !== "string") return undefined;
  const stepId = steps.find(
    (step) => step.stepRunId === attempt.stepRunId,
  )?.stepId;
  return typeof stepId === "string" ? stepId : undefined;
}

export function timelineEventContext(
  event: Record<string, unknown>,
  steps: Array<Record<string, unknown>>,
  attempts: Array<Record<string, unknown>>,
  plans: Array<Record<string, unknown>>,
  recoveryStartedAt?: unknown,
) {
  const stepId = timelineStepId(event, steps, attempts);
  if (!stepId) return undefined;
  const data =
    event.data && typeof event.data === "object" && !Array.isArray(event.data)
      ? (event.data as Record<string, unknown>)
      : undefined;
  const attempt = attempts.find(
    (item) => item.executionAttemptId === data?.executionAttemptId,
  );
  const plan = plans.find((item) => item.planId === attempt?.planId);
  const recoveryStart = new Date(String(recoveryStartedAt ?? "")).valueOf();
  const eventTime = new Date(String(event.createdAt ?? "")).valueOf();
  const recoveryState = ["COMPENSATING", "COMPENSATED"].includes(
    String(event.state),
  );
  const recoveryEvent = String(event.type ?? "").startsWith("recovery.");
  const afterRecoveryStarted =
    !Number.isNaN(recoveryStart) &&
    !Number.isNaN(eventTime) &&
    eventTime >= recoveryStart;
  return {
    stepId,
    phase:
      plan?.kind === "COMPENSATION" ||
      recoveryState ||
      recoveryEvent ||
      afterRecoveryStarted
        ? ("Recovery" as const)
        : ("Mission" as const),
  };
}
const missionTemplate = JSON.stringify(
  {
    name: "Sepolia vault transfer",
    description: "Move a fixed balance and prove the destination state.",
    definition: {
      schemaVersion: 1,
      objective: "Move a fixed demo balance and verify every effect.",
      steps: [],
      invariants: [],
      recoveryPolicy: {
        maxRecoverySpendWei: "0",
        terminalSafeStates: ["SOURCE_RESTORED"],
        onKnownFailure: "COMPENSATE",
        onUnknownOutcome: "RECONCILE",
        onIndeterminateOutcome: "ESCALATE",
      },
      authorityPolicy: {
        autoApproveForward: false,
        autoApproveRecovery: false,
        maximumValueWei: "0",
        allowedTargets: [],
        allowedFunctions: [],
      },
    },
  },
  null,
  2,
);
