"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { aetherClient } from "@aether/sdk";
import {
  Activity,
  Add,
  ArrowRight2,
  DocumentCode2,
  Filter,
  Refresh,
  ShieldTick,
  Warning2,
} from "iconsax-react";
import {
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
  Dialog,
  Drawer,
  EmptyState,
  Field,
  Input,
  Select,
  Status,
  TabContent,
  Tabs,
  Timeline,
} from "@aether/ui";
import { AppShell } from "./app-shell";
import { useDashboard } from "@/features/dashboard/use-dashboard";

const OperationGraph = dynamic(
  () => import("@/features/operations/operation-graph"),
  {
    ssr: false,
    loading: () => <div className="a-skeleton" style={{ height: 360 }} />,
  },
);

const DesiredStateEditor = dynamic(
  () => import("@/features/desired-state/desired-state-editor"),
  {
    ssr: false,
    loading: () => <div className="a-skeleton" style={{ height: 520 }} />,
  },
);

const descriptions = {
  overview:
    "Current protocol health, active risk, and the shortest path to investigation.",
  "protocol-setup":
    "The networks, contracts, provenance, and execution adapter Aether observes.",
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
  const title = routeTitles[route] ?? "Aether";

  if (dashboard.isLoading) {
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
    >
      {route === "overview" ? <Overview data={data} /> : null}
      {route === "protocol-setup" ? <ProtocolSetup data={data} /> : null}
      {route === "desired-state" ? <DesiredState data={data} /> : null}
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

function Overview({
  data,
}: {
  data: ReturnType<typeof useDashboard>["data"] & {};
}) {
  const protocol = data.protocols[0]!;
  const drift = data.records.drift ?? [];
  const operations = data.records.operations ?? [];
  const executions = data.records.executions ?? [];
  return (
    <>
      <PageHeader
        title="Overview"
        description={descriptions.overview}
        actions={
          <Link href="/app/drift">
            <Button variant={drift.length ? "primary" : "secondary"}>
              Review drift <ArrowRight2 size={14} />
            </Button>
          </Link>
        }
      />
      <div className="context-strip">
        <span>
          <i /> {protocol.name}
        </span>
        <Badge>{protocol.environment}</Badge>
        <Status status={protocol.status} />
        <span>
          Observed {new Date(protocol.lastScanAt).toLocaleTimeString()}
        </span>
      </div>
      <section className="metric-grid" aria-label="Protocol metrics">
        {data.metrics.map((metric) => (
          <Card className="metric-card" key={metric.label}>
            <span className="metric-card__label">{metric.label}</span>
            <strong className="metric-card__value">{metric.value}</strong>
            <span className="metric-card__detail">{metric.detail}</span>
            {metric.trend ? (
              <span className="metric-card__trend">{metric.trend}</span>
            ) : null}
          </Card>
        ))}
      </section>
      <div className="dashboard-grid">
        <Panel
          title={drift.length ? "Critical drift" : "Protocol aligned"}
          action={<Link href="/app/drift">Open drift</Link>}
        >
          {drift.length ? (
            <RecordList records={drift} />
          ) : (
            <EmptyState
              title="No active drift"
              description="The latest independent observation matches the active desired state."
            />
          )}
        </Panel>
        {data.operation ? (
          <Panel
            title="Active operation"
            action={
              <Link href={`/app/operations/${data.operation.id}`}>
                Inspect plan
              </Link>
            }
          >
            <div className="operation-header">
              <div>
                <Status status={data.operation.status} />
                <h3>{data.operation.title}</h3>
                <p>{data.operation.summary}</p>
              </div>
              <Badge tone={tone(data.operation.risk)}>
                {data.operation.risk} risk
              </Badge>
            </div>
            <RecordList records={operations} />
          </Panel>
        ) : (
          <Panel title="Active operation">
            <EmptyState
              title="No operation"
              description="Run a scan and investigate a persisted drift finding before generating a correction plan."
            />
          </Panel>
        )}
        <Panel title="KeeperHub execution">
          {data.execution ? (
            <>
              <Link href={`/app/executions/${data.execution.id}`}>
                Open execution
              </Link>
              <RecordList records={executions} />
            </>
          ) : (
            <EmptyState
              title="No execution"
              description="A real execution appears only after a plan is simulated and approved."
            />
          )}
        </Panel>
        <Panel title="Network health">
          <RecordList records={data.records.networks ?? []} />
        </Panel>
      </div>
    </>
  );
}

function ProtocolSetup({
  data,
}: {
  data: ReturnType<typeof useDashboard>["data"] & {};
}) {
  const [tab, setTab] = useState("general");
  const [dialog, setDialog] = useState<"network" | "contract" | null>(null);
  const [resourceValue, setResourceValue] = useState("");
  const protocol = data.protocols[0]!;
  const [protocolName, setProtocolName] = useState(protocol.name);
  const [governance, setGovernance] = useState(protocol.governance);
  const setupMutation = useMutation({
    mutationFn: ({
      section,
      input,
    }: {
      section: "general" | "networks" | "contracts";
      input: Record<string, unknown>;
    }) => aetherClient.updateProtocolSetup(section, input),
    onSuccess: ({ section }) => toast.success(`${section} settings saved.`),
    onError: () =>
      toast.error("The API could not persist these settings. Nothing changed."),
  });
  const tabs = [
    { value: "general", label: "General" },
    { value: "networks", label: "Networks" },
    { value: "contracts", label: "Contracts" },
    { value: "github", label: "GitHub" },
    { value: "keeperhub", label: "KeeperHub" },
  ];
  return (
    <>
      <PageHeader
        title="Protocol Setup"
        description={descriptions["protocol-setup"]}
      />
      <Tabs value={tab} onValueChange={setTab} tabs={tabs}>
        <TabContent value="general">
          <div className="settings-form a-card">
            <div className="form-row">
              <Field label="Protocol name">
                <Input
                  value={protocolName}
                  onChange={(event) => setProtocolName(event.target.value)}
                />
              </Field>
              <Field label="Environment">
                <Select defaultValue={protocol.environment}>
                  <option>Base Sepolia</option>
                </Select>
              </Field>
            </div>
            <Field label="Governance authority">
              <Input
                value={governance}
                onChange={(event) => setGovernance(event.target.value)}
              />
            </Field>
            <Button
              variant="primary"
              disabled={setupMutation.isPending}
              onClick={() =>
                setupMutation.mutate({
                  section: "general",
                  input: {
                    name: protocolName,
                    environment: protocol.environment,
                    governanceAuthority: governance,
                  },
                })
              }
            >
              Save settings
            </Button>
          </div>
        </TabContent>
        <TabContent value="networks">
          <SetupTable
            title="Observed networks"
            records={data.records.networks ?? []}
            actionLabel="Add network"
            onAction={() => setDialog("network")}
          />
        </TabContent>
        <TabContent value="contracts">
          <SetupTable
            title="Observed contracts"
            records={data.records.contracts ?? []}
            actionLabel="Add contract"
            onAction={() => setDialog("contract")}
          />
        </TabContent>
        <TabContent value="github">
          <ConnectionPanel
            title="GitHub release provenance"
            description="Aether reads release and pull-request metadata. It never receives repository write permission in the MVP."
            record={(data.records.connections ?? []).find(
              (item) => item.id === "github",
            )}
          />
        </TabContent>
        <TabContent value="keeperhub">
          <ConnectionPanel
            title="KeeperHub execution adapter"
            description="KeeperHub is the configured third-party execution path. Aether independently controls policy, approvals, and post-execution verification."
            record={(data.records.connections ?? []).find(
              (item) => item.id === "keeperhub",
            )}
          />
        </TabContent>
      </Tabs>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Add ${dialog ?? "resource"}`}
        description="The API validates and persists this resource for the selected protocol."
      >
        <div className="form-stack">
          <Field label="Display name">
            <Input
              value={
                dialog === "network" ? "Base Sepolia" : "Contract resource"
              }
              readOnly
              placeholder={
                dialog === "network" ? "Base Sepolia" : "OracleAdapter"
              }
            />
          </Field>
          <Field label={dialog === "network" ? "Chain ID" : "Contract address"}>
            <Input
              value={dialog === "network" ? "84532" : resourceValue}
              readOnly={dialog === "network"}
              onChange={(event) => setResourceValue(event.target.value)}
              placeholder={dialog === "network" ? "84532" : "0x…"}
            />
          </Field>
          <Button
            variant="primary"
            onClick={() => {
              if (!dialog) return;
              setupMutation.mutate({
                section: dialog === "network" ? "networks" : "contracts",
                input:
                  dialog === "network"
                    ? { chainId: 84532, name: "Base Sepolia" }
                    : { address: resourceValue, name: "Contract resource" },
              });
              setDialog(null);
            }}
          >
            Validate and add
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function SetupTable({
  title,
  records,
  actionLabel,
  onAction,
}: {
  title: string;
  records: AetherRecord[];
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Panel
      title={title}
      action={
        <Button size="sm" onClick={onAction}>
          <Add size={14} /> {actionLabel}
        </Button>
      }
    >
      <DataTable
        caption={title}
        columns={["Resource", "Status", "Value", "Details"]}
        rows={records.map((item) => ({
          id: item.id,
          Resource: (
            <>
              <div className="record-title">{item.title}</div>
              <div className="record-subtitle">{item.subtitle}</div>
            </>
          ),
          Status: <Status status={item.status} />,
          Value: item.value,
          Details: item.meta,
        }))}
      />
      <ResponsiveCards records={records} />
    </Panel>
  );
}

function ConnectionPanel({
  title,
  description,
  record: connection,
}: {
  title: string;
  description: string;
  record?: AetherRecord;
}) {
  const connect = useMutation({
    mutationFn: async () => {
      if (title.toLowerCase().includes("github")) {
        const { url } = await aetherClient.getGitHubInstallUrl();
        window.location.assign(url);
        return;
      }
      await aetherClient.validateProvider("keeperhub");
    },
    onSuccess: () => {
      if (!title.toLowerCase().includes("github")) {
        toast.success("Live connection state refreshed.");
      }
    },
    onError: () =>
      toast.error("The live provider is not configured or unavailable."),
  });
  return (
    <div className="settings-form a-card">
      <div className="panel__head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Status status={connection?.status ?? "warning"} />
      </div>
      <Field label="Connection">
        <Input readOnly value={connection?.subtitle ?? "Not configured"} />
      </Field>
      <div className="a-callout">
        <ShieldTick size={18} />
        <div>
          <strong>Least privilege</strong>
          <p>{connection?.meta}</p>
        </div>
      </div>
      <Button disabled={connect.isPending} onClick={() => connect.mutate()}>
        {title.toLowerCase().includes("github")
          ? "Install GitHub App"
          : "Validate live connection"}
      </Button>
    </div>
  );
}

function DesiredState({
  data,
}: {
  data: ReturnType<typeof useDashboard>["data"] & {};
}) {
  const versions = data.records["desired-state"] ?? [];
  const active = versions.find((item) => item.value === "Active");
  return (
    <>
      <PageHeader
        title="Desired State"
        description={descriptions["desired-state"]}
        actions={
          active ? (
            <Badge tone="success">{active.title} active</Badge>
          ) : undefined
        }
      />
      <div className="dashboard-grid">
        <div>
          <DesiredStateEditor />
        </div>
        <div className="panel-stack">
          <Panel title="Active version">
            {active ? (
              <RecordList records={[active]} />
            ) : (
              <p className="record-subtitle">
                No desired-state version has been persisted.
              </p>
            )}
          </Panel>
          <Panel title="Safety policy">
            <Timeline
              items={[
                {
                  title: "Approved targets only",
                  detail: `${(data.records.contracts ?? []).length} registered contract(s)`,
                  status: (data.records.contracts ?? []).length
                    ? "healthy"
                    : "warning",
                },
                {
                  title: "Approval threshold",
                  detail: "One owner for critical correction",
                  status: "healthy",
                },
                {
                  title: "Independent verification",
                  detail: "Required after every write",
                  status: "healthy",
                },
              ]}
            />
          </Panel>
          <Panel title="Version history">
            {versions.length ? (
              <Timeline
                items={versions.map((item) => ({
                  title: item.title,
                  detail: item.meta ?? item.subtitle,
                  status: item.status,
                }))}
              />
            ) : (
              <p className="record-subtitle">No version history.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Drift({
  data,
}: {
  data: ReturnType<typeof useDashboard>["data"] & {};
}) {
  const [selected, setSelected] = useState<AetherRecord>();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const scan = useMutation({
    mutationFn: () => aetherClient.runScan(),
    onSuccess: () => toast.success("Live observation scan queued."),
    onError: () =>
      toast.error("The live observation scan could not be queued."),
  });
  const investigate = useMutation({
    mutationFn: (findingId: string) =>
      aetherClient.investigateFinding(findingId),
    onSuccess: () => toast.success("OpenAI investigation queued."),
    onError: () =>
      toast.error("Investigation is unavailable. Check OpenAI configuration."),
  });
  const plan = useMutation({
    mutationFn: (findingId: string) => aetherClient.generatePlan(findingId),
    onSuccess: (operation: { id?: string }) => {
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
          (severity === "all" || item.severity === severity) &&
          `${item.title} ${item.subtitle}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [data.records.drift, query, severity],
  );
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
              <span>Base Sepolia</span>
            </div>
            <Panel title="Observed fact">
              <p className="record-subtitle">
                {selected.subtitle}. Evidence is loaded from the persisted
                observation and desired-state version.
              </p>
              {selected.value ? <ChainValue value={selected.value} /> : null}
            </Panel>
            <Panel title="Desired value">
              <p className="record-meta">
                {selected.meta ?? "No desired-state provenance is available."}
              </p>
            </Panel>
            <Panel title="Testnet-only drift action">
              <p className="record-subtitle">
                Aether never stores a signing key. From an authorized local
                Foundry account, run the fixture drift script on chain 84532,
                then use Run observation scan.
              </p>
              <CodeBlock
                language="bash"
                code={
                  'pnpm --filter @aether/contracts exec forge script script/CreateUnauthorizedOracleDrift.s.sol:CreateUnauthorizedOracleDrift --rpc-url "$AETHER_RPC_URL" --account aether-base-sepolia-drift --broadcast'
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
  const [selectedStep, setSelectedStep] = useState<OperationStep>();
  const operation = data.operation;
  const simulate = useMutation({
    mutationFn: () =>
      aetherClient.simulateOperation(resourceId ?? operation?.id ?? ""),
    onSuccess: () => toast.success("KeeperHub simulation queued."),
    onError: () => toast.error("KeeperHub simulation could not be queued."),
  });
  const execute = useMutation({
    mutationFn: () =>
      aetherClient.executeOperation(resourceId ?? operation?.id ?? ""),
    onSuccess: ({ id }) => {
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
        title={`KeeperHub ${execution.directExecutionId || "direct execution"}`}
        description={descriptions.executions}
        actions={<Status status={execution.status} />}
      />
      <div className="context-strip" aria-live="polite">
        <span>{execution.network}</span>
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
                href={`https://sepolia.basescan.org/tx/${execution.txHash}`}
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
            Reference: item.value,
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
