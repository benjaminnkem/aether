"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight2,
  CloudConnection,
  HierarchySquare2,
  Refresh,
  ShieldTick,
  Warning2,
} from "iconsax-react";
import type { Dashboard } from "@aether/shared";
import { activeLiveChain } from "@aether/shared";
import { Badge, Button, Card, EmptyState, Status } from "@aether/ui";

function isHealthy(status?: string) {
  return ["healthy", "resolved", "completed", "connected"].includes(
    status ?? "",
  );
}

function tone(severity?: string) {
  return severity === "critical" || severity === "high"
    ? "danger"
    : severity === "medium"
      ? "warning"
      : "neutral";
}

function formatObservedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RecordList({
  records,
}: {
  records: Array<{
    id: string;
    title: string;
    subtitle?: string;
    status: string;
    severity?: string;
  }>;
}) {
  return (
    <div className="record-list">
      {records.slice(0, 4).map((item) => (
        <div className="record-row" key={item.id}>
          <div>
            <div className="record-title">{item.title}</div>
            {item.subtitle ? (
              <div className="record-subtitle">{item.subtitle}</div>
            ) : null}
          </div>
          <div className="record-row__meta">
            {item.severity ? (
              <Badge tone={tone(item.severity)}>{item.severity}</Badge>
            ) : null}
            <Status status={item.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Overview({ data }: { data: Dashboard }) {
  const protocol = data.protocols[0]!;
  const drift = (data.records.drift ?? []).filter(
    (item) => item.status !== "resolved",
  );
  const operations = data.records.operations ?? [];
  const executions = data.records.executions ?? [];
  const summary = data.overviewSummary;
  const alignment = summary.totalResources
    ? Math.round((summary.alignedResources / summary.totalResources) * 100)
    : 0;
  const severityEntries = Object.entries(summary.findingsBySeverity) as Array<
    [string, number]
  >;
  const maxSeverity = Math.max(1, ...severityEntries.map(([, count]) => count));
  const criticalOpen = summary.findingsBySeverity.critical > 0;
  const connectionsReady = summary.connections.every((item) =>
    isHealthy(item.status),
  );
  const primaryHref = drift.length
    ? "/app/drift"
    : data.operation
      ? `/app/operations/${data.operation.id}`
      : data.execution
        ? `/app/executions/${data.execution.id}`
        : "/app/desired-state";
  const primaryLabel = drift.length
    ? "Review drift"
    : data.operation
      ? "Inspect operation"
      : data.execution
        ? "Open execution"
        : "Open desired state";

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Overview</h1>
          <p>
            Current protocol health, active risk, and the shortest path to
            investigation.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/app/protocol-setup">
            <Button variant="secondary" size="sm">
              Protocol setup
            </Button>
          </Link>
          <Link href={primaryHref}>
            <Button variant={drift.length ? "primary" : "secondary"}>
              {primaryLabel} <ArrowRight2 size={14} aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </header>

      <div className="context-strip">
        <span>
          <i /> {protocol.name}
        </span>
        <Badge>{protocol.environment}</Badge>
        <Status status={protocol.status} />
        <span className="mono">{activeLiveChain.displayName}</span>
        <span>Observed {formatObservedAt(protocol.lastScanAt)}</span>
      </div>

      {criticalOpen || !connectionsReady ? (
        <div
          className={
            criticalOpen
              ? "overview-alert a-callout a-callout--danger"
              : "overview-alert a-callout"
          }
          role="status"
        >
          <Warning2 size={18} aria-hidden="true" />
          <div>
            <strong>
              {criticalOpen
                ? "Critical drift requires evidence review"
                : "Provider boundary incomplete"}
            </strong>
            <p>
              {criticalOpen
                ? `${summary.findingsBySeverity.critical} critical finding${summary.findingsBySeverity.critical === 1 ? "" : "s"} remain open. Investigate before planning a correction.`
                : "Finish Protocol Setup so observation, provenance, and KeeperHub execution can run."}
            </p>
          </div>
          <Link href={criticalOpen ? "/app/drift" : "/app/protocol-setup"}>
            <Button size="sm" variant={criticalOpen ? "danger" : "secondary"}>
              {criticalOpen ? "Open drift" : "Continue setup"}
            </Button>
          </Link>
        </div>
      ) : null}

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
            <div className="overview-health-meta">
              <Status status={protocol.status} />
              <span className="muted">
                Last observation · {formatObservedAt(summary.lastObservedAt)}
              </span>
            </div>
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
        {data.metrics.map((metric) => {
          const href = metric.label.toLowerCase().includes("drift")
            ? "/app/drift"
            : metric.label.toLowerCase().includes("network") ||
                metric.label.toLowerCase().includes("contract")
              ? "/app/protocol-setup"
              : metric.label.toLowerCase().includes("execution")
                ? data.execution
                  ? `/app/executions/${data.execution.id}`
                  : "/app/overview"
                : undefined;
          const body = (
            <>
              <span className="metric-card__label">{metric.label}</span>
              <strong className="metric-card__value">{metric.value}</strong>
              <span className="metric-card__detail">{metric.detail}</span>
            </>
          );
          return href ? (
            <Link
              key={metric.label}
              href={href}
              className="metric-card a-card metric-card--link"
            >
              {body}
            </Link>
          ) : (
            <Card className="metric-card" key={metric.label}>
              {body}
            </Card>
          );
        })}
      </section>

      <nav className="overview-quick-links" aria-label="Quick actions">
        <Link href="/app/protocol-setup" className="overview-quick-link">
          <HierarchySquare2 size={16} aria-hidden="true" />
          <span>
            <strong>Setup</strong>
            <small>Targets & providers</small>
          </span>
        </Link>
        <Link href="/app/desired-state" className="overview-quick-link">
          <ShieldTick size={16} aria-hidden="true" />
          <span>
            <strong>Desired state</strong>
            <small>Approved intent</small>
          </span>
        </Link>
        <Link href="/app/drift" className="overview-quick-link">
          <Activity size={16} aria-hidden="true" />
          <span>
            <strong>Drift</strong>
            <small>{drift.length ? `${drift.length} open` : "Aligned"}</small>
          </span>
        </Link>
        <Link
          href={
            data.execution
              ? `/app/executions/${data.execution.id}`
              : "/app/protocol-setup?tab=keeperhub"
          }
          className="overview-quick-link"
        >
          <CloudConnection size={16} aria-hidden="true" />
          <span>
            <strong>Execution</strong>
            <small>
              {data.execution
                ? data.execution.status.replaceAll("_", " ")
                : "Not started"}
            </small>
          </span>
        </Link>
      </nav>

      <div className="dashboard-grid dashboard-grid--overview">
        <section className="panel a-card">
          <div className="panel__head">
            <h2>{drift.length ? "Critical drift" : "Protocol aligned"}</h2>
            <Link href="/app/drift">Open drift</Link>
          </div>
          <div className="panel__body">
            {drift.length ? (
              <RecordList records={drift} />
            ) : (
              <EmptyState
                title="No active drift"
                description="The latest independent observation matches the active desired state."
              />
            )}
          </div>
        </section>

        {data.operation ? (
          <section className="panel a-card">
            <div className="panel__head">
              <h2>Active operation</h2>
              <Link href={`/app/operations/${data.operation.id}`}>
                Inspect plan
              </Link>
            </div>
            <div className="panel__body">
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
            </div>
          </section>
        ) : (
          <section className="panel a-card">
            <div className="panel__head">
              <h2>Active operation</h2>
            </div>
            <div className="panel__body">
              <EmptyState
                title="No operation"
                description="Run a scan and investigate a persisted drift finding before generating a correction plan."
                action={
                  <Link href="/app/drift">
                    <Button size="sm" variant="secondary">
                      <Refresh size={14} aria-hidden="true" /> Go to drift
                    </Button>
                  </Link>
                }
              />
            </div>
          </section>
        )}

        <section className="panel a-card">
          <div className="panel__head">
            <h2>Execution lifecycle</h2>
            {data.execution ? (
              <Link href={`/app/executions/${data.execution.id}`}>
                Open execution
              </Link>
            ) : null}
          </div>
          <div className="panel__body">
            {data.execution ? (
              <>
                <div className="lifecycle-progress">
                  <div>
                    <span>
                      {summary.lifecycle.current.replaceAll("_", " ")}
                    </span>
                    <strong>
                      {summary.lifecycle.completed}/{summary.lifecycle.total}
                    </strong>
                  </div>
                  <div className="alignment-track" aria-hidden="true">
                    <i
                      style={{
                        width: `${
                          summary.lifecycle.total
                            ? (summary.lifecycle.completed /
                                summary.lifecycle.total) *
                              100
                            : 0
                        }%`,
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
          </div>
        </section>

        <section className="panel a-card">
          <div className="panel__head">
            <h2>Live connections</h2>
            <Link href="/app/protocol-setup">Manage</Link>
          </div>
          <div className="panel__body">
            <div className="connection-matrix">
              {summary.connections.length ? (
                summary.connections.map((connection) => (
                  <Link
                    key={connection.id}
                    href={`/app/protocol-setup?tab=${connection.id === "github" ? "github" : connection.id === "keeperhub" ? "keeperhub" : "general"}`}
                    className={
                      isHealthy(connection.status)
                        ? "connection-matrix__item is-ready"
                        : "connection-matrix__item"
                    }
                  >
                    <span className="connection-pulse" aria-hidden="true" />
                    <strong>{connection.label}</strong>
                    <Status status={connection.status} />
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="Connections not configured"
                  description="Complete Protocol Setup to expose live provider evidence."
                  action={
                    <Link href="/app/protocol-setup">
                      <Button size="sm" variant="primary">
                        Open setup
                      </Button>
                    </Link>
                  }
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Overview;
