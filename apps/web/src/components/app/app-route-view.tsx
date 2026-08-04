"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  aetherClient,
  getAetherErrorMessage,
  isAuthenticationError,
} from "@aether/sdk";
import {
  Activity,
  Add,
  ArrowRight2,
  CloudConnection,
  Code,
  DocumentCode2,
  Filter,
  HierarchySquare2,
  Link1,
  Refresh,
  ShieldTick,
  TickCircle,
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
import { useRefreshDashboard } from "@/features/dashboard/use-refresh-dashboard";
import { useSession } from "@/features/auth/use-session";

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
  const summary = data.overviewSummary;
  const alignment = summary.totalResources
    ? Math.round((summary.alignedResources / summary.totalResources) * 100)
    : 0;
  const severityEntries = Object.entries(summary.findingsBySeverity);
  const maxSeverity = Math.max(1, ...severityEntries.map(([, count]) => count));
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
      <section
        className="overview-hero-grid"
        aria-label="Protocol health summary"
      >
        <Card className="overview-health-card">
          <div
            className="health-ring__visual"
            style={{ "--health": summary.healthScore } as React.CSSProperties}
            aria-label={`Protocol health ${summary.healthScore} percent`}
          >
            <strong>{summary.healthScore}%</strong>
          </div>
          <div className="overview-health-copy">
            <span className="visual-kicker">Protocol health</span>
            <h2>{drift.length ? "Attention required" : "State converged"}</h2>
            <p>
              {drift.length
                ? `${drift.length} persisted finding${drift.length === 1 ? "" : "s"} require evidence review.`
                : "The latest pinned observation matches approved intent."}
            </p>
            <Status status={protocol.status} />
          </div>
        </Card>
        <Card className="alignment-card">
          <div className="alignment-card__head">
            <div>
              <span className="visual-kicker">Desired alignment</span>
              <strong>{alignment}%</strong>
            </div>
            <span>
              {summary.alignedResources}/{summary.totalResources} resources
            </span>
          </div>
          <div className="alignment-track" aria-hidden="true">
            <i style={{ width: `${alignment}%` }} />
          </div>
          <div
            className="severity-visual"
            aria-label="Open findings by severity"
          >
            {severityEntries.map(([severity, count]) => (
              <div
                className={`severity-row severity-row--${severity}`}
                key={severity}
              >
                <span>{severity}</span>
                <div>
                  <i style={{ width: `${(count / maxSeverity) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <section className="metric-grid" aria-label="Protocol resources">
        {data.metrics.map((metric) => (
          <Card className="metric-card" key={metric.label}>
            <span className="metric-card__label">{metric.label}</span>
            <strong className="metric-card__value">{metric.value}</strong>
            <span className="metric-card__detail">{metric.detail}</span>
          </Card>
        ))}
      </section>
      <div className="dashboard-grid dashboard-grid--overview">
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
        <Panel title="Execution lifecycle">
          {data.execution ? (
            <>
              <Link href={`/app/executions/${data.execution.id}`}>
                Open execution
              </Link>
              <div className="lifecycle-progress">
                <div>
                  <span>{summary.lifecycle.current.replaceAll("_", " ")}</span>
                  <strong>
                    {summary.lifecycle.completed}/{summary.lifecycle.total}
                  </strong>
                </div>
                <div className="alignment-track" aria-hidden="true">
                  <i
                    style={{
                      width: `${summary.lifecycle.total ? (summary.lifecycle.completed / summary.lifecycle.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <RecordList records={executions} />
            </>
          ) : (
            <EmptyState
              title="No execution"
              description="A real execution appears only after a plan is simulated and approved."
            />
          )}
        </Panel>
        <Panel title="Live connections">
          <div className="connection-matrix">
            {summary.connections.length ? (
              summary.connections.map((connection) => (
                <div key={connection.id}>
                  <span className="connection-pulse" />
                  <strong>{connection.label}</strong>
                  <Status status={connection.status} />
                </div>
              ))
            ) : (
              <EmptyState
                title="Connections not configured"
                description="Complete Protocol Setup to expose live provider evidence."
              />
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

function isHealthyStatus(status?: string) {
  return ["healthy", "resolved", "completed", "connected"].includes(
    status ?? "",
  );
}

function ProtocolSetup({
  data,
}: {
  data: ReturnType<typeof useDashboard>["data"] & {};
}) {
  const searchParams = useSearchParams();
  const refreshDashboard = useRefreshDashboard();
  const requestedTab = searchParams.get("tab");
  const allowedTabs = new Set([
    "general",
    "networks",
    "contracts",
    "github",
    "keeperhub",
  ]);
  const [tab, setTab] = useState(
    requestedTab && allowedTabs.has(requestedTab) ? requestedTab : "general",
  );
  const [dialog, setDialog] = useState<"network" | "contract" | null>(null);
  const [resourceValue, setResourceValue] = useState("");
  const protocol = data.protocols[0]!;
  const [protocolName, setProtocolName] = useState(protocol.name);
  const [governance, setGovernance] = useState(protocol.governance);
  const networks = data.records.networks ?? [];
  const contracts = data.records.contracts ?? [];
  const connections = data.records.connections ?? [];
  const githubConnection = connections.find((item) => item.id === "github");
  const keeperhubConnection = connections.find(
    (item) => item.id === "keeperhub",
  );
  const setupMutation = useMutation({
    mutationFn: ({
      section,
      input,
    }: {
      section: "general" | "networks" | "contracts";
      input: Record<string, unknown>;
    }) => aetherClient.updateProtocolSetup(section, input),
    onSuccess: async ({ section }) => {
      await refreshDashboard();
      toast.success(`${section} settings saved.`);
    },
    onError: () =>
      toast.error("The API could not persist these settings. Nothing changed."),
  });
  useEffect(() => {
    const githubStatus = searchParams.get("github");
    if (!githubStatus) return;
    if (githubStatus === "connected") {
      void refreshDashboard();
      toast.success("GitHub App connected.");
    } else if (githubStatus === "requested") {
      toast.info(
        "GitHub installation approval was requested from the organization owner.",
      );
    }
    setTab("github");
    window.history.replaceState({}, "", "/app/protocol-setup?tab=github");
  }, [refreshDashboard, searchParams]);
  const tabs = [
    {
      value: "general",
      label: "General",
      detail: "Identity & governance",
      status: protocol.name && protocol.governance ? "healthy" : "warning",
    },
    {
      value: "networks",
      label: "Networks",
      detail: "Sepolia observation",
      status: networks.length ? "healthy" : "warning",
    },
    {
      value: "contracts",
      label: "Contracts",
      detail: "Targets & evidence",
      status: contracts.length ? "healthy" : "warning",
    },
    {
      value: "github",
      label: "GitHub",
      detail: "Release provenance",
      status: githubConnection?.status ?? "warning",
    },
    {
      value: "keeperhub",
      label: "KeeperHub",
      detail: "Execution readiness",
      status: keeperhubConnection?.status ?? "warning",
    },
  ];
  const readyCount = tabs.filter((item) => isHealthyStatus(item.status)).length;
  const readinessPct = Math.round((readyCount / tabs.length) * 100);
  const selectTab = (value: string) => {
    setTab(value);
    window.history.replaceState({}, "", `/app/protocol-setup?tab=${value}`);
  };
  return (
    <>
      <PageHeader
        title="Protocol Setup"
        description={descriptions["protocol-setup"]}
        actions={
          <Link href="/app/desired-state">
            <Button variant="secondary">
              Open desired state <ArrowRight2 size={14} />
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
        <span className="mono">{activeLiveChain.displayName}</span>
      </div>
      <section
        className="setup-readiness a-card"
        aria-label="Protocol setup readiness"
      >
        <div className="setup-readiness__summary">
          <span className="visual-kicker">Configuration readiness</span>
          <strong>
            {readyCount}/{tabs.length} sections ready
          </strong>
          <p>
            {readyCount === tabs.length
              ? "Observation targets and execution boundary are configured."
              : "Complete each section so scans, provenance, and KeeperHub execution can run."}
          </p>
          <div
            className="alignment-track"
            role="progressbar"
            aria-valuenow={readinessPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Setup readiness ${readinessPct} percent`}
          >
            <i style={{ width: `${readinessPct}%` }} />
          </div>
        </div>
        <ol className="setup-readiness__steps">
          {tabs.map((item, index) => {
            const ready = isHealthyStatus(item.status);
            return (
              <li key={item.value}>
                <button
                  type="button"
                  className={
                    tab === item.value
                      ? "setup-readiness__step is-active"
                      : "setup-readiness__step"
                  }
                  onClick={() => selectTab(item.value)}
                  aria-current={tab === item.value ? "step" : undefined}
                >
                  <span className="setup-readiness__index" aria-hidden="true">
                    {ready ? (
                      <TickCircle size={16} variant="Bold" />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <span className="setup-readiness__copy">
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <Status status={item.status} />
                </button>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="setup-workspace">
        <Tabs value={tab} onValueChange={selectTab} tabs={tabs}>
          <TabContent className="setup-panel" value="general">
            <div className="settings-form a-card connection-setup-card">
              <div className="panel__head">
                <div>
                  <span className="visual-kicker">01 · Identity</span>
                  <h2>General protocol settings</h2>
                  <p>
                    Human-readable identity and the governance authority Aether
                    attributes for approvals.
                  </p>
                </div>
                <Status
                  status={
                    protocol.name && protocol.governance ? "healthy" : "warning"
                  }
                />
              </div>
              <div className="setup-info-grid" aria-label="Environment context">
                <div className="setup-info-tile">
                  <HierarchySquare2 size={18} aria-hidden="true" />
                  <div>
                    <strong>Live chain</strong>
                    <span>
                      {activeLiveChain.displayName} · {activeLiveChain.chainId}
                    </span>
                  </div>
                </div>
                <div className="setup-info-tile">
                  <ShieldTick size={18} aria-hidden="true" />
                  <div>
                    <strong>Protocol status</strong>
                    <span>{protocol.status.replaceAll("_", " ")}</span>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <Field
                  label="Protocol name"
                  hint="Shown across overview, drift, and audit."
                >
                  <Input
                    value={protocolName}
                    onChange={(event) => setProtocolName(event.target.value)}
                    placeholder="Arcadia Market"
                  />
                </Field>
                <Field
                  label="Environment"
                  hint="Mainnet is prohibited. Sepolia is the live target."
                >
                  <Select defaultValue={protocol.environment} disabled>
                    <option>{activeLiveChain.displayName}</option>
                  </Select>
                </Field>
              </div>
              <Field
                label="Governance authority"
                hint="Multisig, Safe, or operator address Aether records for approvals."
              >
                <Input
                  value={governance}
                  onChange={(event) => setGovernance(event.target.value)}
                  placeholder="0x… or Safe name"
                />
              </Field>
              <div className="setup-actions">
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
            </div>
          </TabContent>
          <TabContent className="setup-panel" value="networks">
            <SetupTable
              kicker="02 · Observation"
              title="Observed networks"
              description="Chains Aether pins for RPC observation, freshness checks, and executor readiness."
              emptyTitle="No networks configured"
              emptyDescription="Add Ethereum Sepolia so Aether can pin observations and verify postconditions."
              records={networks}
              actionLabel="Add network"
              onAction={() => setDialog("network")}
            />
          </TabContent>
          <TabContent className="setup-panel" value="contracts">
            <SetupTable
              kicker="03 · Targets"
              title="Observed contracts"
              description="Allowlisted addresses used for drift evaluation and correction planning."
              emptyTitle="No contracts configured"
              emptyDescription="Register the protocol contracts Aether should observe, including proxies."
              records={contracts}
              actionLabel="Add contract"
              onAction={() => setDialog("contract")}
            />
          </TabContent>
          <TabContent className="setup-panel" value="github">
            <GitHubConnectionPanel record={githubConnection} />
          </TabContent>
          <TabContent className="setup-panel" value="keeperhub">
            <KeeperHubConnectionPanel record={keeperhubConnection} />
          </TabContent>
        </Tabs>
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
            setResourceValue("");
          }
        }}
        title={dialog === "network" ? "Add network" : "Add contract"}
        description="The API validates and persists this resource for the selected protocol."
      >
        <div className="form-stack">
          <Field label="Display name">
            <Input
              value={
                dialog === "network"
                  ? activeLiveChain.displayName
                  : "Contract resource"
              }
              readOnly
              placeholder={
                dialog === "network"
                  ? activeLiveChain.displayName
                  : "OracleAdapter"
              }
            />
          </Field>
          <Field label={dialog === "network" ? "Chain ID" : "Contract address"}>
            <Input
              value={
                dialog === "network"
                  ? String(activeLiveChain.chainId)
                  : resourceValue
              }
              readOnly={dialog === "network"}
              onChange={(event) => setResourceValue(event.target.value)}
              placeholder={
                dialog === "network" ? String(activeLiveChain.chainId) : "0x…"
              }
            />
          </Field>
          <div className="a-callout">
            <ShieldTick size={18} aria-hidden="true" />
            <div>
              <strong>Fail-closed validation</strong>
              <p>
                Resources are only stored when the API accepts them. Invalid
                chain or address input leaves existing setup unchanged.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            disabled={
              setupMutation.isPending ||
              (dialog === "contract" && !resourceValue.trim())
            }
            onClick={() => {
              if (!dialog) return;
              setupMutation.mutate({
                section: dialog === "network" ? "networks" : "contracts",
                input:
                  dialog === "network"
                    ? {
                        chainId: activeLiveChain.chainId,
                        name: activeLiveChain.displayName,
                      }
                    : { address: resourceValue, name: "Contract resource" },
              });
              setDialog(null);
              setResourceValue("");
            }}
          >
            Validate and add
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function GitHubConnectionPanel({ record }: { record?: AetherRecord }) {
  const refreshDashboard = useRefreshDashboard();
  const [repository, setRepository] = useState("");
  const [desiredStatePath, setDesiredStatePath] = useState(
    "aether/desired-state.yaml",
  );
  const repositories = useQuery({
    queryKey: ["github", "repositories"],
    queryFn: () => aetherClient.getGitHubRepositories(),
    enabled: record?.status === "healthy",
    retry: false,
  });
  useEffect(() => {
    if (!repository && repositories.data?.[0]) {
      setRepository(repositories.data[0].full_name);
    }
  }, [repositories.data, repository]);
  const install = useMutation({
    mutationFn: () => aetherClient.getGitHubInstallUrl(),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) =>
      toast.error(
        getAetherErrorMessage(error, "GitHub installation could not start."),
      ),
  });
  const selected = repositories.data?.find(
    (item) => item.full_name === repository,
  );
  const save = useMutation({
    mutationFn: () =>
      aetherClient.selectGitHubRepository({
        repository,
        defaultBranch: selected?.default_branch ?? "",
        desiredStatePath,
      }),
    onSuccess: async () => {
      await refreshDashboard();
      toast.success("GitHub provenance source saved.");
    },
    onError: (error) =>
      toast.error(
        getAetherErrorMessage(
          error,
          "Repository selection could not be saved.",
        ),
      ),
  });
  return (
    <div className="settings-form a-card connection-setup-card">
      <div className="panel__head">
        <div>
          <span className="visual-kicker">04 · Provenance</span>
          <h2>GitHub App</h2>
          <p>
            Read-only release, pull-request, and desired-state evidence. Never
            used for repository writes.
          </p>
        </div>
        <Status status={record?.status ?? "warning"} />
      </div>
      <div className="connection-identity">
        <div className="connection-logo" aria-hidden="true">
          <Code size={20} />
        </div>
        <div>
          <strong>{record?.meta ?? "No installation connected"}</strong>
          <span>
            {record?.subtitle ?? "Install the Aether GitHub App to continue."}
          </span>
        </div>
        {isHealthyStatus(record?.status) ? (
          <span className="connection-pulse" aria-hidden="true" />
        ) : null}
      </div>
      {record?.status === "healthy" ? (
        <>
          <div className="form-row">
            <Field label="Repository">
              <Select
                value={repository}
                onChange={(event) => setRepository(event.target.value)}
              >
                {(repositories.data ?? []).map((item) => (
                  <option key={item.full_name} value={item.full_name}>
                    {item.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default branch">
              <Input readOnly value={selected?.default_branch ?? "Loading…"} />
            </Field>
          </div>
          <Field
            label="Desired-state path"
            hint="Repository-relative path read by Aether as provenance evidence."
          >
            <Input
              value={desiredStatePath}
              onChange={(event) => setDesiredStatePath(event.target.value)}
            />
          </Field>
          {repositories.isError ? (
            <div className="a-callout a-callout--danger">
              <Warning2 size={18} aria-hidden="true" />
              <div>
                <strong>Repository access failed</strong>
                <p>
                  The installation cannot read any repositories. Review the
                  selected repository permissions in GitHub.
                </p>
              </div>
            </div>
          ) : null}
          <div className="setup-actions">
            <Button
              variant="primary"
              disabled={!selected || save.isPending}
              onClick={() => save.mutate()}
            >
              Save provenance source
            </Button>
          </div>
        </>
      ) : (
        <div className="setup-actions">
          <Button
            variant="primary"
            disabled={install.isPending}
            onClick={() => install.mutate()}
          >
            <Link1 size={16} aria-hidden="true" />
            Install GitHub App
          </Button>
        </div>
      )}
      <div className="permission-grid" aria-label="GitHub permission boundary">
        <span>
          <ShieldTick size={16} aria-hidden="true" /> Metadata read
        </span>
        <span>
          <ShieldTick size={16} aria-hidden="true" /> Contents read
        </span>
        <span>
          <ShieldTick size={16} aria-hidden="true" /> Pull requests read
        </span>
        <span>
          <Warning2 size={16} aria-hidden="true" /> Repository writes denied
        </span>
      </div>
    </div>
  );
}

function SetupTable({
  kicker,
  title,
  description,
  emptyTitle,
  emptyDescription,
  records,
  actionLabel,
  onAction,
}: {
  kicker: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  records: AetherRecord[];
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="panel a-card setup-resource-panel">
      <div className="panel__head setup-resource-panel__head">
        <div>
          <span className="visual-kicker">{kicker}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onAction}>
          <Add size={14} aria-hidden="true" /> {actionLabel}
        </Button>
      </div>
      <div className="panel__body">
        {records.length ? (
          <>
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
                Value: item.value ? (
                  <code className="evidence-value">{item.value}</code>
                ) : (
                  <span className="muted">Pending</span>
                ),
                Details: item.meta ? (
                  <div className="evidence-cluster">
                    {item.meta.split(" · ").map((detail) => (
                      <span className="evidence-chip" key={detail}>
                        <ShieldTick size={13} aria-hidden="true" /> {detail}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="muted">Evidence pending</span>
                ),
              }))}
            />
            <ResponsiveCards records={records} />
          </>
        ) : (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            action={
              <Button variant="primary" size="sm" onClick={onAction}>
                <Add size={14} aria-hidden="true" /> {actionLabel}
              </Button>
            }
          />
        )}
      </div>
    </section>
  );
}

function KeeperHubConnectionPanel({ record }: { record?: AetherRecord }) {
  const refreshDashboard = useRefreshDashboard();
  const connect = useMutation({
    mutationFn: () => aetherClient.validateProvider("keeperhub"),
    onSuccess: async () => {
      await refreshDashboard();
      toast.success("Live connection state refreshed.");
    },
    onError: (error) =>
      toast.error(
        getAetherErrorMessage(
          error,
          "The live provider is not configured or unavailable.",
        ),
      ),
  });
  const ready = isHealthyStatus(record?.status);
  return (
    <div className="settings-form a-card connection-setup-card">
      <div className="panel__head">
        <div>
          <span className="visual-kicker">05 · Execution</span>
          <h2>KeeperHub execution adapter</h2>
          <p>
            Direct execution transport for simulated, approved corrections.
            Aether retains policy, approval, and verification authority.
          </p>
        </div>
        <Status status={record?.status ?? "warning"} />
      </div>
      <div className="connection-identity">
        <div className="connection-logo" aria-hidden="true">
          <CloudConnection size={20} />
        </div>
        <div>
          <strong>
            {record?.title ?? "KeeperHub organization not validated"}
          </strong>
          <span>
            {record?.subtitle ??
              "Validate the live adapter before simulation or submission."}
          </span>
        </div>
        {ready ? (
          <span className="connection-pulse" aria-hidden="true" />
        ) : null}
      </div>
      <div className="setup-info-grid" aria-label="Execution trust boundary">
        <div className="setup-info-tile">
          <ShieldTick size={18} aria-hidden="true" />
          <div>
            <strong>Simulation first</strong>
            <span>Exact request must match plan hash before approval.</span>
          </div>
        </div>
        <div className="setup-info-tile">
          <Activity size={18} aria-hidden="true" />
          <div>
            <strong>Idempotent submit</strong>
            <span>Unknown outcomes lock automatic resubmission.</span>
          </div>
        </div>
      </div>
      <div className="a-callout">
        <ShieldTick size={18} aria-hidden="true" />
        <div>
          <strong>Least privilege</strong>
          <p>
            {record?.meta ??
              "KeeperHub signs only allowlisted corrections after bound simulation and approval. OpenAI never authorizes transactions."}
          </p>
        </div>
      </div>
      <div className="permission-grid" aria-label="KeeperHub trust boundary">
        <span>
          <ShieldTick size={16} aria-hidden="true" /> Exact simulation
        </span>
        <span>
          <ShieldTick size={16} aria-hidden="true" /> Bound approval
        </span>
        <span>
          <ShieldTick size={16} aria-hidden="true" /> Direct execution only
        </span>
        <span>
          <Warning2 size={16} aria-hidden="true" /> No autonomous policy
        </span>
      </div>
      <div className="setup-actions">
        <Button
          variant={ready ? "secondary" : "primary"}
          disabled={connect.isPending}
          onClick={() => connect.mutate()}
        >
          <Refresh size={16} aria-hidden="true" />
          {connect.isPending ? "Validating…" : "Validate live connection"}
        </Button>
      </div>
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
  const githubSource = useQuery({
    queryKey: ["github", "desired-state-source"],
    queryFn: () => aetherClient.getGitHubDesiredState(),
    retry: false,
  });
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
          {githubSource.isLoading ? (
            <div className="a-skeleton" style={{ height: 88 }} />
          ) : null}
          {githubSource.isError ? (
            <div className="a-callout" role="alert">
              <Warning2 size={18} />
              <div>
                <strong>GitHub desired state is unavailable</strong>
                <p>
                  {getAetherErrorMessage(
                    githubSource.error,
                    "Check the selected repository path and validate the YAML schema.",
                  )}
                </p>
              </div>
            </div>
          ) : null}
          <DesiredStateEditor githubSource={githubSource.data} />
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
