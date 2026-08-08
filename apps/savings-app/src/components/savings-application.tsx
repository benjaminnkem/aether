"use client";

import { useCallback, useEffect, useState } from "react";

type RecordValue = Record<string, unknown>;
export type PublicConfiguration = {
  chainId: 11155111;
  chainName: string;
  liveExecutionEnabled: boolean;
  vaultAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  minimumAmount: string;
  maximumAmount: string;
  executorAddress: string;
  explorerUrl: string;
};
export type ActiveRun = {
  runId: string;
  missionId: string;
  viewToken: string;
  operationKey: string;
};

const TERMINAL_STATES = new Set([
  "COMPLETED",
  "RECOVERED",
  "NEEDS_ATTENTION",
  "ABORTED_SAFE",
]);
const apiBase = "/savings-app/api";

export function SavingsApplication() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [config, setConfig] = useState<PublicConfiguration>();
  const [wallet, setWallet] = useState("");
  const [amount, setAmount] = useState("");
  const [activeRun, setActiveRun] = useState<ActiveRun>();
  const [run, setRun] = useState<RecordValue>();
  const [events, setEvents] = useState<RecordValue[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadConfiguration = useCallback(async () => {
    const response = await fetch(`${apiBase}/config`, { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    if (!response.ok) throw await responseError(response);
    setAuthenticated(true);
    setConfig((await response.json()) as PublicConfiguration);
  }, []);

  useEffect(() => {
    void loadConfiguration().catch((error: unknown) => {
      setAuthenticated(false);
      setMessage(errorMessage(error));
    });
  }, [loadConfiguration]);

  const refreshRun = useCallback(async () => {
    if (!activeRun) return;
    const response = await fetch(
      `${apiBase}/runs/${encodeURIComponent(activeRun.runId)}`,
      {
        headers: { "X-Savings-Run-Token": activeRun.viewToken },
        cache: "no-store",
      },
    );
    if (!response.ok) throw await responseError(response);
    setRun((await response.json()) as RecordValue);
  }, [activeRun]);

  useEffect(() => {
    if (!activeRun) return;
    const controller = new AbortController();
    let cursor = 0;
    const receive = (event: RecordValue) => {
      const sequence = typeof event.sequence === "number" ? event.sequence : 0;
      cursor = Math.max(cursor, sequence);
      setEvents((current) =>
        [
          ...current.filter((item) => item.eventId !== event.eventId),
          event,
        ].sort(bySequence),
      );
      void refreshRun();
    };
    void streamEvents(
      activeRun,
      () => cursor,
      receive,
      controller.signal,
    ).catch((error: unknown) => {
      if (!controller.signal.aborted)
        setMessage(
          `Live stream disconnected. Snapshot polling remains active. ${errorMessage(error)}`,
        );
    });
    const poll = window.setInterval(
      () => void refreshRun().catch(() => undefined),
      5000,
    );
    void refreshRun();
    return () => {
      controller.abort();
      window.clearInterval(poll);
    };
  }, [activeRun, refreshRun]);

  if (authenticated === null) return <LoadingScreen />;
  if (!authenticated) {
    return (
      <AccessScreen
        message={message}
        onAuthenticated={() => {
          setMessage("");
          void loadConfiguration();
        }}
      />
    );
  }
  if (!config) return <LoadingScreen />;

  const terminal = TERMINAL_STATES.has(String(run?.state));
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/savings-app" aria-label="Savings home">
          SAVINGS / AETHER
        </a>
        <div className="topbar-meta">
          <span className="network-dot" aria-hidden="true" />
          <span>Sepolia</span>
          <button
            className="text-button"
            type="button"
            onClick={() => void logout().then(() => window.location.reload())}
          >
            Lock app
          </button>
        </div>
      </header>
      <main id="main-content">
        {!activeRun ? (
          <SetupView
            config={config}
            wallet={wallet}
            amount={amount}
            busy={busy}
            message={message}
            onAmount={setAmount}
            onConnect={async () => {
              setBusy(true);
              setMessage("");
              try {
                setWallet(await connectAndVerifyWallet());
              } catch (error) {
                setMessage(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
            onSubmit={async () => {
              setBusy(true);
              setMessage(
                "Creating an immutable mission and starting preflight…",
              );
              try {
                const response = await jsonRequest<ActiveRun>(
                  `${apiBase}/runs`,
                  {
                    method: "POST",
                    body: JSON.stringify({
                      amount,
                      clientRequestId: crypto.randomUUID(),
                    }),
                  },
                );
                sessionStorage.setItem(
                  `savings:run:${response.runId}`,
                  response.viewToken,
                );
                setEvents([]);
                setRun(undefined);
                setActiveRun(response);
                setMessage("");
              } catch (error) {
                setMessage(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          <FlightRecorder
            config={config}
            activeRun={activeRun}
            run={run}
            events={events}
            message={message}
            onNew={
              terminal
                ? () => {
                    setActiveRun(undefined);
                    setRun(undefined);
                    setEvents([]);
                    setAmount("");
                    setMessage("");
                  }
                : undefined
            }
          />
        )}
      </main>
    </div>
  );
}

function AccessScreen({
  message,
  onAuthenticated,
}: {
  message: string;
  onAuthenticated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState("");
  return (
    <main id="main-content" className="access-layout">
      <section className="access-copy">
        <p className="eyebrow">External application</p>
        <h1>PUT SAVINGS ON RECORD.</h1>
        <p>
          This application creates real Sepolia missions through Aether’s public
          API. It never receives a wallet private key and never invents
          transaction evidence.
        </p>
      </section>
      <form
        className="access-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const accessToken = String(
            new FormData(event.currentTarget).get("accessToken") ?? "",
          );
          try {
            setLocalMessage("");
            await jsonRequest(`${apiBase}/session`, {
              method: "POST",
              body: JSON.stringify({ accessToken }),
            });
            onAuthenticated();
          } catch (error) {
            setLocalMessage(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="eyebrow">Restricted access</p>
        <h2>Open Savings</h2>
        <label htmlFor="access-token">Application access code</label>
        <input
          id="access-token"
          name="accessToken"
          type="password"
          autoComplete="current-password"
          required
        />
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? "Checking…" : "Continue"}
        </button>
        <p className="form-message" role="status" aria-live="polite">
          {localMessage || message}
        </p>
      </form>
    </main>
  );
}

function SetupView(props: {
  config: PublicConfiguration;
  wallet: string;
  amount: string;
  busy: boolean;
  message: string;
  onAmount: (value: string) => void;
  onConnect: () => Promise<void>;
  onSubmit: () => Promise<void>;
}) {
  const {
    config,
    wallet,
    amount,
    busy,
    message,
    onAmount,
    onConnect,
    onSubmit,
  } = props;
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Real Sepolia execution</p>
        <h1>SAVE WITH A COMPLETE RECORD.</h1>
        <p className="hero-copy">
          Connect the beneficiary wallet, review the fixed contracts and amount,
          then let Aether create, execute, verify, and receipt the mission.
        </p>
      </section>
      <section className="workspace">
        <div className="workflow-column">
          <div className="section-heading">
            <span>01</span>
            <div>
              <h2>Beneficiary</h2>
              <p>The connected address owns the recorded savings balance.</p>
            </div>
          </div>
          {wallet ? (
            <AddressRow
              label="Verified wallet"
              value={wallet}
              explorer={`${config.explorerUrl}/address/${wallet}`}
            />
          ) : (
            <button
              className="button button-primary"
              type="button"
              onClick={() => void onConnect()}
              disabled={busy}
            >
              {busy ? "Waiting for wallet…" : "Connect and verify wallet"}
            </button>
          )}

          <div className="section-heading section-offset">
            <span>02</span>
            <div>
              <h2>Amount</h2>
              <p>Amounts are converted to integer token units on the server.</p>
            </div>
          </div>
          <label className="amount-field">
            <span>Amount to save</span>
            <div>
              <input
                value={amount}
                onChange={(event) => onAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                disabled={!wallet || busy}
              />
              <strong>{config.tokenSymbol}</strong>
            </div>
            <small>
              Allowed: {config.minimumAmount}–{config.maximumAmount}{" "}
              {config.tokenSymbol}
            </small>
          </label>
        </div>
        <aside className="review-panel" aria-labelledby="review-title">
          <p className="eyebrow">Exact execution boundary</p>
          <h2 id="review-title">Review mission</h2>
          <dl className="review-list">
            <Fact label="Network" value={config.chainName} />
            <Fact
              label="Source executor"
              value={short(config.executorAddress)}
              mono
            />
            <Fact
              label="Token contract"
              value={short(config.tokenAddress)}
              mono
            />
            <Fact
              label="Savings vault"
              value={short(config.vaultAddress)}
              mono
            />
            <Fact
              label="Beneficiary"
              value={wallet ? short(wallet) : "Connect wallet"}
              mono={Boolean(wallet)}
            />
            <Fact
              label="Amount"
              value={
                amount ? `${amount} ${config.tokenSymbol}` : "Enter amount"
              }
            />
            <Fact label="Writes" value="Approve exact amount → deposit" />
            <Fact label="Known failure" value="Revoke unused approval" />
            <Fact
              label="Uncertain outcome"
              value="Retry locked until reconciled"
            />
          </dl>
          {!config.liveExecutionEnabled && (
            <div className="notice notice-danger">
              <strong>Live execution disabled</strong>
              <span>
                No mission or transaction can be created until the server flag
                is enabled.
              </span>
            </div>
          )}
          <button
            className="button button-primary full-width"
            type="button"
            disabled={
              !wallet || !amount || busy || !config.liveExecutionEnabled
            }
            onClick={() => void onSubmit()}
          >
            {busy ? "Starting mission…" : "Confirm and save"}
          </button>
          <p className="form-message" role="status" aria-live="polite">
            {message}
          </p>
        </aside>
      </section>
      <ContractStrip config={config} />
    </>
  );
}

export function FlightRecorder(props: {
  config: PublicConfiguration;
  activeRun: ActiveRun;
  run?: RecordValue;
  events: RecordValue[];
  message: string;
  onNew?: () => void;
}) {
  const { config, activeRun, run, events, message, onNew } = props;
  const steps = records(run?.steps);
  const plans = records(run?.plans);
  const simulations = records(run?.simulations);
  const attempts = records(run?.attempts);
  const observations = records(run?.observations);
  const reconciliation = records(run?.reconciliation);
  const receipt = object(run?.receipt);
  const transactions = transactionRows(run, config.explorerUrl);
  return (
    <div className="recorder-page">
      <header className="recorder-header">
        <div>
          <p className="eyebrow">Live flight recorder</p>
          <h1>{String(run?.state ?? "PREFLIGHT").replaceAll("_", " ")}</h1>
          <p>
            {String(
              run?.stateReason ?? "Waiting for the persisted run snapshot.",
            )}
          </p>
        </div>
        <div className="recorder-actions">
          <Status value={run?.state ?? "PREFLIGHT"} />
          {onNew && (
            <button
              className="button button-primary"
              type="button"
              onClick={onNew}
            >
              New savings mission
            </button>
          )}
        </div>
      </header>

      <section className="identity-grid">
        <Fact label="Run" value={activeRun.runId} mono />
        <Fact label="Mission" value={activeRun.missionId} mono />
        <Fact label="Operation key" value={activeRun.operationKey} mono />
        <Fact label="Network" value="Ethereum Sepolia · 11155111" />
        <Fact label="Created" value={formatDate(run?.createdAt)} />
        <Fact label="Started" value={formatDate(run?.startedAt)} />
        <Fact label="Last updated" value={formatDate(run?.updatedAt)} />
        <Fact
          label="Finished"
          value={run?.terminalAt ? formatDate(run.terminalAt) : "In progress"}
        />
      </section>
      {message && (
        <div className="notice">
          <strong>Connection notice</strong>
          <span>{message}</span>
        </div>
      )}

      <RecorderSection number="01" title="Mission objective">
        <p className="objective">
          {String(run?.objective ?? "Loading the frozen mission objective…")}
        </p>
      </RecorderSection>

      <RecorderSection number="02" title="Steps">
        <div className="step-list">
          {steps.length ? (
            steps.map((step) => (
              <article className="step-row" key={String(step.stepRunId)}>
                <div>
                  <span>{String(step.stepId)}</span>
                  <strong>{String(step.state).replaceAll("_", " ")}</strong>
                </div>
                <dl>
                  <Fact
                    label="Plan"
                    value={step.planId ?? "Not recorded"}
                    mono
                  />
                  <Fact
                    label="Simulation"
                    value={step.simulationRecordId ?? "Not recorded"}
                    mono
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
                <Status value={step.state} />
              </article>
            ))
          ) : (
            <p>Waiting for step records…</p>
          )}
        </div>
      </RecorderSection>

      <RecorderSection number="03" title="KeeperHub execution">
        {attempts.length ? (
          attempts.map((attempt) => (
            <article
              className="evidence-row"
              key={String(attempt.executionAttemptId)}
            >
              <div className="evidence-title">
                <strong>{String(attempt.executionAttemptId)}</strong>
                <Status value={attempt.status} />
              </div>
              <dl className="evidence-grid">
                <Fact
                  label="KeeperHub execution ID"
                  value={attempt.keeperHubExecutionId ?? "Not acknowledged"}
                  mono
                />
                <Fact
                  label="Provider status"
                  value={attempt.providerStatus ?? attempt.status}
                />
                <Fact
                  label="Transaction hash"
                  value={attempt.transactionHash ?? "Not available"}
                  mono
                />
                <Fact
                  label="Idempotency key"
                  value={attempt.keeperHubIdempotencyKey ?? "Not recorded"}
                  mono
                />
                <Fact
                  label="Request hash"
                  value={attempt.requestHash ?? "Not recorded"}
                  mono
                />
                <Fact
                  label="Retry locked"
                  value={attempt.resubmissionLocked === true ? "Yes" : "No"}
                />
                <Fact label="Recorded" value={formatDate(attempt.createdAt)} />
                <Fact
                  label="Dispatched"
                  value={formatDate(attempt.dispatchStartedAt)}
                />
                <Fact
                  label="Acknowledged"
                  value={formatDate(attempt.acknowledgedAt)}
                />
                <Fact
                  label="Final provider update"
                  value={formatDate(attempt.terminalAt)}
                />
              </dl>
              <div className="evidence-links">
                {typeof attempt.transactionHash === "string" && (
                  <a
                    className="inline-link"
                    href={`${config.explorerUrl}/tx/${attempt.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View transaction on Etherscan ↗
                  </a>
                )}
                {typeof attempt.providerTransactionLink === "string" && (
                  <a
                    className="inline-link"
                    href={attempt.providerTransactionLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open KeeperHub-provided link ↗
                  </a>
                )}
              </div>
              <RawRecord value={attempt} />
            </article>
          ))
        ) : (
          <p>No KeeperHub attempt has been dispatched.</p>
        )}
      </RecorderSection>

      <RecorderSection number="04" title="Sepolia transactions">
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
                  <span>
                    {String(transaction.stepId ?? "Recorded write")} ·{" "}
                    {String(transaction.status ?? "RECORDED").replaceAll(
                      "_",
                      " ",
                    )}
                  </span>
                  <code>{String(transaction.transactionHash)}</code>
                  <span>
                    KeeperHub execution:{" "}
                    {String(
                      transaction.keeperHubExecutionId ?? "Not acknowledged",
                    )}
                  </span>
                  <span>Recorded {formatDate(transaction.createdAt)}</span>
                </div>
                <div className="transaction-actions">
                  <a
                    className="button button-secondary"
                    href={String(transaction.explorerUrl)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View transaction ${String(transaction.transactionHash)} on Sepolia Etherscan`}
                  >
                    View on Etherscan ↗
                  </a>
                  {typeof transaction.providerTransactionLink === "string" ? (
                    <a
                      className="inline-link"
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
            No transaction hash has been recorded. A simulation failure does not
            create an onchain transaction.
          </p>
        )}
      </RecorderSection>

      <div className="split-sections">
        <RecorderSection number="05" title="Plans and simulations">
          <CompactRecords
            records={[...plans, ...simulations]}
            empty="No plan or simulation recorded yet."
          />
        </RecorderSection>
        <RecorderSection number="06" title="Independent verification">
          <CompactRecords
            records={observations}
            empty="No independent observation recorded yet."
          />
        </RecorderSection>
      </div>

      {reconciliation.length > 0 && (
        <RecorderSection number="07" title="Outcome reconciliation" urgent>
          <div className="notice notice-danger">
            <strong>Outcome unknown — retry locked</strong>
            <span>
              Aether will not create a duplicate economic write while evidence
              is incomplete.
            </span>
          </div>
          <CompactRecords records={reconciliation} empty="" />
        </RecorderSection>
      )}

      <RecorderSection
        number={reconciliation.length ? "08" : "07"}
        title="Persisted timeline"
      >
        <div className="timeline-list" aria-live="polite">
          {events.length ? (
            events.map((event) => (
              <div
                className="timeline-row"
                key={String(event.eventId ?? event.sequence)}
              >
                <span className="timeline-number">
                  {String(event.sequence ?? "–")}
                </span>
                <div>
                  <strong>{String(event.message ?? event.eventType)}</strong>
                  <small>{formatDate(event.createdAt)}</small>
                </div>
                <Status value={event.state} />
              </div>
            ))
          ) : (
            <p>Waiting for the first streamed transition…</p>
          )}
        </div>
      </RecorderSection>

      <RecorderSection
        number={reconciliation.length ? "09" : "08"}
        title="Final receipt"
      >
        {receipt ? (
          <>
            <div className="receipt-summary">
              <Status value={receipt.terminalState ?? run?.state} />
              <strong>
                {String(receipt.receiptHash ?? "Receipt recorded")}
              </strong>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => downloadReceipt(activeRun, receipt)}
            >
              Download verified JSON
            </button>
            <RawRecord value={receipt} open />
          </>
        ) : (
          <p>
            The receipt appears only after critical invariants pass and every
            uncertain attempt is resolved.
          </p>
        )}
      </RecorderSection>
    </div>
  );
}

function RecorderSection({
  number,
  title,
  urgent = false,
  children,
}: {
  number: string;
  title: string;
  urgent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`recorder-section${urgent ? " recorder-urgent" : ""}`}>
      <header>
        <span>{number}</span>
        <h2>{title}</h2>
      </header>
      <div className="recorder-content">{children}</div>
    </section>
  );
}
function CompactRecords({
  records: values,
  empty,
}: {
  records: RecordValue[];
  empty: string;
}) {
  if (!values.length) return <p>{empty}</p>;
  return (
    <div>
      {values.map((value, index) => (
        <article
          className="compact-record"
          key={String(
            value.planId ??
              value.simulationRecordId ??
              value.observationId ??
              index,
          )}
        >
          <div>
            <strong>
              {String(
                value.planId ??
                  value.simulationRecordId ??
                  value.observationId ??
                  "Evidence",
              )}
            </strong>
            <span>
              {String(
                value.provider ??
                  value.kind ??
                  value.status ??
                  "Persisted record",
              )}
            </span>
          </div>
          <RawRecord value={value} />
        </article>
      ))}
    </div>
  );
}
function RawRecord({
  value,
  open = false,
}: {
  value: unknown;
  open?: boolean;
}) {
  return (
    <details open={open}>
      <summary>View complete metadata</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
function ContractStrip({ config }: { config: PublicConfiguration }) {
  return (
    <section className="contract-strip">
      <div>
        <p className="eyebrow">Fixed contracts</p>
        <h2>Nothing is selected by conversation.</h2>
      </div>
      <AddressRow
        label="Savings vault"
        value={config.vaultAddress}
        explorer={`${config.explorerUrl}/address/${config.vaultAddress}`}
      />
      <AddressRow
        label={`${config.tokenSymbol} token`}
        value={config.tokenAddress}
        explorer={`${config.explorerUrl}/address/${config.tokenAddress}`}
      />
    </section>
  );
}
function AddressRow({
  label,
  value,
  explorer,
}: {
  label: string;
  value: string;
  explorer: string;
}) {
  return (
    <div className="address-row">
      <span>{label}</span>
      <code>{value}</code>
      <a
        href={explorer}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${label} on Sepolia explorer`}
      >
        ↗
      </a>
    </div>
  );
}
function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: unknown;
  mono?: boolean;
}) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{String(value)}</dd>
    </div>
  );
}
function Status({ value }: { value: unknown }) {
  const state = String(value ?? "UNKNOWN").replaceAll("_", " ");
  const tone = /COMPLETED|RECOVERED|VERIFIED|CONFIRMED|PASS|ACKNOWLEDGED/.test(
    state,
  )
    ? "success"
    : /UNKNOWN|FAILED|ATTENTION|RECONCILING|LOCKED|REVERT/.test(state)
      ? "danger"
      : "neutral";
  return <span className={`status status-${tone}`}>{state}</span>;
}
function LoadingScreen() {
  return (
    <main id="main-content" className="loading-screen">
      <p className="eyebrow">Savings / Aether</p>
      <h1>CHECKING THE EXECUTION BOUNDARY.</h1>
    </main>
  );
}

async function connectAndVerifyWallet() {
  const provider = window.ethereum;
  if (!provider)
    throw new Error(
      "No browser wallet was found. Install a wallet that supports Sepolia.",
    );
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const address = accounts[0];
  if (!address) throw new Error("The wallet did not return an account.");
  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (chainId !== "0xaa36a7") {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }],
    });
  }
  const challenge = await jsonRequest<{ message: string }>(
    `${apiBase}/wallet/challenge`,
    { method: "POST", body: "{}" },
  );
  const signature = (await provider.request({
    method: "personal_sign",
    params: [challenge.message, address],
  })) as string;
  const verified = await jsonRequest<{ address: string }>(
    `${apiBase}/wallet/verify`,
    {
      method: "POST",
      body: JSON.stringify({ address, signature }),
    },
  );
  return verified.address;
}

async function streamEvents(
  active: ActiveRun,
  cursor: () => number,
  receive: (event: RecordValue) => void,
  signal: AbortSignal,
) {
  while (!signal.aborted) {
    const response = await fetch(
      `${apiBase}/runs/${encodeURIComponent(active.runId)}/stream?after=${cursor()}`,
      {
        headers: {
          Accept: "text/event-stream",
          "X-Savings-Run-Token": active.viewToken,
        },
        cache: "no-store",
        signal,
      },
    );
    if (!response.ok || !response.body) throw await responseError(response);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder
        .decode(chunk.value, { stream: true })
        .replaceAll("\r\n", "\n");
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) {
          const event = JSON.parse(data) as RecordValue;
          if (
            typeof event.sequence === "number" &&
            typeof event.eventId === "string" &&
            typeof event.message === "string" &&
            typeof event.createdAt === "string"
          ) {
            receive(event);
          }
        }
      }
    }
  }
}

async function jsonRequest<T = RecordValue>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}
async function responseError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as RecordValue;
  return new Error(
    typeof payload.message === "string"
      ? payload.message
      : `Request failed with HTTP ${response.status}.`,
  );
}
async function logout() {
  await jsonRequest(`${apiBase}/session`, { method: "DELETE", body: "{}" });
}
function downloadReceipt(active: ActiveRun, receipt: RecordValue) {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${active.runId}-receipt.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
function records(value: unknown): RecordValue[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is RecordValue =>
          typeof item === "object" && item !== null,
      )
    : [];
}
function listLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}
function object(value: unknown): RecordValue | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RecordValue)
    : undefined;
}
function bySequence(left: RecordValue, right: RecordValue) {
  return Number(left.sequence ?? 0) - Number(right.sequence ?? 0);
}
function short(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}
function formatDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.valueOf())
    ? "Time not recorded"
    : date.toLocaleString();
}
function transactionRows(
  run: RecordValue | undefined,
  explorerUrl: string,
): RecordValue[] {
  const normalized = records(run?.transactionEvidence).filter(
    (item) => typeof item.transactionHash === "string",
  );
  if (normalized.length) return normalized;
  return records(run?.attempts)
    .filter((attempt) => typeof attempt.transactionHash === "string")
    .map(
      (attempt): RecordValue => ({
        ...attempt,
        explorerUrl: `${explorerUrl}/tx/${String(attempt.transactionHash)}`,
      }),
    );
}
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    };
  }
}
