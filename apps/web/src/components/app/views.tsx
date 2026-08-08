"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AetherClient, getAetherErrorMessage } from "@aether/sdk";
import { browserSafeChains, ETHEREUM_SEPOLIA_CHAIN_ID } from "@aether/shared";
import { ConsoleShell, Empty, PageHeader, Status } from "./console-shell";

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
  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Current workspace"
        title="Mission control"
        description="Track intended writes, chain evidence, unknown outcomes, and recovery from one place."
        action={
          <Link className="pill pill-primary" href="/app/missions/new">
            New mission
          </Link>
        }
      />
      <section className="metric-grid">
        <Metric label="Missions" value={missions.data?.items.length} />
        <Metric
          label="Awaiting approval"
          value={
            approvals.data?.items.filter((item) => item.status === "PENDING")
              .length
          }
        />
        <Metric label="Recorded events" value={audit.data?.items.length} />
      </section>
      <section className="section">
        <h2>Operating boundary</h2>
        <div className="fact-grid">
          <Fact label="Write network" value="Ethereum Sepolia only" />
          <Fact label="Execution" value="KeeperHub Direct Execution" />
          <Fact label="Verification" value="Two independent RPC providers" />
          <Fact
            label="Uncertain result"
            value="Retry locked until reconciled"
          />
        </div>
      </section>
    </ConsoleShell>
  );
}

export function MissionsView() {
  const query = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.listMissions(),
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
      {query.isError ? (
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
              <span>Open →</span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="No missions yet"
          body="Create a mission to freeze its steps, proofs, retry classes, and recovery rules."
        />
      )}
    </ConsoleShell>
  );
}

export function NewMissionView() {
  const [message, setMessage] = useState("");
  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="New definition"
        title="Create a mission"
        description="Submit a strict mission document. Amounts must be unsigned integer strings and every write needs a retry class."
      />
      <form
        className="editor"
        onSubmit={async (event) => {
          event.preventDefault();
          setMessage("Saving…");
          const form = new FormData(event.currentTarget);
          try {
            const result = await api.createMission(
              JSON.parse(String(form.get("definition"))),
            );
            window.location.href = `/app/missions/${String((result as Record<string, unknown>).missionId)}`;
          } catch (error) {
            console.log(error);
            setMessage(
              getAetherErrorMessage(error, "Mission could not be created."),
            );
          }
        }}
      >
        <label>
          Name and definition JSON
          <textarea
            name="definition"
            required
            spellCheck={false}
            defaultValue={missionTemplate}
          />
        </label>
        <div className="form-footer">
          <span aria-live="polite">{message}</span>
          <button className="pill pill-primary" type="submit">
            Create mission
          </button>
        </div>
      </form>
    </ConsoleShell>
  );
}

export function MissionView({ missionId }: { missionId: string }) {
  const query = useQuery({
    queryKey: ["mission", missionId],
    queryFn: () => api.mission(missionId),
  });
  if (!query.data)
    return (
      <ConsoleShell>
        <PageHeader
          eyebrow="Mission"
          title="Loading mission"
          description="Reading the frozen definition and recent runs."
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
        action={
          <button
            className="pill pill-primary"
            onClick={async () => {
              const result = await api.createRun(missionId, { input: {} });
              window.location.href = `/app/runs/${String(result.runId)}`;
            }}
          >
            Run mission
          </button>
        }
      />
      <section className="fact-grid mission-meta" aria-label="Mission dates">
        <Fact label="Created" value={formatDate(mission.createdAt)} />
        <Fact label="Last updated" value={formatDate(mission.updatedAt)} />
      </section>
      <section className="section">
        <h2>Frozen versions</h2>
        {versions.map((version) => (
          <div className="list-row" key={String(version.missionVersionId)}>
            <div>
              <strong>Version {String(version.versionNumber)}</strong>
              <p className="mono">{String(version.hash)}</p>
              <p>Created {formatDate(version.createdAt)}</p>
            </div>
            <Status value="IMMUTABLE" />
          </div>
        ))}
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
                <strong>{String(run.runId)}</strong>
                <p>{String(run.stateReason)}</p>
                <p>
                  Created {formatDate(run.createdAt)} · Last updated{" "}
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
            title="No runs"
            body="Start the mission to create a persisted flight record."
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
  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Flight recorder"
        title={String(run.runId)}
        description={String(run.stateReason)}
        action={<Status value={run.state} />}
      />
      <div className="flight-grid">
        <section className="fact-grid run-meta span-2" aria-label="Run dates">
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
          <h2>Steps</h2>
          {steps.map((step) => (
            <article className="step" key={String(step.stepRunId)}>
              <div>
                <small>{String(step.stepId)}</small>
                <strong>{plainState(step.state)}</strong>
              </div>
              <Status value={step.state} />
              <dl>
                <Fact label="Plan" value={step.planId} />
                <Fact label="Simulation" value={step.simulationRecordId} />
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
  const query = useQuery({
    queryKey: ["approvals", approvalId],
    queryFn: () => (approvalId ? api.approval(approvalId) : api.approvals()),
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
        description="Each decision is bound to one immutable plan hash and expiry."
      />
      {items.map((item) => (
        <article className="section" key={String(item.approvalId)}>
          <div className="row">
            <div>
              <h2>{String(item.scope)} plan</h2>
              <p className="mono">{String(item.planHash)}</p>
            </div>
            <Status value={item.status} />
          </div>
          {item.status === "PENDING" && (
            <div className="actions">
              <button
                className="pill pill-secondary"
                onClick={() =>
                  void api.decideApproval(
                    String(item.approvalId),
                    "deny",
                    "Denied in operator console.",
                  )
                }
              >
                Deny
              </button>
              <button
                className="pill pill-primary"
                onClick={() =>
                  void api.decideApproval(
                    String(item.approvalId),
                    "approve",
                    "Approved in operator console.",
                  )
                }
              >
                Approve exact plan
              </button>
            </div>
          )}
        </article>
      ))}
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
      <div className="list">
        {query.data?.items.map((item) => (
          <div className="list-row" key={String(item.eventId)}>
            <div>
              <strong>{String(item.eventType)}</strong>
              <p>
                {String(item.subjectType)} · {String(item.subjectId)}
              </p>
            </div>
            <span className="mono">{short(item.eventHash)}</span>
          </div>
        ))}
      </div>
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
      {section === "integrations" && (
        <div className="fact-grid">
          <Fact label="KeeperHub" value="Direct Execution" />
          <Fact label="RPC providers" value="Primary and secondary required" />
          <Fact label="Groq" value="Optional incident summary only" />
        </div>
      )}
      {section === "api-keys" && (
        <div className="list">
          {keys.data?.items.map((item) => (
            <div className="list-row" key={String(item.apiKeyId)}>
              <div>
                <strong>{String(item.name)}</strong>
                <p>{String(item.prefix)}…</p>
              </div>
              <Status value={item.revokedAt ? "REVOKED" : "ACTIVE"} />
            </div>
          ))}
        </div>
      )}
      {section === "policy" && (
        <Evidence title="Current policy" value={policy.data ?? {}} />
      )}
    </ConsoleShell>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}
function Fact({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{value === undefined ? "Not recorded" : String(value)}</dd>
    </div>
  );
}
function Evidence({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="section">
      <h2>{title}</h2>
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
    />
  );
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
