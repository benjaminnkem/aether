"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { aetherClient, isAuthenticationError } from "@aether/sdk";
import {
  Activity,
  ArrowRight2,
  DocumentCode2,
  Filter,
  Refresh,
  ShieldTick,
  Warning2,
} from "iconsax-react";
import {
  activeLiveChain,
  routeTitles,
  type AetherRecord,
  type OperationStep,
} from "@aether/shared";
import {
  Badge,
  Button,
  Card,
  ChainValue,
  CodeBlock,
  DataTable,
  Drawer,
  EmptyState,
  Input,
  Select,
  Status,
  Timeline,
} from "@aether/ui";
import { AppShell } from "./app-shell";
import { useDashboard } from "@/features/dashboard/use-dashboard";
import { useRefreshDashboard } from "@/features/dashboard/use-refresh-dashboard";
import { useSession } from "@/features/auth/use-session";
import ProtocolSetup from "@/features/protocol-setup/protocol-setup";
import Overview from "@/features/overview/overview";
import DesiredStatePage from "@/features/desired-state/desired-state-page";

const OperationGraph = dynamic(
  () => import("@/features/operations/operation-graph"),
  {
    ssr: false,
    loading: () => <div className="a-skeleton" style={{ height: 360 }} />,
  },
);

const descriptions = {
  overview:
    "Current protocol health, active risk, and the shortest path to investigation.",
  "protocol-setup":
    "Configure identity, observation targets, provenance, and the KeeperHub execution boundary.",
  "desired-state":
    "Versioned approved intent, deterministic safety rules, and human-readable units.",
  drift:
    "Evidence-backed differences between approved intent and observed onchain state.",
  operations:
    "An immutable correction plan from evidence through approval and verification.",
  executions:
    "KeeperHub workflow evidence with transaction, retry, and reconciliation safety.",
  "audit-log":
    "Append-only attribution across scans, plans, approvals, execution, and verification.",
} as const;

function routeKey(slug: string[]) {
  return slug[0] ?? "overview";
}

function tone(severity?: string) {
  return severity === "critical" || severity === "high"
    ? "danger"
    : severity === "medium"
      ? "warning"
      : "neutral";
}

export function AppRouteView({ slug }: { slug: string[] }) {
  const key = routeKey(slug);
  return <AppPage route={key} resourceId={slug[1]} />;
}

function AppPage({
  route,
  resourceId,
}: {
  route: string;
  resourceId?: string;
}) {
  const dashboard = useDashboard();
  const session = useSession();
  const title = routeTitles[route] ?? "Aether";

  useEffect(() => {
    if (session.isLoading) return;
    if (!session.data || isAuthenticationError(dashboard.error)) {
      const returnTo = encodeURIComponent(window.location.pathname);
      window.location.replace(`/login?returnTo=${returnTo}`);
      return;
    }
    if (session.data.destination === "onboarding") {
      window.location.replace("/onboarding");
    }
  }, [dashboard.error, session.data, session.isLoading]);

  if (dashboard.isLoading || session.isLoading) {
    return (
      <AppShell title={title}>
        <PageHeader
          title={title}
          description={
            route in descriptions
              ? descriptions[route as keyof typeof descriptions]
              : ""
          }
        />
        <div className="metric-grid">
          {[1, 2, 3, 4].map((item) => (
            <div className="a-skeleton" style={{ height: 116 }} key={item} />
          ))}
        </div>
      </AppShell>
    );
  }

  if (
    !session.data ||
    session.data.destination === "onboarding" ||
    isAuthenticationError(dashboard.error)
  ) {
    return (
      <AppShell title={title}>
        <div className="a-skeleton" style={{ height: 180 }} />
      </AppShell>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <AppShell title={title}>
        <EmptyState
          title="Dashboard data is unavailable"
          description="The live API did not return a valid response. Check authentication, tenant setup, and provider health, then retry."
          action={
            <Button onClick={() => void dashboard.refetch()}>
              <Refresh size={14} /> Retry
            </Button>
          }
        />
      </AppShell>
    );
  }

  const data = dashboard.data;
  return (
    <AppShell
      title={title}
      organization={data.organization ?? undefined}
      protocol={data.protocols[0]}
      realtime={data.realtime}
    >
      {route === "overview" ? <Overview data={data} /> : null}
      {route === "protocol-setup" ? <ProtocolSetup data={data} /> : null}
      {route === "desired-state" ? <DesiredStatePage data={data} /> : null}
      {route === "drift" ? <Drift data={data} /> : null}
      {route === "operations" ? (
        <OperationDetail
          data={data}
          resourceId={resourceId}
          approve={(decision) =>
            dashboard.approval.mutate({
              operationId: resourceId ?? data.operation?.id ?? "",
              decision,
            })
          }
        />
      ) : null}
      {route === "executions" ? (
        <ExecutionDetail data={data} resourceId={resourceId} />
      ) : null}
      {route === "audit-log" ? <AuditLog data={data} /> : null}
    </AppShell>
  );
}

function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

function Drift({
  data,
}: {
  data: ReturnType<typeof useDashboard>["data"] & {};
}) {
  const refreshDashboard = useRefreshDashboard();
  const [selected, setSelected] = useState<AetherRecord>();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const scan = useMutation({
    mutationFn: () => aetherClient.runScan(),
    onSuccess: async () => {
      await refreshDashboard();
      toast.success("Live observation scan queued.");
    },
    onError: () =>
      toast.error("The live observation scan could not be queued."),
  });
  const investigate = useMutation({
    mutationFn: (findingId: string) =>
      aetherClient.investigateFinding(findingId),
    onSuccess: async () => {
      await refreshDashboard();
      toast.success("OpenAI investigation queued.");
    },
    onError: () =>
      toast.error("Investigation is unavailable. Check OpenAI configuration."),
  });
  const plan = useMutation({
    mutationFn: (findingId: string) => aetherClient.generatePlan(findingId),
    onSuccess: async (operation: { id?: string }) => {
      await refreshDashboard();
      toast.success("Immutable correction plan created.");
      if (operation.id)
        window.location.assign(`/app/operations/${operation.id}`);
    },
    onError: () =>
      toast.error(
        "A correction plan could not be generated from this finding.",
      ),
  });
  const drift = useMemo(
    () =>
      (data.records.drift ?? []).filter(
        (item) =>
          item.status !== "resolved" &&
          (severity === "all" || item.severity === severity) &&
          `${item.title} ${item.subtitle}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [data.records.drift, query, severity],
  );
  const investigationJob = selected
    ? (data.records.jobs ?? []).find(
        (item) =>
          item.title === "investigation.run" && item.meta === selected.id,
      )
    : undefined;
  return (
    <>
      <PageHeader
        title="Drift"
        description={descriptions.drift}
        actions={
          <Button disabled={scan.isPending} onClick={() => scan.mutate()}>
            <Refresh size={14} /> Run observation scan
          </Button>
        }
      />
      <div className="filters">
        <Input
          aria-label="Search drift"
          placeholder="Search contract or address"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          aria-label="Filter severity"
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
        </Select>
        <Button size="sm">
          <Filter size={14} /> Filters
        </Button>
      </div>
      <Panel
        title={`${drift.length} active finding${drift.length === 1 ? "" : "s"}`}
      >
        {drift.length ? (
          <>
            <DataTable
              caption="Active drift findings"
              columns={["Finding", "Severity", "Status", "Observed"]}
              rows={drift.map((item) => ({
                id: item.id,
                Finding: (
                  <>
                    <div className="record-title">{item.title}</div>
                    <div className="record-subtitle">{item.subtitle}</div>
                  </>
                ),
                Severity: (
                  <Badge tone={tone(item.severity)}>{item.severity}</Badge>
                ),
                Status: <Status status={item.status} />,
                Observed: item.value,
              }))}
              onRowClick={(index) => setSelected(drift[index])}
            />
            <ResponsiveCards records={drift} onSelect={setSelected} />
          </>
        ) : (
          <EmptyState
            title="No active drift"
            description="No unresolved persisted findings are present."
          />
        )}
      </Panel>
      <Drawer
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(undefined)}
        title={selected?.title ?? "Drift evidence"}
        description="Facts are retained separately from analysis and recommended action."
      >
        {selected ? (
          <div className="panel-stack">
            <div className="context-strip">
              <Badge tone="danger">{selected.severity}</Badge>
              <Status status={selected.status} />
              <span>{activeLiveChain.displayName}</span>
            </div>
            <Panel title="Observed fact">
              <p className="record-subtitle">
                {selected.subtitle}. Evidence is loaded from the persisted
                observation and desired-state version.
              </p>
              {selected.value ? <ChainValue value={selected.value} /> : null}
            </Panel>
            <Panel title="Desired value">
              {selected.meta ? (
                <ChainValue value={selected.meta} />
              ) : (
                <p className="record-meta">
                  No desired-state provenance is available.
                </p>
              )}
            </Panel>
            <Panel title="Testnet-only drift action">
              <p className="record-subtitle">
                Aether never stores a signing key. From an authorized local
                Foundry account, run the fixture drift script on chain{" "}
                {activeLiveChain.chainId}, then use Run observation scan.
              </p>
              <CodeBlock
                language="bash"
                code={
                  'pnpm --filter @aether/contracts exec forge script script/CreateUnauthorizedOracleDrift.s.sol:CreateUnauthorizedOracleDrift --rpc-url "$AETHER_RPC_URL" --account aether-ethereum-sepolia-drift --broadcast'
                }
              />
            </Panel>
            <div className="a-callout">
              <Warning2 size={18} />
              <div>
                <strong>Analysis, not proof</strong>
                <p>
                  Investigation is advisory. Actor attribution and corrective
                  calldata are determined independently from RPC and approved
                  desired state.
                </p>
              </div>
            </div>
            {investigationJob ? (
              <div
                className={`a-callout ${investigationJob.status === "failed" ? "a-callout--danger" : ""}`}
                role={investigationJob.status === "failed" ? "alert" : "status"}
              >
                {investigationJob.status === "failed" ? (
                  <Warning2 size={18} />
                ) : (
                  <ShieldTick size={18} />
                )}
                <div>
                  <strong>
                    Advisory investigation {investigationJob.status}
                  </strong>
                  <p>{investigationJob.subtitle}</p>
                </div>
              </div>
            ) : null}
            <Button
              disabled={investigate.isPending}
              onClick={() => investigate.mutate(selected.id)}
            >
              Investigate with OpenAI
            </Button>
            {data.operation ? (
              <Link href={`/app/operations/${data.operation.id}`}>
                <Button variant="primary">
                  Open correction plan <ArrowRight2 size={14} />
                </Button>
              </Link>
            ) : (
              <Button
                variant="primary"
                disabled={plan.isPending}
                onClick={() => plan.mutate(selected.id)}
              >
                Generate correction plan
              </Button>
            )}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

function OperationDetail({
  data,
  resourceId,
  approve,
}: {
  data: ReturnType<typeof useDashboard>["data"] & {};
  resourceId?: string;
  approve: (decision: "approve" | "reject") => void;
}) {
  const refreshDashboard = useRefreshDashboard();
  const [selectedStep, setSelectedStep] = useState<OperationStep>();
  const operation = data.operation;
  const simulate = useMutation({
    mutationFn: () =>
      aetherClient.simulateOperation(resourceId ?? operation?.id ?? ""),
    onSuccess: async () => {
      await refreshDashboard();
      toast.success("KeeperHub simulation queued.");
    },
    onError: () => toast.error("KeeperHub simulation could not be queued."),
  });
  const execute = useMutation({
    mutationFn: () =>
      aetherClient.executeOperation(resourceId ?? operation?.id ?? ""),
    onSuccess: async ({ id }) => {
      await refreshDashboard();
      toast.success("KeeperHub direct execution queued.");
      window.location.assign(`/app/executions/${id}`);
    },
    onError: () =>
      toast.error("Execution was not queued. Verify simulation and approval."),
  });
  if (!operation) {
    return (
      <EmptyState
        title="Operation not found"
        description="Generate a deterministic plan from a persisted drift finding first."
      />
    );
  }
  if (resourceId !== operation.id) {
    return (
      <EmptyState
        title="Operation not found"
        description="Correction operations appear here after a persisted drift finding is investigated and planned."
        action={
          <Link href={`/app/operations/${operation.id}`}>Open operation</Link>
        }
      />
    );
  }
  return (
    <>
      <PageHeader
        title={operation.title}
        description={descriptions.operations}
        actions={
          <>
            <Badge tone={tone(operation.risk)}>{operation.risk} risk</Badge>
            <Status status={operation.status} />
          </>
        }
      />
      <div className="context-strip">
        <span>{operation.planVersion}</span>
        <span className="mono">{operation.planHash.slice(0, 18)}…</span>
        <span>Immutable after approval</span>
      </div>
      <div className="dashboard-grid">
        <Panel title="Correction plan" action={<DocumentCode2 size={17} />}>
          <p className="record-subtitle">{operation.summary}</p>
          <div className="operation-graph-wrap">
            <OperationGraph
              steps={operation.steps}
              onSelect={setSelectedStep}
            />
          </div>
          <ol
            className="operation-stepper"
            aria-label="Accessible operation steps"
          >
            {operation.steps.map((item) => (
              <li key={item.id}>
                <button onClick={() => setSelectedStep(item)}>
                  <strong>{item.label}</strong>
                  <Status status={item.status} />
                  <span>{item.detail}</span>
                </button>
              </li>
            ))}
          </ol>
        </Panel>
        <div className="panel-stack">
          <Panel title="Evidence">
            <Timeline
              items={operation.evidence.map((detail) => ({
                title: "Observed fact",
                detail,
                status: "healthy",
              }))}
            />
          </Panel>
          <Panel title="AI-assisted analysis">
            <div className="a-callout">
              <Warning2 size={18} />
              <div>
                <strong>Inference is advisory</strong>
                <p>{operation.inference.join(" ")}</p>
              </div>
            </div>
          </Panel>
          <Panel title="Policy and simulation">
            <RecordList
              records={[...operation.policyChecks, operation.simulation]}
            />
            {operation.simulation.status !== "healthy" ? (
              <Button
                className="mt-4"
                disabled={simulate.isPending}
                onClick={() => simulate.mutate()}
              >
                Simulate exact request
              </Button>
            ) : null}
          </Panel>
          <Panel title="Approval">
            <RecordList records={operation.approvals} />
            {(operation.status === "awaiting_approval" ||
              operation.status === "plan_ready") &&
            operation.simulation.status === "healthy" ? (
              <div className="page-actions">
                <Button variant="danger" onClick={() => approve("reject")}>
                  Reject
                </Button>
                <Button variant="primary" onClick={() => approve("approve")}>
                  Approve exact plan
                </Button>
              </div>
            ) : data.execution && operation.status === "approved" ? (
              <Button
                variant="primary"
                className="mt-4"
                disabled={execute.isPending}
                onClick={() => execute.mutate()}
              >
                Execute with KeeperHub <ArrowRight2 size={14} />
              </Button>
            ) : (
              <p className="record-subtitle">
                No execution intent has been persisted.
              </p>
            )}
          </Panel>
        </div>
      </div>
      <Drawer
        open={Boolean(selectedStep)}
        onOpenChange={(open) => !open && setSelectedStep(undefined)}
        title={selectedStep?.label ?? "Plan step"}
        description="This step is bound to the immutable operation plan."
      >
        {selectedStep ? (
          <div className="panel-stack">
            <Status status={selectedStep.status} />
            <p>{selectedStep.detail}</p>
            <CodeBlock
              language="json"
              code={JSON.stringify(
                {
                  id: selectedStep.id,
                  type: selectedStep.type,
                  status: selectedStep.status,
                  planHash: operation.planHash,
                },
                null,
                2,
              )}
            />
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

function ExecutionDetail({
  data,
  resourceId,
}: {
  data: ReturnType<typeof useDashboard>["data"] & {};
  resourceId?: string;
}) {
  const execution = data.execution;
  if (!execution) {
    return (
      <EmptyState
        title="Execution not found"
        description="No persisted KeeperHub direct execution exists."
      />
    );
  }
  if (resourceId !== execution.id) {
    return (
      <EmptyState
        title="Execution not found"
        description="No persisted KeeperHub execution exists with this identifier."
        action={
          <Link href={`/app/executions/${execution.id}`}>Open execution</Link>
        }
      />
    );
  }
  return (
    <>
      <PageHeader
        title="KeeperHub execution"
        description={descriptions.executions}
        actions={<Status status={execution.status} />}
      />
      <div className="context-strip" aria-live="polite">
        <span>{execution.network}</span>
        {execution.directExecutionId ? (
          <span>{execution.directExecutionId}</span>
        ) : null}
        <span>{execution.currentStep}</span>
        <Status status={data.realtime} label={`Realtime ${data.realtime}`} />
      </div>
      {execution.error ? (
        <div className="a-callout a-callout--danger" role="alert">
          <Warning2 size={18} />
          <div>
            <strong>Execution requires attention</strong>
            <p>{execution.error}</p>
          </div>
        </div>
      ) : null}
      {execution.reconciliation ? (
        <div className="a-callout">
          <Activity size={18} />
          <div>
            <strong>
              {execution.status === "unknown"
                ? "Automatic retry is locked"
                : "Forward correction required"}
            </strong>
            <p>{execution.reconciliation}</p>
          </div>
        </div>
      ) : null}
      <div className="dashboard-grid">
        <Panel title="Execution lifecycle">
          <Timeline
            items={execution.steps.map((item) => ({
              title: item.label,
              detail: item.detail,
              status: item.status,
            }))}
          />
        </Panel>
        <div className="panel-stack">
          <Panel title="Transaction">
            {execution.txHash ? (
              <ChainValue
                value={execution.txHash}
                kind="transaction"
                href={`${activeLiveChain.explorerUrl}/tx/${execution.txHash}`}
              />
            ) : (
              <p className="record-subtitle">
                No transaction submitted. Simulation and approval must complete
                first.
              </p>
            )}
            <RecordList
              records={[
                {
                  id: "gas",
                  title: "Gas",
                  subtitle: `Estimated ${execution.gasEstimate}`,
                  status: "healthy",
                  value: execution.gasUsed
                    ? `${execution.gasUsed} used`
                    : "Pending",
                  timestamp: execution.updatedAt,
                },
              ]}
            />
          </Panel>
          <Panel title="Safety boundary">
            <p className="record-subtitle">
              KeeperHub executes the approved request. Aether independently
              verifies postconditions and never treats an uncertain outcome as
              safe to retry.
            </p>
          </Panel>
          <Link href="/app/audit-log">
            <Button>Review audit evidence</Button>
          </Link>
        </div>
      </div>
    </>
  );
}

function AuditLog({
  data,
}: {
  data: ReturnType<typeof useDashboard>["data"] & {};
}) {
  const [selected, setSelected] = useState<AetherRecord>();
  const [query, setQuery] = useState("");
  const records = (data.records["audit-log"] ?? []).filter((item) =>
    `${item.title} ${item.subtitle}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader title="Audit Log" description={descriptions["audit-log"]} />
      <div className="filters">
        <Input
          aria-label="Search audit log"
          placeholder="Search event, actor, request, or transaction"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select aria-label="Filter actor" defaultValue="all">
          <option value="all">All actors</option>
          <option value="human">Human</option>
          <option value="system">System</option>
          <option value="provider">Provider</option>
        </Select>
        <Input aria-label="Filter audit date" type="date" />
      </div>
      <Panel title={`${records.length} retained events`}>
        <DataTable
          caption="Audit events"
          columns={["Event", "Actor and context", "Status", "Reference"]}
          rows={records.map((item) => ({
            id: item.id,
            Event: <div className="record-title">{item.title}</div>,
            "Actor and context": (
              <div className="record-subtitle">{item.subtitle}</div>
            ),
            Status: <Status status={item.status} />,
            Reference: item.value ? (
              <code className="evidence-value">{item.value}</code>
            ) : null,
          }))}
          onRowClick={(index) => setSelected(records[index])}
        />
        <ResponsiveCards records={records} onSelect={setSelected} />
      </Panel>
      <Drawer
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(undefined)}
        title={selected?.title ?? "Audit event"}
        description="Immutable event evidence with correlation context."
      >
        {selected ? (
          <div className="panel-stack">
            <Status status={selected.status} />
            <dl className="settings-form a-card">
              <dt>Actor and context</dt>
              <dd>{selected.subtitle}</dd>
              <dt>Reference</dt>
              <dd className="mono">{selected.value}</dd>
              <dt>Evidence</dt>
              <dd>{selected.meta}</dd>
              <dt>Recorded</dt>
              <dd>{new Date(selected.timestamp).toLocaleString()}</dd>
            </dl>
            <CodeBlock
              language="json"
              code={JSON.stringify(selected, null, 2)}
            />
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel a-card">
      <div className="panel__head">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}

function RecordList({ records }: { records: AetherRecord[] }) {
  return (
    <div className="panel-stack">
      {records.map((item) => (
        <Card key={item.id}>
          <div className="panel__head">
            <div>
              <div className="record-title">{item.title}</div>
              <div className="record-subtitle">{item.subtitle}</div>
            </div>
            <Status status={item.status} />
          </div>
          <div className="record-meta">
            {item.value}
            {item.meta ? ` · ${item.meta}` : ""}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ResponsiveCards({
  records,
  onSelect,
}: {
  records: AetherRecord[];
  onSelect?: (record: AetherRecord) => void;
}) {
  return (
    <div className="responsive-cards">
      {records.map((item) => (
        <button
          key={item.id}
          className="a-card"
          onClick={() => onSelect?.(item)}
        >
          <div className="panel__head">
            <strong>{item.title}</strong>
            <Status status={item.status} />
          </div>
          <p>{item.subtitle}</p>
          <span>{item.value}</span>
        </button>
      ))}
    </div>
  );
}
