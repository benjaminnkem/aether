"use client";

import { useEffect, useState } from "react";
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
export { OperationsOverview as OverviewView } from "@/features/overview/operations-overview";
export { MissionsView, MissionView } from "@/features/missions/missions-views";
export {
  ApprovalsView,
  AuditView,
} from "@/features/evidence/approvals-audit-views";

const api = new AetherClient(process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1");
const sepoliaExplorer = browserSafeChains.find(
  (chain) => chain.chainId === ETHEREUM_SEPOLIA_CHAIN_ID,
)?.explorerUrl;

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
      <div className="grid border border-t-0 border-black lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.7fr)]">
        <form
          className="border-b border-black bg-white p-6 lg:border-b-0 lg:border-r"
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
                  : getAetherErrorMessage(
                      error,
                      "Mission could not be created.",
                    );
              setMessage(body);
              toast.error(body);
              setPending(false);
            }
          }}
        >
          <label className="grid gap-2 text-[13px] font-semibold text-black">
            Mission document (JSON)
            <textarea
              name="definition"
              required
              spellCheck={false}
              defaultValue={missionTemplate}
              aria-describedby="mission-json-help"
              className="min-h-[520px] w-full resize-y border border-black bg-[#f5f5f5] p-5 font-mono text-[12px] leading-relaxed text-black outline-none focus:bg-white"
            />
          </label>
          <p
            id="mission-json-help"
            className="m-0 mt-3 text-[12px] text-[#707072]"
          >
            The API validates this against the shared mission schema before
            anything is persisted.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e5e5] pt-5">
            <span aria-live="polite" className="text-[13px] text-[#525252]">
              {message}
            </span>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/app/missions"
                className="box-btn box-btn-secondary inline-flex min-h-11 items-center border border-black bg-white px-5 text-[13px] font-semibold !text-black no-underline hover:bg-[#f5f5f5]"
              >
                Cancel
              </Link>
              <button
                className="box-btn box-btn-primary inline-flex min-h-11 items-center border border-black bg-black px-5 text-[13px] font-semibold !text-white disabled:opacity-45"
                type="submit"
                disabled={pending}
              >
                {pending ? "Creating…" : "Create mission"}
              </button>
            </div>
          </div>
        </form>
        <aside className="bg-[#f5f5f5]">
          <div className="border-b border-black px-5 py-4">
            <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[#707072]">
              Before you freeze
            </p>
            <h2 className="m-0 mt-1 text-[16px] font-medium text-black">
              Definition checklist
            </h2>
          </div>
          <ul className="m-0 list-none divide-y divide-[#e5e5e5] p-0">
            {[
              "Every write step needs a retry class and proof specification.",
              "Recovery actions must be declared up front — never improvised.",
              "Sepolia is the only launch network; mainnet targets are rejected.",
              "Amounts must be unsigned integer strings (wei / base units).",
            ].map((item) => (
              <li
                key={item}
                className="px-5 py-4 text-[13px] leading-relaxed text-[#525252]"
              >
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </div>
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
  const queryClient = useQueryClient();
  const resumeMutation = useMutation({
    mutationFn: () => api.controlRun(runId, "resume"),
    onSuccess: () => {
      toast.success("Reconciliation resumed.");
      void queryClient.invalidateQueries({ queryKey: ["run", runId] });
    },
    onError: (error) => {
      toast.error(
        getAetherErrorMessage(error, "Reconciliation could not be resumed."),
      );
    },
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
            {!demo &&
            run.state === "NEEDS_ATTENTION" &&
            run.stateReason ===
              "Reconciliation has no matching step evidence." ? (
              <button
                type="button"
                className="box-btn box-btn-secondary inline-flex min-h-11 items-center justify-center border border-black bg-white px-5 text-[13px] font-semibold !text-black no-underline transition-colors hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={resumeMutation.isPending}
                onClick={() => resumeMutation.mutate()}
              >
                {resumeMutation.isPending
                  ? "Resuming…"
                  : "Resume reconciliation"}
              </button>
            ) : null}
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
