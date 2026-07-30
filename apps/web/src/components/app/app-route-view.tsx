"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, Add, ArrowRight2, DocumentCode2, Filter, Refresh, ShieldTick, Warning2 } from "iconsax-react";
import { routeTitles, type AetherRecord, type OperationStep } from "@aether/shared";
import { Badge, Button, Card, ChainValue, CodeBlock, DataTable, Dialog, Drawer, EmptyState, Field, Input, PermissionState, Select, Status, Timeline, ToastRegion } from "@aether/ui";
import { AppShell } from "./app-shell";
import { useDashboard } from "@/features/dashboard/use-dashboard";
import { Onboarding } from "@/features/onboarding/onboarding";

const OperationGraph = dynamic(() => import("@/features/operations/operation-graph"), { ssr: false, loading: () => <div className="a-empty">Loading operation graph…</div> });
const DesiredStateEditor = dynamic(() => import("@/features/desired-state/desired-state-editor"), { ssr: false, loading: () => <div className="a-skeleton" style={{ height: 420 }} /> });

const descriptions: Record<string, string> = {
  overview: "Fresh protocol posture, open risk, active operations, and evidence-backed activity.",
  protocols: "Every protocol environment in Arcadia Labs, with alignment and observation freshness.",
  "protocol-detail": "Operational identity, deployment posture, governance authority, and connected resources.",
  "desired-state": "Versioned approved intent with form/YAML parity, provenance, semantic diff, and impact preview.",
  deployments: "Chain health, release parity, executor funding, provider freshness, and scan coverage.",
  contracts: "Typed contract resources, proxy metadata, ABI provenance, ownership, and current health.",
  drift: "Differences between approved intent and observed state, classified with explicit evidence.",
  incidents: "Related critical findings grouped by root cause, blast radius, and correction status.",
  operations: "Immutable plans from investigation through policy, simulation, approval, execution, and verification.",
  approvals: "Risk-prioritized decisions bound to exact plan revisions, simulations, and expiry.",
  invariants: "Deterministic safety conditions evaluated during observation, planning, execution, and verification.",
  policies: "Versioned deterministic rules for targets, functions, values, chains, approvals, and rollout safety.",
  "keeperhub-runs": "Simulation, workflow, and direct-action evidence from the configured execution adapter.",
  "audit-log": "Append-only attribution across intent, approvals, provider requests, transactions, and verification.",
  integrations: "Provider health, permissions, mode, and last successful interaction—never secret values.",
  team: "Members, protocol roles, invitations, and minimum-scope service accounts.",
  notifications: "Operational alerts routed by severity, protocol, environment, and event type.",
  general: "Organization identity, timezone, retention, and operational defaults.",
  security: "Session controls, stronger authentication, device visibility, and privileged action protection.",
  "api-keys": "Scoped API keys with one-time reveal and visible rotation activity.",
  execution: "Execution mode, approval posture, canary rules, and the explicit mainnet lock.",
};

function routeKey(slug: string[]) {
  if (slug[0] === "protocols" && slug[1] === "new") return "new";
  if (slug[0] === "protocols" && slug.length === 2) return "protocol-detail";
  return slug.at(-1) ?? "overview";
}
function tone(severity?: string) {
  return severity === "critical" || severity === "high" ? "danger" : severity === "medium" ? "warning" : "neutral";
}

export function AppRouteView({ slug }: { slug: string[] }) {
  const key = routeKey(slug);
  if (key === "new") return <Onboarding />;
  return <AppPage route={key} />;
}

function AppPage({ route }: { route: string }) {
  const { data, isLoading, isError, refetch, approval, advance } = useDashboard();
  const [modal, setModal] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState<AetherRecord | null>(null);
  const [step, setStep] = useState<OperationStep | null>(null);
  const [toast, setToast] = useState<string>();
  const title = routeTitles[route] ?? (route === "protocol-detail" ? "Arcadia Markets" : "Overview");
  const records = data?.records[route] ?? (route === "protocol-detail" ? data?.records.protocols : []);
  const readOnly = data?.organization.role === "viewer";
  const primaryLabel = route === "drift" ? "Run investigation" : route === "approvals" ? "Review highest risk" : route === "desired-state" ? "Activate version" : route === "keeperhub-runs" ? "Reconcile run" : route === "audit-log" ? "Export log" : route === "notifications" ? "New rule" : route.startsWith("api") ? "Create key" : `Add ${title.replace(" settings","").replace(/s$/,"").toLowerCase()}`;
  const onPrimary = () => { if (readOnly) return; setModal(true); };
  if (isLoading) return <AppShell title={title}><div className="a-skeleton" style={{ height: 34, width: 230 }} /><div className="metric-grid" style={{ marginTop: 30 }}>{[1,2,3,4].map((item) => <div className="a-card metric-card" key={item}><span className="a-skeleton" style={{ height: 80 }} /></div>)}</div></AppShell>;
  if (isError || !data) return <AppShell title={title}><EmptyState title="Dashboard data is unavailable" description="The typed mock API did not return a valid response. Retry without losing the current organization context." action={<Button variant="primary" onClick={() => void refetch()}>Retry request</Button>} /></AppShell>;
  return (
    <AppShell title={title}>
      <div className="context-strip"><span><i /> Observed 18 seconds ago</span><span>Base Sepolia · block 17,924,118</span><Badge tone="info">MOCK MODE</Badge>{data.realtime !== "connected" ? <Status status={data.realtime} /> : null}</div>
      <div className="page-header"><div><h1>{title}</h1><p>{descriptions[route] ?? descriptions.overview}</p></div><div className="page-actions"><Button onClick={() => void refetch()}><Refresh size={14} /> Refresh</Button><Button variant="primary" disabled={readOnly} onClick={onPrimary}><Add size={14} />{primaryLabel}</Button></div></div>
      {readOnly ? <div style={{ marginBottom: 16 }}><PermissionState action="change protocol state" /></div> : null}
      {route === "overview" ? <Overview data={data} onRecord={setDrawerRecord} /> : route === "desired-state" ? <DesiredState /> : route === "operations" ? <Operations data={data} onStep={setStep} onApproval={() => setModal(true)} onAdvance={() => advance.mutate()} /> : route === "protocol-detail" ? <ProtocolDetail data={data} /> : ["general","security","api-keys","execution"].includes(route) ? <Settings route={route} /> : <RecordPage route={route} records={records ?? []} onRecord={setDrawerRecord} />}
      <ActionModal open={modal} onOpenChange={setModal} route={route} readOnly={readOnly} onApprove={(decision) => approval.mutate(decision, { onSuccess: () => { setModal(false); setToast(decision === "approve" ? "Approval recorded on immutable plan hash." : "Operation rejected and prior approvals invalidated."); window.setTimeout(() => setToast(undefined), 2800); } })} />
      <DetailDrawer record={drawerRecord} onOpenChange={(open) => !open && setDrawerRecord(null)} route={route} />
      <StepDrawer step={step} onOpenChange={(open) => !open && setStep(null)} />
      <ToastRegion message={toast} />
    </AppShell>
  );
}

function Overview({ data, onRecord }: { data: NonNullable<ReturnType<typeof useDashboard>["data"]>; onRecord: (record: AetherRecord) => void }) {
  const protocol = data.protocols[0]!;
  return <><div className="metric-grid">{data.metrics.map((metric) => <Card className="metric-card" key={metric.label}><span className="metric-card__label">{metric.label}</span><strong className="metric-card__value">{metric.value}</strong><span className="metric-card__detail">{metric.detail}</span>{metric.trend ? <span className="metric-card__trend">{metric.trend}</span> : null}</Card>)}</div><div className="dashboard-grid"><div className="panel-stack"><Card className="panel"><div className="panel__head"><h2>Desired / observed alignment</h2><Status status={protocol.status} /></div><div className="panel__body health-ring"><div className="health-ring__visual" style={{ "--health": protocol.health } as React.CSSProperties}><strong>{protocol.health}</strong></div><div><h3>{protocol.health > 90 ? "Protocol is aligned" : "Critical drift requires attention"}</h3><p>{protocol.health > 90 ? "All 39 typed desired-state resources match recent complete observations. Blocking invariants pass across three deployments." : "OracleAdapter on Base differs from approved state. One blocking allowlist invariant and oracle freshness check fail."}</p><Link href="/app/protocols/arcadia/drift"><Button size="sm">Review drift <ArrowRight2 size={13} /></Button></Link></div></div></Card><Card className="panel"><div className="panel__head"><h2>Active operation</h2><Status status={data.operation.status} /></div><div className="panel__body"><Timeline items={data.operation.steps.slice(0,5).map((item) => ({ title: item.label, detail: item.detail, status: item.status }))} /></div></Card></div><div className="panel-stack"><Card className="panel"><div className="panel__head"><h2>Critical findings</h2><Link href="/app/protocols/arcadia/drift">View all</Link></div>{data.records.drift!.length ? <div className="panel__body">{data.records.drift!.map((record) => <button className="command-item" key={record.id} onClick={() => onRecord(record)}><Warning2 size={17} color="#eb5757" /><span style={{ margin: 0 }}><strong className="record-title">{record.title}</strong><span className="record-subtitle" style={{ display: "block" }}>{record.subtitle}</span></span><Badge tone="danger">{record.severity}</Badge></button>)}</div> : <EmptyState title="No active drift" description="Recent complete observations match all 39 desired-state resources." />}</Card><Card className="panel"><div className="panel__head"><h2>Deployment parity</h2><Badge tone="success">3 chains</Badge></div><div className="panel__body"><Timeline items={data.records.deployments!.map((item) => ({ title: item.title, detail: `${item.value} · ${item.meta}`, status: item.status }))} /></div></Card></div></div></>;
}

function DesiredState() {
  return <div className="dashboard-grid"><div><DesiredStateEditor /></div><div className="panel-stack"><Card className="panel"><div className="panel__head"><h2>Version provenance</h2><Badge tone="success">Active</Badge></div><div className="panel__body"><Timeline items={[{ title:"v2.4.1 activated",detail:"GitHub PR #482 · Mina Chen",status:"resolved"},{ title:"Policy approved",detail:"2-of-3 security review",status:"resolved"},{ title:"Impact preview",detail:"0 new drift · 1 expected resolution",status:"healthy" }]} /></div></Card><Card className="panel"><div className="panel__head"><h2>Chain overrides</h2></div><div className="panel__body"><CodeBlock code={"ethereum:\n  heartbeat: 1800\nbase:\n  heartbeat: 900\narbitrum:\n  heartbeat: 1200"} /></div></Card></div></div>;
}

function Operations({ data, onStep, onApproval, onAdvance }: { data: NonNullable<ReturnType<typeof useDashboard>["data"]>; onStep: (step: OperationStep) => void; onApproval: () => void; onAdvance: () => void }) {
  return <Card className="panel"><div className="operation-header"><div><h3>{data.operation.title}</h3><p>Immutable plan v2 · <span className="mono">{data.operation.planHash}</span></p></div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><Status status={data.operation.status} />{data.operation.status === "awaiting_approval" ? <Button variant="primary" size="sm" onClick={onApproval}>Review approval</Button> : data.scenario === "unauthorized-oracle" && data.operation.status !== "resolved" ? <Button variant="primary" size="sm" onClick={onAdvance}>Advance mock run</Button> : null}</div></div><div className="operation-graph-wrap"><OperationGraph steps={data.operation.steps} onSelect={onStep} /></div><div className="operation-stepper"><Timeline items={data.operation.steps.map((item) => ({ title: item.label, detail: item.detail, status: item.status }))} /></div><div className="panel__body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}><Card className="metric-card"><span className="metric-card__label">Policy evaluation</span><strong className="metric-card__value" style={{ fontSize: 18 }}>Allowed with approvals</strong><span className="metric-card__detail">Target and selector allowlisted · 2 reviewers</span></Card><Card className="metric-card"><span className="metric-card__label">Exact simulation</span><strong className="metric-card__value" style={{ fontSize: 18 }}>182,440 gas</strong><span className="metric-card__detail">No storage collisions · all preconditions pass</span></Card><Card className="metric-card"><span className="metric-card__label">Verification</span><strong className="metric-card__value" style={{ fontSize: 18 }}>{data.operation.status === "resolved" ? "Converged" : "Pending"}</strong><span className="metric-card__detail">Independent RPC · storage + event + freshness</span></Card></div></Card>;
}

function ProtocolDetail({ data }: { data: NonNullable<ReturnType<typeof useDashboard>["data"]> }) {
  const protocol = data.protocols[0]!;
  return <div className="panel-stack"><Card className="panel"><div className="panel__body"><div className="health-ring"><div className="health-ring__visual" style={{ "--health": protocol.health } as React.CSSProperties}><strong>{protocol.health}</strong></div><div><div className="eyebrow">Production · v2.4.1</div><h3>Arcadia Markets</h3><p>Repository {protocol.repository} · governance {protocol.governance} · last observed block 17,924,118.</p><div className="integration-strip"><span>Base</span><span>Ethereum</span><span>Arbitrum</span></div></div></div></div></Card><div className="metric-grid">{[["Deployments","3","Release parity confirmed"],["Contracts","39","13 monitored resources"],["Open drift",String(protocol.openDrift),"Critical and expected"],["Operations","1","Canary verification"]].map(([label,value,detail]) => <Card className="metric-card" key={label}><span className="metric-card__label">{label}</span><strong className="metric-card__value">{value}</strong><span className="metric-card__detail">{detail}</span></Card>)}</div></div>;
}

function RecordPage({ route, records, onRecord }: { route: string; records: AetherRecord[]; onRecord: (record: AetherRecord) => void }) {
  const emptyCopy = route === "drift" ? ["No drift matches this view","Complete observations align with approved desired state."] : ["No records yet",`Aether will show ${route.replaceAll("-"," ")} here when available.`];
  const tableRows = useMemo(() => records.map((record) => ({ id: record.id, Resource: <div><div className="record-title">{record.title}</div><div className="record-subtitle">{record.subtitle}</div></div>, Status: <Status status={record.status} />, Severity: record.severity ? <Badge tone={tone(record.severity)}>{record.severity}</Badge> : <span className="record-meta">—</span>, Value: <span className="record-value">{record.value ?? "—"}</span>, Evidence: <span className="record-meta">{record.meta ?? "—"}</span> })), [records]);
  return <Card className="panel"><div className="panel__head"><h2>{route.replaceAll("-"," ")}</h2><span className="record-meta">{records.length} records</span></div><div className="panel__body" style={{ paddingBottom: 0 }}><div className="filters"><Input placeholder={`Filter ${route.replaceAll("-"," ")}…`} aria-label={`Filter ${route}`} /><Select aria-label="Filter status" defaultValue="all"><option value="all">All statuses</option><option>Open</option><option>Healthy</option><option>Failed</option></Select><Button size="sm"><Filter size={13} /> Filters</Button></div></div>{records.length ? <><div className="desktop-table"><DataTable caption={`${route} records`} columns={["Resource","Status","Severity","Value","Evidence"]} rows={tableRows} onRowClick={(index) => onRecord(records[index]!)} /></div><div className="responsive-cards">{records.map((record) => <button className="record-card a-card" key={record.id} onClick={() => onRecord(record)}><div className="record-card__row"><span className="record-title">{record.title}</span><Status status={record.status} /></div><span className="record-subtitle">{record.subtitle}</span><div className="record-card__row"><span className="record-value">{record.value}</span>{record.severity ? <Badge tone={tone(record.severity)}>{record.severity}</Badge> : null}</div></button>)}</div></> : <EmptyState title={emptyCopy[0]!} description={emptyCopy[1]!} action={<Button variant="primary">Configure {route.replaceAll("-"," ")}</Button>} />}</Card>;
}

function Settings({ route }: { route: string }) {
  return <div className="settings-layout"><Card className="settings-nav">{[["General","general"],["Security","security"],["API keys","api-keys"],["Execution","execution"]].map(([label,key]) => <Link href={`/app/settings/${key}`} key={key}>{label}</Link>)}</Card><form className="settings-form a-card" onSubmit={(event) => event.preventDefault()}>{route === "general" ? <><Field label="Organization name"><Input defaultValue="Arcadia Labs" /></Field><Field label="Display timezone"><Select defaultValue="Africa/Lagos"><option>Africa/Lagos</option><option>UTC</option></Select></Field><Field label="Audit retention"><Select defaultValue="indefinite"><option value="indefinite">Indefinite core audit history</option><option>7 years</option></Select></Field></> : route === "security" ? <><Field label="Approval authentication"><Select defaultValue="strong"><option value="strong">Require recent MFA for critical approvals</option></Select></Field><div className="a-callout"><ShieldTick size={18} /><div><strong>3 active sessions</strong><p>MacBook Pro · Lagos · current session; two trusted review devices.</p></div></div></> : route === "api-keys" ? <><div className="a-callout"><Warning2 size={18} /><div><strong>Secrets are shown once</strong><p>Aether stores only a hash and never shows full API key values after creation.</p></div></div><DataTable caption="API keys" columns={["Name","Scope","Last used"]} rows={[{ id:"ci",Name:"deployment-checks",Scope:"protocols:read", "Last used":"18 minutes ago" }]} /></> : <><Field label="Execution mode"><Select defaultValue="approval"><option value="read">Read only</option><option value="approval">Plan and require approval</option><option value="bounded">Allow low-risk automation</option></Select></Field><div className="a-callout a-callout--danger"><Warning2 size={18} /><div><strong>Mainnet lock enabled</strong><p>Live mainnet execution cannot be enabled from the browser or mock mode.</p></div></div><Field label="Canary observation window"><Input defaultValue="30 minutes" /></Field></>}<Button variant="primary" type="submit">Save settings</Button></form></div>;
}

function ActionModal({ open, onOpenChange, route, readOnly, onApprove }: { open: boolean; onOpenChange: (open: boolean) => void; route: string; readOnly: boolean; onApprove: (decision: "approve" | "reject") => void }) {
  const approval = route === "approvals" || route === "operations";
  return <Dialog open={open} onOpenChange={onOpenChange} title={approval ? "Review immutable plan approval" : `${route === "drift" ? "Start investigation" : "Configure " + route.replaceAll("-"," ")}`} description={approval ? "Your decision binds to plan v2 and hash 0xa41d92c09fb4…8e77." : "This mock mutation follows the typed API contract and updates query state."}>{readOnly ? <PermissionState action="submit this action" /> : <div className="form-stack">{approval ? <><div className="a-callout"><DocumentCode2 size={18} /><div><strong>Restore approved OracleAdapter</strong><p>Before: 0x6F2B…E912 · After: 0x2C8A…44311 · simulated gas 182,440.</p></div></div><Field label="Approval rationale"><Input placeholder="State why this plan is safe to execute" /></Field><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Button variant="danger" onClick={() => onApprove("reject")}>Reject</Button><Button variant="primary" onClick={() => onApprove("approve")}>Approve plan v2</Button></div></> : <><Field label="Name or objective"><Input placeholder={`Describe ${route.replaceAll("-"," ")}`} /></Field>{route === "protocols" ? <div className="choice-grid"><button className="choice-card is-selected"><h3>GitHub import wizard</h3><p>Discover deployments and ABIs for review.</p></button><button className="choice-card"><h3>Manual configuration</h3><p>Add networks and contracts safely.</p></button></div> : <Field label="Scope"><Select><option>Arcadia Markets · Production</option><option>All protocols</option></Select></Field>}<Button variant="primary" onClick={() => onOpenChange(false)}>Save mock configuration</Button></>}</div>}</Dialog>;
}

function DetailDrawer({ record, onOpenChange, route }: { record: AetherRecord | null; onOpenChange: (open: boolean) => void; route: string }) {
  if (!record) return null;
  return <Drawer open={Boolean(record)} onOpenChange={onOpenChange} title={record.title} description={`${route.replaceAll("-"," ")} detail · deep link ${record.id}`}><div className="context-strip"><Status status={record.status} />{record.severity ? <Badge tone={tone(record.severity)}>{record.severity}</Badge> : null}</div><Card className="panel"><div className="panel__head"><h2>Current evidence</h2></div><div className="panel__body panel-stack"><div><span className="record-meta">Resource</span><p>{record.subtitle}</p></div><div><span className="record-meta">Observed value</span><p className="mono">{record.value}</p></div><div><span className="record-meta">Provider evidence</span><p>{record.meta}</p></div>{route === "drift" || route === "incidents" ? <><div className="a-callout a-callout--danger"><Warning2 size={18} /><div><strong>AI investigation hypothesis · 94% confidence</strong><p>The oracle was changed by an unrecognized operator. No matching GitHub release, governance proposal, Safe transaction, or prior Aether operation exists.</p></div></div><ChainValue value="0x7f92cdd4b9c61bb4729083f6c2db11a4d535acc05372a8cc66dd1e485944ac12" kind="transaction" href="https://sepolia.etherscan.io" /></> : null}</div></Card><h3 style={{ color: "var(--paper)", fontWeight: 500 }}>Audit timeline</h3><Timeline items={[{title:"Observation captured",detail:"Block 17,924,118 · complete snapshot",status:"resolved"},{title:"Evidence correlated",detail:"Transaction, sender, calldata, and events decoded",status:"resolved"},{title:"Current state",detail:record.status,status:record.status}]} /></Drawer>;
}

function StepDrawer({ step, onOpenChange }: { step: OperationStep | null; onOpenChange: (open: boolean) => void }) {
  if (!step) return null;
  return <Drawer open={Boolean(step)} onOpenChange={onOpenChange} title={step.label} description={`${step.type} step · immutable plan v2`}><Status status={step.status} /><div className="settings-form a-card" style={{ marginTop: 16 }}><p>{step.detail}</p><Field label="Normalized input"><CodeBlock language="json" code={'{\n  "chainId": 84532,\n  "target": "0x2C8A...44311",\n  "function": "setOracle(address)",\n  "value": "0"\n}'} /></Field><div className="a-callout"><Activity size={18} /><div><strong>Idempotency intent persisted</strong><p>op-oracle:plan-v2:{step.id}:attempt-1</p></div></div></div></Drawer>;
}
