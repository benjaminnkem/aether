"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AetherClient, getAetherErrorMessage } from "@aether/sdk";
import { ConsoleShell, Empty, PageHeader, Status } from "./console-shell";

const api = new AetherClient(process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1");

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
      <section className="section">
        <h2>Frozen versions</h2>
        {versions.map((version) => (
          <div className="list-row" key={String(version.missionVersionId)}>
            <div>
              <strong>Version {String(version.versionNumber)}</strong>
              <p className="mono">{String(version.hash)}</p>
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
      if (typeof event.sequence === "number") setCursor(event.sequence);
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
  const reconciliation = asArray(run.reconciliation);
  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Flight recorder"
        title={String(run.runId)}
        description={String(run.stateReason)}
        action={<Status value={run.state} />}
      />
      <div className="flight-grid">
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
                  value={asArray(step.executionAttemptIds).length}
                />
                <Fact
                  label="Independent observations"
                  value={asArray(step.observationIds).length}
                />
              </dl>
            </article>
          ))}
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
            events.map((event) => (
              <div className="timeline" key={String(event.eventId)}>
                <span>{String(event.sequence)}</span>
                <div>
                  <strong>{String(event.message)}</strong>
                  <small>
                    {new Date(String(event.createdAt)).toLocaleString()}
                  </small>
                </div>
                <Status value={event.state} />
              </div>
            ))
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
function short(value: unknown) {
  const text = String(value ?? "");
  return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text;
}
function plainState(value: unknown) {
  return String(value ?? "Pending")
    .replaceAll("_", " ")
    .toLowerCase();
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
