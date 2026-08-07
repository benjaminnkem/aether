"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { aetherClient, getAetherErrorMessage } from "@aether/sdk";
import {
  Activity,
  Add,
  ArrowRight2,
  CloudConnection,
  Code,
  DocumentCode2,
  HierarchySquare2,
  Link1,
  Refresh,
  ShieldTick,
  TickCircle,
  Warning2,
} from "iconsax-react";
import {
  activeLiveChain,
  type AetherRecord,
  type Dashboard,
} from "@aether/shared";
import {
  Badge,
  Button,
  ChainValue,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Status,
  TabContent,
  Tabs,
} from "@aether/ui";
import { useRefreshDashboard } from "@/features/dashboard/use-refresh-dashboard";

const DESCRIPTION =
  "Configure identity, observation targets, provenance, and the KeeperHub execution boundary.";

const TAB_VALUES = [
  "general",
  "networks",
  "contracts",
  "github",
  "keeperhub",
] as const;

type SetupTab = (typeof TAB_VALUES)[number];

function isHealthyStatus(status?: string) {
  return ["healthy", "resolved", "completed", "connected"].includes(
    status ?? "",
  );
}

function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function explorerAddressUrl(address: string) {
  if (!activeLiveChain.explorerUrl || !isAddress(address)) return undefined;
  return `${activeLiveChain.explorerUrl}/address/${address}`;
}

type SetupSection = {
  value: SetupTab;
  label: string;
  detail: string;
  status: string;
};

function nextIncomplete(tabs: SetupSection[]) {
  return tabs.find((item) => !isHealthyStatus(item.status));
}

export function ProtocolSetup({ data }: { data: Dashboard }) {
  const searchParams = useSearchParams();
  const refreshDashboard = useRefreshDashboard();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<SetupTab>(
    requestedTab && (TAB_VALUES as readonly string[]).includes(requestedTab)
      ? (requestedTab as SetupTab)
      : "general",
  );
  const [dialog, setDialog] = useState<"network" | "contract" | null>(null);
  const [contractName, setContractName] = useState("ArcadiaMarket");
  const [contractAddress, setContractAddress] = useState("");
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

  useEffect(() => {
    setProtocolName(protocol.name);
    setGovernance(protocol.governance);
  }, [protocol.name, protocol.governance]);

  const tabs = useMemo(
    () =>
      [
        {
          value: "general" as const,
          label: "General",
          detail: "Identity & governance",
          status: protocol.name && protocol.governance ? "healthy" : "warning",
        },
        {
          value: "networks" as const,
          label: "Networks",
          detail: "Sepolia observation",
          status: networks.length ? "healthy" : "warning",
        },
        {
          value: "contracts" as const,
          label: "Contracts",
          detail: "Targets & evidence",
          status: contracts.length ? "healthy" : "warning",
        },
        {
          value: "github" as const,
          label: "GitHub",
          detail: "Release provenance",
          status: githubConnection?.status ?? "warning",
        },
        {
          value: "keeperhub" as const,
          label: "KeeperHub",
          detail: "Execution readiness",
          status: keeperhubConnection?.status ?? "warning",
        },
      ] satisfies SetupSection[],
    [
      contracts.length,
      githubConnection?.status,
      keeperhubConnection?.status,
      networks.length,
      protocol.governance,
      protocol.name,
    ],
  );

  const readyCount = tabs.filter((item) => isHealthyStatus(item.status)).length;
  const readinessPct = Math.round((readyCount / tabs.length) * 100);
  const incomplete = nextIncomplete(tabs);
  const allReady = !incomplete;

  const generalDirty =
    protocolName.trim() !== protocol.name ||
    governance.trim() !== protocol.governance;
  const generalValid =
    protocolName.trim().length >= 2 && governance.trim().length >= 2;

  const selectTab = (value: string) => {
    if (!(TAB_VALUES as readonly string[]).includes(value)) return;
    setTab(value as SetupTab);
    window.history.replaceState({}, "", `/app/protocol-setup?tab=${value}`);
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Protocol Setup</h1>
          <p>{DESCRIPTION}</p>
        </div>
        <div className="page-actions">
          {incomplete ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => selectTab(incomplete.value)}
            >
              Continue setup <ArrowRight2 size={14} aria-hidden="true" />
            </Button>
          ) : (
            <Link href="/app/desired-state">
              <Button variant="secondary">
                Open desired state <ArrowRight2 size={14} aria-hidden="true" />
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="context-strip">
        <span>
          <i /> {protocol.name}
        </span>
        <Badge>{protocol.environment}</Badge>
        <Status status={protocol.status} />
        <span className="mono">{activeLiveChain.displayName}</span>
      </div>

      <section
        className={
          allReady
            ? "setup-readiness a-card is-complete"
            : "setup-readiness a-card"
        }
        aria-label="Protocol setup readiness"
      >
        <div className="setup-readiness__summary">
          <span className="visual-kicker">Configuration readiness</span>
          <strong>
            {readyCount}/{tabs.length} sections ready
          </strong>
          <p>
            {allReady
              ? "Observation targets and execution boundary are configured. Pin desired state next."
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
          {incomplete ? (
            <div className="setup-next-step" role="status">
              <div>
                <strong>Next: {incomplete.label}</strong>
                <span>{incomplete.detail}</span>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => selectTab(incomplete.value)}
              >
                Go to section <ArrowRight2 size={14} aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <div
              className="setup-next-step setup-next-step--done"
              role="status"
            >
              <div>
                <strong>Setup complete</strong>
                <span>
                  Publish desired state, then run an observation scan from
                  Drift.
                </span>
              </div>
              <Link href="/app/desired-state">
                <Button size="sm" variant="primary">
                  Desired state <ArrowRight2 size={14} aria-hidden="true" />
                </Button>
              </Link>
            </div>
          )}
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
                      : ready
                        ? "setup-readiness__step is-ready"
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
                <div className="setup-panel-head-meta">
                  {generalDirty ? (
                    <Badge tone="warning">Unsaved changes</Badge>
                  ) : null}
                  <Status
                    status={
                      protocol.name && protocol.governance
                        ? "healthy"
                        : "warning"
                    }
                  />
                </div>
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
                    autoComplete="off"
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
                  autoComplete="off"
                />
              </Field>
              {isAddress(governance) ? (
                <ChainValue
                  value={governance.trim()}
                  href={explorerAddressUrl(governance)}
                />
              ) : null}
              <div className="setup-actions setup-actions--sticky">
                <Button
                  variant="primary"
                  disabled={
                    setupMutation.isPending || !generalDirty || !generalValid
                  }
                  onClick={() =>
                    setupMutation.mutate({
                      section: "general",
                      input: {
                        name: protocolName.trim(),
                        environment: protocol.environment,
                        governanceAuthority: governance.trim(),
                      },
                    })
                  }
                >
                  {setupMutation.isPending ? "Saving…" : "Save settings"}
                </Button>
                {generalDirty ? (
                  <Button
                    variant="ghost"
                    disabled={setupMutation.isPending}
                    onClick={() => {
                      setProtocolName(protocol.name);
                      setGovernance(protocol.governance);
                    }}
                  >
                    Discard
                  </Button>
                ) : (
                  <span className="setup-actions__hint muted">
                    No unsaved changes
                  </span>
                )}
              </div>
            </div>
          </TabContent>

          <TabContent className="setup-panel" value="networks">
            <SetupResourcePanel
              kicker="02 · Observation"
              title="Observed networks"
              description="Chains Aether pins for RPC observation, freshness checks, and executor readiness."
              emptyTitle="No networks configured"
              emptyDescription="Add Ethereum Sepolia so Aether can pin observations and verify postconditions."
              records={networks}
              actionLabel="Add network"
              onAction={() => setDialog("network")}
              kind="network"
            />
          </TabContent>

          <TabContent className="setup-panel" value="contracts">
            <SetupResourcePanel
              kicker="03 · Targets"
              title="Observed contracts"
              description="Allowlisted addresses used for drift evaluation and correction planning."
              emptyTitle="No contracts configured"
              emptyDescription="Register the protocol contracts Aether should observe, including proxies."
              records={contracts}
              actionLabel="Add contract"
              onAction={() => setDialog("contract")}
              kind="contract"
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
            setContractAddress("");
            setContractName("ArcadiaMarket");
          }
        }}
        title={dialog === "network" ? "Add network" : "Add contract"}
        description="The API validates and persists this resource for the selected protocol."
      >
        <div className="form-stack">
          {dialog === "network" ? (
            <>
              <Field label="Display name">
                <Input value={activeLiveChain.displayName} readOnly />
              </Field>
              <Field
                label="Chain ID"
                hint="Only the active live chain is accepted."
              >
                <Input value={String(activeLiveChain.chainId)} readOnly />
              </Field>
              <div className="setup-info-tile setup-info-tile--inline">
                <HierarchySquare2 size={18} aria-hidden="true" />
                <div>
                  <strong>{activeLiveChain.displayName}</strong>
                  <span>
                    Testnet · {activeLiveChain.nativeCurrency} · finality{" "}
                    {activeLiveChain.defaultFinalityConfirmations} blocks
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <Field
                label="Contract name"
                hint="Human label for tables, audit, and desired-state binding."
              >
                <Input
                  value={contractName}
                  onChange={(event) => setContractName(event.target.value)}
                  placeholder="ArcadiaMarket"
                  autoComplete="off"
                />
              </Field>
              <Field
                label="Contract address"
                hint={`${activeLiveChain.displayName} proxy or implementation address.`}
              >
                <Input
                  value={contractAddress}
                  onChange={(event) => setContractAddress(event.target.value)}
                  placeholder="0x…"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              {isAddress(contractAddress) ? (
                <ChainValue
                  value={contractAddress.trim()}
                  href={explorerAddressUrl(contractAddress)}
                />
              ) : contractAddress.trim() ? (
                <p className="field-error" role="status">
                  Enter a 20-byte 0x-prefixed address.
                </p>
              ) : null}
            </>
          )}
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
              (dialog === "contract" &&
                (!contractName.trim() || !isAddress(contractAddress)))
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
                    : {
                        address: contractAddress.trim(),
                        name: contractName.trim() || "Contract resource",
                      },
              });
              setDialog(null);
              setContractAddress("");
              setContractName("ArcadiaMarket");
            }}
          >
            {setupMutation.isPending ? "Validating…" : "Validate and add"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function SetupResourcePanel({
  kicker,
  title,
  description,
  emptyTitle,
  emptyDescription,
  records,
  actionLabel,
  onAction,
  kind,
}: {
  kicker: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  records: AetherRecord[];
  actionLabel: string;
  onAction: () => void;
  kind: "network" | "contract";
}) {
  return (
    <section className="panel a-card setup-resource-panel">
      <div className="panel__head setup-resource-panel__head">
        <div>
          <span className="visual-kicker">{kicker}</span>
          <h2 className="setup-resource-title">
            <span>{title}</span>
            {records.length ? <Badge>{records.length}</Badge> : null}
          </h2>
          <p>{description}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onAction}>
          <Add size={14} aria-hidden="true" /> {actionLabel}
        </Button>
      </div>
      <div className="panel__body">
        {records.length ? (
          <>
            <ul className="setup-resource-grid" aria-label={title}>
              {records.map((item) => (
                <li key={item.id} className="setup-resource-card">
                  <div className="setup-resource-card__icon" aria-hidden="true">
                    {kind === "network" ? (
                      <HierarchySquare2 size={18} />
                    ) : (
                      <DocumentCode2 size={18} />
                    )}
                  </div>
                  <div className="setup-resource-card__body">
                    <div className="setup-resource-card__title-row">
                      <strong>{item.title}</strong>
                      <Status status={item.status} />
                    </div>
                    <span className="record-subtitle">
                      {item.subtitle ?? "Persisted resource"}
                    </span>
                    {item.value ? (
                      kind === "contract" && isAddress(item.value) ? (
                        <ChainValue
                          value={item.value}
                          href={explorerAddressUrl(item.value)}
                        />
                      ) : (
                        <code className="evidence-value">{item.value}</code>
                      )
                    ) : (
                      <span className="muted">Value pending</span>
                    )}
                    {item.meta ? (
                      <div className="evidence-cluster">
                        {item.meta.split(" · ").map((detail) => (
                          <span className="evidence-chip" key={detail}>
                            <ShieldTick size={13} aria-hidden="true" /> {detail}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className="setup-resource-table">
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
                    kind === "contract" && isAddress(item.value) ? (
                      <ChainValue
                        value={item.value}
                        href={explorerAddressUrl(item.value)}
                      />
                    ) : (
                      <code className="evidence-value">{item.value}</code>
                    )
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
            </div>
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

function GitHubConnectionPanel({ record }: { record?: AetherRecord }) {
  const refreshDashboard = useRefreshDashboard();
  const [repository, setRepository] = useState("");
  const [desiredStatePath, setDesiredStatePath] = useState(
    "aether/desired-state.yaml",
  );
  const connected = isHealthyStatus(record?.status);
  const repositories = useQuery({
    queryKey: ["github", "repositories"],
    queryFn: () => aetherClient.getGitHubRepositories(),
    enabled: connected,
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
      <div
        className={
          connected ? "connection-identity is-live" : "connection-identity"
        }
      >
        <div className="connection-logo" aria-hidden="true">
          <Code size={20} />
        </div>
        <div>
          <strong>{record?.meta ?? "No installation connected"}</strong>
          <span>
            {record?.subtitle ?? "Install the Aether GitHub App to continue."}
          </span>
        </div>
        {connected ? (
          <span className="connection-pulse" aria-hidden="true" />
        ) : null}
      </div>

      {connected ? (
        <>
          {repositories.isLoading ? (
            <div
              className="a-skeleton setup-skeleton"
              aria-label="Loading repositories"
            />
          ) : null}
          {repositories.isError ? (
            <div className="a-callout a-callout--danger" role="alert">
              <Warning2 size={18} aria-hidden="true" />
              <div>
                <strong>Repository access failed</strong>
                <p>
                  The installation cannot read any repositories. Confirm
                  Contents is read-only and the target repository is selected on
                  the GitHub App.
                </p>
              </div>
            </div>
          ) : null}
          {!repositories.isLoading &&
          !repositories.isError &&
          !(repositories.data?.length ?? 0) ? (
            <EmptyState
              title="No repositories visible"
              description="The installation is healthy but returned an empty repository list. Grant access to the protocol repository in GitHub."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void repositories.refetch()}
                >
                  <Refresh size={14} aria-hidden="true" /> Retry
                </Button>
              }
            />
          ) : null}
          {(repositories.data?.length ?? 0) > 0 ? (
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
                  <Input
                    readOnly
                    value={selected?.default_branch ?? "Loading…"}
                  />
                </Field>
              </div>
              <Field
                label="Desired-state path"
                hint="Repository-relative path read by Aether as provenance evidence."
              >
                <Input
                  value={desiredStatePath}
                  onChange={(event) => setDesiredStatePath(event.target.value)}
                  spellCheck={false}
                />
              </Field>
              {selected ? (
                <p
                  className="setup-path-preview mono"
                  aria-label="Provenance path"
                >
                  {selected.full_name}
                  <span>/</span>
                  {selected.default_branch}
                  <span>:</span>
                  {desiredStatePath || "…"}
                </p>
              ) : null}
              <div className="setup-actions">
                <Button
                  variant="primary"
                  disabled={
                    !selected || save.isPending || !desiredStatePath.trim()
                  }
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? "Saving…" : "Save provenance source"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={repositories.isFetching}
                  onClick={() => void repositories.refetch()}
                >
                  <Refresh size={14} aria-hidden="true" /> Refresh repos
                </Button>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div className="setup-actions">
          <Button
            variant="primary"
            disabled={install.isPending}
            onClick={() => install.mutate()}
          >
            <Link1 size={16} aria-hidden="true" />
            {install.isPending ? "Opening GitHub…" : "Install GitHub App"}
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
  const signals = (record?.meta ?? "")
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);

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
      <div
        className={
          ready ? "connection-identity is-live" : "connection-identity"
        }
      >
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

      {signals.length ? (
        <ul
          className="setup-signal-list"
          aria-label="KeeperHub readiness signals"
        >
          {signals.map((signal) => (
            <li key={signal}>
              <TickCircle size={15} variant="Bold" aria-hidden="true" />
              <span>{signal}</span>
            </li>
          ))}
        </ul>
      ) : null}

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
            KeeperHub signs only allowlisted corrections after bound simulation
            and approval. OpenAI never authorizes transactions.
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
        {ready ? (
          <span className="setup-actions__hint muted">
            Adapter ready for simulation and direct execution
          </span>
        ) : (
          <span className="setup-actions__hint muted">
            Validation uses live credentials and fails closed
          </span>
        )}
      </div>
    </div>
  );
}

export default ProtocolSetup;
