"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  Copy,
  FileJson,
  GitBranch,
  Play,
  Plus,
  Search,
  Target,
} from "lucide-react";
import { AetherClient, getAetherErrorMessage } from "@aether/sdk";
import { Drawer } from "@aether/ui";
import {
  ConsoleShell,
  CopyValue,
  Empty,
  LoadingBlock,
  PageHeader,
  Status,
} from "@/components/app/console-shell";

const api = new AetherClient(process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1");

function short(value: unknown) {
  const text = String(value ?? "");
  return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text;
}

function formatDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.valueOf()) ? "Not recorded" : date.toLocaleString();
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      )
    : [];
}

function boxButton(primary = false) {
  // Use !text-* so global `a/button { color: inherit }` cannot wash out contrast.
  return primary
    ? "box-btn box-btn-primary inline-flex min-h-11 items-center gap-2 border border-black bg-black px-5 text-[13px] font-semibold !text-white no-underline transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:!text-white"
    : "box-btn box-btn-secondary inline-flex min-h-11 items-center gap-2 border border-black bg-white px-5 text-[13px] font-semibold !text-black no-underline transition-colors hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:!text-black";
}

function SchemaSection({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group border-b border-[#e5e5e5] last:border-b-0"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <strong className="block text-[13px] font-semibold text-black">
            {title}
          </strong>
          <span className="mt-1 block text-[12px] leading-relaxed text-[#707072]">
            {summary}
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className="shrink-0 text-[#707072] transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="px-5 pb-5 text-[12px] leading-relaxed text-[#39393b]">
        {children}
      </div>
    </details>
  );
}

function PropertyList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="m-0 divide-y divide-[#e5e5e5] border border-[#e5e5e5]">
      {items.map(([name, description]) => (
        <div
          key={name}
          className="grid gap-1 px-3 py-2.5 sm:grid-cols-[150px_1fr] sm:gap-4"
        >
          <dt className="font-mono text-[11px] font-semibold text-black">
            {name}
          </dt>
          <dd className="m-0 text-[#525252]">{description}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MissionSchemaDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Mission schema"
      description="The frozen instruction book Aether validates before any run can begin."
    >
      <div className="space-y-5 pt-5">
        <div className="border border-black bg-[#f5f5f5] px-4 py-4">
          <div className="flex items-start gap-3">
            <FileJson size={18} strokeWidth={1.75} aria-hidden="true" />
            <div>
              <p className="m-0 text-[13px] font-semibold text-black">
                Definition is intent, not execution
              </p>
              <p className="m-0 mt-1 text-[12px] leading-relaxed text-[#525252]">
                Creating or saving this document does not broadcast anything.
                The transaction process starts only when you press Run mission.
                Aether then validates, freezes, simulates, executes through
                KeeperHub, and independently proves each effect.
              </p>
            </div>
          </div>
        </div>

        <section aria-labelledby="schema-example-title">
          <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[#707072]">
            Read it once, then inspect the parts
          </p>
          <h2
            id="schema-example-title"
            className="m-0 mt-1 text-[18px] font-medium tracking-[-0.02em] text-black"
          >
            A mission in context
          </h2>
          <p className="m-0 mt-2 text-[12px] leading-relaxed text-[#525252]">
            Think of a mission as written instructions for a careful delivery
            worker: the objective explains the result, steps describe the
            writes, proofs check reality, and recovery rules define a safe way
            home.
          </p>
          <pre className="mt-3 max-h-72 overflow-auto border border-black bg-[#111111] p-4 font-mono text-[11px] leading-relaxed text-black">
            {`{
  "name": "Borrow 1 USDC against 1 LINK",
  "description": "Open and close a small Sepolia loan safely.",
  "definition": {
    "schemaVersion": 1,
    "objective": "Supply 1 LINK, borrow 1 USDC, then close everything.",
    "steps": [
      {
        "id": "supply-collateral",
        "dependsOn": ["approve-collateral"],
        "retryClass": "PROVABLE_EFFECT",
        "action": { "chainId": 11155111, "functionName": "supply" },
        "proof": { "kind": "ERC20_BALANCE", "operator": "GTE" },
        "compensation": { "id": "withdraw-collateral" }
      }
    ],
    "invariants": [{ "id": "sepolia-only", "kind": "CHAIN_ID" }],
    "recoveryPolicy": { "onUnknownOutcome": "RECONCILE" },
    "authorityPolicy": { "autoApproveForward": false }
  }
}`}
          </pre>
        </section>

        <div className="border border-black">
          <SchemaSection
            title="Top level"
            summary="The label, human context, and frozen instruction book."
            defaultOpen
          >
            <PropertyList
              items={[
                [
                  "name",
                  "The short label shown in the interface. It answers: what are we calling this job?",
                ],
                [
                  "description",
                  "A longer human explanation. It is descriptive only and never authorizes a transaction.",
                ],
                [
                  "definition",
                  "The actual instruction book. Once saved as a mission version, Aether does not modify it.",
                ],
              ]}
            />
          </SchemaSection>

          <SchemaSection
            title="Definition"
            summary="The mission’s format, outcome, work, and safety policies."
          >
            <PropertyList
              items={[
                [
                  "schemaVersion",
                  "The format version of the instruction book. Launch missions use version 1.",
                ],
                [
                  "objective",
                  "A plain-language statement of the complete result. It helps operators; transactions come from steps.",
                ],
                [
                  "steps",
                  "The ordered list of onchain writes and the proofs that show what each write actually did.",
                ],
                [
                  "invariants",
                  "Final checklist rules. Critical failures prevent a COMPLETED or RECOVERED receipt.",
                ],
                [
                  "recoveryPolicy",
                  "What Aether may do after a known failure, unknown outcome, or still-indeterminate result.",
                ],
                [
                  "authorityPolicy",
                  "The exact targets, functions, values, and approval behavior the runtime is authorized to use.",
                ],
              ]}
            />
          </SchemaSection>

          <SchemaSection
            title="Steps and dependencies"
            summary="Each step is one write, its retry risk, and its checkpoint."
          >
            <PropertyList
              items={[
                [
                  "id",
                  "Permanent machine-readable name. Other steps reference it in dependsOn.",
                ],
                ["name", "Human-readable name displayed to operators."],
                [
                  "dependsOn",
                  "Steps that must be independently verified first. An empty array means this step can start first.",
                ],
                [
                  "retryClass",
                  "How dangerous repeating the action would be: SEMANTICALLY_IDEMPOTENT, PROVABLE_EFFECT, or NON_REPLAYABLE.",
                ],
                ["action", "The exact contract call sent to KeeperHub."],
                [
                  "proof",
                  "The independent rule Aether checks after KeeperHub returns.",
                ],
                [
                  "compensation",
                  "The predeclared recovery action for that step. It creates a new transaction; it never erases history.",
                ],
                [
                  "executionGate",
                  "Optional fixed gate that can block simulation or broadcast, such as a deliberate demo failure.",
                ],
              ]}
            />
            <p className="m-0 mt-3 border-l-2 border-black pl-3 text-[#525252]">
              Borrowing is NON_REPLAYABLE because an uncertain retry could
              create twice the intended debt. Aether reconciles first and fails
              closed when it cannot prove safety.
            </p>
          </SchemaSection>

          <SchemaSection
            title="Action"
            summary="The contract call and all of the data needed to encode it."
          >
            <PropertyList
              items={[
                [
                  "chainId",
                  "The network. Launch writes must be Ethereum Sepolia: 11155111.",
                ],
                [
                  "contractAddress",
                  "The contract receiving the call, such as LINK or the Aave Pool.",
                ],
                [
                  "functionName",
                  "The exact contract function, such as approve, supply, borrow, repay, or withdraw.",
                ],
                [
                  "functionArgs",
                  "Ordered values passed to the function. Their order must match the ABI.",
                ],
                [
                  "abi",
                  "The function shape: name, input names and types, outputs, and whether it changes state.",
                ],
                [
                  "valueWei",
                  'Native SepoliaETH sent as call value. Token actions normally use "0"; gas is separate.',
                ],
              ]}
            />
            <p className="m-0 mt-3 text-[#525252]">
              Token amounts and wei are strings, never JavaScript numbers,
              because large integers cannot be represented safely as numbers.
            </p>
          </SchemaSection>

          <SchemaSection
            title="Proofs"
            summary="Independent checks that establish what happened onchain."
          >
            <PropertyList
              items={[
                [
                  "kind",
                  "The fact to check, such as ERC20_ALLOWANCE or ERC20_BALANCE.",
                ],
                [
                  "token / owner / account",
                  "The token and address whose balance or allowance is being observed.",
                ],
                [
                  "spender",
                  "The contract allowed to spend tokens in an ERC20_ALLOWANCE proof.",
                ],
                [
                  "operator",
                  "Comparison rule: EQ, GTE, LTE, or NEQ for supported contract-read proofs.",
                ],
                [
                  "amount",
                  "Expected token quantity, represented as an integer string.",
                ],
              ]}
            />
            <p className="m-0 mt-3 text-[#525252]">
              A KeeperHub success response is evidence, not reality. Aether
              checks the chain before marking a step verified.
            </p>
          </SchemaSection>

          <SchemaSection
            title="Compensation"
            summary="Predeclared recovery actions that return the system to an authorized safe state."
          >
            <PropertyList
              items={[
                ["id", "Permanent name for the recovery action."],
                [
                  "action",
                  "The exact contract call used to compensate a verified forward effect.",
                ],
                [
                  "proof",
                  "How Aether independently proves that compensation reached its required state.",
                ],
              ]}
            />
            <p className="m-0 mt-3 text-[#525252]">
              Example: a verified supply of LINK can declare a withdraw-all
              compensation with a proof that the aLINK balance is zero. Aether
              compensates only effects that reached VERIFIED.
            </p>
          </SchemaSection>

          <SchemaSection
            title="Invariants"
            summary="The terminal checklist before Aether issues a final receipt."
          >
            <PropertyList
              items={[
                ["id", "Permanent name for the checklist item."],
                [
                  "kind",
                  "What to check: CHAIN_ID, TARGET_ALLOWLIST, FUNCTION_ALLOWLIST, ERC20_BALANCE, ERC20_ALLOWANCE, CONTRACT_READ, MAX_WRITES, DEADLINE, or NO_UNKNOWN_ATTEMPTS.",
                ],
                [
                  "severity",
                  "CRITICAL blocks COMPLETED or RECOVERED; WARNING records important information without necessarily blocking.",
                ],
                [
                  "parameters",
                  "Values required by the invariant, such as token, account, operator, and expected amount.",
                ],
              ]}
            />
          </SchemaSection>

          <SchemaSection
            title="Recovery and authority policies"
            summary="The boundaries that determine what Aether is allowed to do next."
          >
            <PropertyList
              items={[
                [
                  "maxRecoverySpendWei",
                  "Maximum native ETH call value authorized for recovery. It does not include KeeperHub gas.",
                ],
                [
                  "terminalSafeStates",
                  "Human-readable names for safe final conditions; actual proofs and critical invariants remain authoritative.",
                ],
                [
                  "onKnownFailure",
                  "Usually COMPENSATE to run declared compensations, or ESCALATE.",
                ],
                [
                  "onUnknownOutcome",
                  "RECONCILE to lock retry and investigate the original write; never blindly replay an economic action.",
                ],
                [
                  "onIndeterminateOutcome",
                  "ESCALATE when evidence is still insufficient, leaving the mission in NEEDS_ATTENTION.",
                ],
                [
                  "autoApproveForward / autoApproveRecovery",
                  "Whether a frozen, policy-compliant plan can proceed without a human approval.",
                ],
                [
                  "maximumValueWei",
                  "Maximum native ETH sent as contract call value for one action.",
                ],
                [
                  "allowedTargets / allowedFunctions",
                  "The only contracts and function names steps or compensations may call.",
                ],
              ]}
            />
          </SchemaSection>

          <SchemaSection
            title="Who generates a mission?"
            summary="Three roles keep intent, composition, and authority separate."
          >
            <ol className="m-0 list-decimal space-y-3 pl-5">
              <li>
                <strong className="text-black">User states the goal.</strong>{" "}
                For example: “Use 1 LINK as collateral, borrow 1 USDC, then
                close everything.”
              </li>
              <li>
                <strong className="text-black">
                  The Lending application creates the document.
                </strong>{" "}
                It selects an audited template, inserts trusted addresses and
                integer strings, then adds proofs and recovery actions.
              </li>
              <li>
                <strong className="text-black">
                  Aether validates and executes.
                </strong>{" "}
                It freezes the version, hashes exact plans, simulates writes,
                uses KeeperHub, verifies chain reality, and reconciles unknown
                outcomes.
              </li>
            </ol>
          </SchemaSection>
        </div>

        <p className="m-0 border-t border-black pt-4 text-[12px] leading-relaxed text-[#525252]">
          Before a live run, the KeeperHub executor needs at least 1 LINK on
          Sepolia, enough USDC for small accrued interest, SepoliaETH for gas,
          and an integration configured to control the executor address in the
          mission.
        </p>
      </div>
    </Drawer>
  );
}

export function MissionsView() {
  const [queryText, setQueryText] = useState("");
  const [schemaOpen, setSchemaOpen] = useState(false);
  const query = useQuery({
    queryKey: ["missions"],
    queryFn: () => api.listMissions(),
    refetchInterval: 5000,
  });

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    const needle = queryText.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((mission) => {
      const haystack = [
        mission.name,
        mission.description,
        mission.missionId,
        mission.state,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(needle);
    });
  }, [query.data?.items, queryText]);

  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Definitions"
        title="Missions"
        description="Versioned multi-step objectives with declared proofs, retry classes, and recovery actions."
        action={
          <>
            {" "}
            <Link href="/app/missions/new" className={boxButton(true)}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              New mission
            </Link>
            <button
              type="button"
              className={boxButton(false)}
              onClick={() => setSchemaOpen(true)}
            >
              <FileJson size={15} strokeWidth={1.75} aria-hidden="true" />
              View mission schema
            </button>
          </>
        }
      />

      <MissionSchemaDrawer open={schemaOpen} onOpenChange={setSchemaOpen} />

      <section className="mt-0 border border-t-0 border-black bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black px-5 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center border border-black bg-[#f5f5f5]"
              aria-hidden="true"
            >
              <Search size={15} strokeWidth={1.75} />
            </span>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search missions</span>
              <input
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                placeholder="Search by name, description, or id"
                className="w-full border-0 bg-transparent text-[14px] text-black outline-none placeholder:text-[#9e9ea0]"
              />
            </label>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-[#707072]">
            <span>
              <strong className="font-semibold text-black">
                {query.data?.items.length ?? 0}
              </strong>{" "}
              total
            </span>
            <span className="hidden sm:inline">
              <strong className="font-semibold text-black">
                {items.length}
              </strong>{" "}
              shown
            </span>
          </div>
        </div>

        {query.isLoading ? (
          <div className="p-5">
            <LoadingBlock label="Loading missions" rows={5} />
          </div>
        ) : query.isError ? (
          <div className="p-5">
            <Empty
              title="Could not load missions"
              body={getAetherErrorMessage(
                query.error,
                "Check the API connection and your session.",
              )}
              action={
                <button
                  type="button"
                  className={boxButton(false)}
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              }
            />
          </div>
        ) : items.length ? (
          <div className="divide-y divide-black">
            {/* Column header */}
            <div className="hidden grid-cols-[minmax(0,1.6fr)_140px_160px_120px] gap-4 border-b border-[#e5e5e5] bg-[#f5f5f5] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#707072] md:grid">
              <span>Mission</span>
              <span>State</span>
              <span>Created</span>
              <span className="text-right">Action</span>
            </div>
            {items.map((mission, index) => (
              <Link
                key={String(mission.missionId)}
                href={`/app/missions/${String(mission.missionId)}`}
                className="group grid grid-cols-1 gap-3 px-5 py-5 no-underline transition-colors hover:bg-[#fafafa] md:grid-cols-[minmax(0,1.6fr)_140px_160px_120px] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 grid size-9 shrink-0 place-items-center border border-black bg-white text-[11px] font-mono text-[#707072]"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate text-[15px] font-semibold tracking-[-0.015em] text-black">
                        {String(mission.name)}
                      </strong>
                      <p className="m-0 mt-1 line-clamp-2 text-[13px] text-[#707072]">
                        {String(mission.description ?? "No description")}
                      </p>
                      <p className="m-0 mt-2 font-mono text-[11px] text-[#9e9ea0]">
                        {short(mission.missionId)}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <Status value={mission.state ?? "READY"} />
                </div>
                <div className="text-[12px] text-[#707072]">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={13} strokeWidth={1.75} aria-hidden="true" />
                    {formatDate(mission.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-start md:justify-end">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-black">
                    Open
                    <ArrowRight
                      size={14}
                      strokeWidth={1.75}
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : queryText.trim() ? (
          <div className="p-5">
            <Empty
              title="No matching missions"
              body={`Nothing matches “${queryText.trim()}”. Clear the search or create a new definition.`}
              action={
                <button
                  type="button"
                  className={boxButton(false)}
                  onClick={() => setQueryText("")}
                >
                  Clear search
                </button>
              }
            />
          </div>
        ) : (
          <div className="p-5">
            <Empty
              title="No missions yet"
              body="Create a mission to freeze its steps, proofs, retry classes, and recovery rules."
              action={
                <Link href="/app/missions/new" className={boxButton(true)}>
                  <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                  Create mission
                </Link>
              }
            />
          </div>
        )}
      </section>

      <section
        aria-label="Mission guidance"
        className="grid border border-t-0 border-black sm:grid-cols-3"
      >
        {[
          {
            icon: Target,
            title: "Freeze intent",
            body: "Steps, proofs, and recovery rules are immutable per version.",
          },
          {
            icon: Play,
            title: "Run with checkpoints",
            body: "Each write is simulated, submitted via KeeperHub, then verified.",
          },
          {
            icon: GitBranch,
            title: "Recover safely",
            body: "Unknown outcomes stay retry-locked until independently reconciled.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="border-b border-black bg-[#f5f5f5] px-5 py-5 sm:border-b-0 sm:border-r sm:last:border-r-0"
          >
            <item.icon
              size={16}
              strokeWidth={1.75}
              className="text-black"
              aria-hidden="true"
            />
            <strong className="mt-3 block text-[13px] font-semibold text-black">
              {item.title}
            </strong>
            <p className="m-0 mt-1 text-[12px] leading-relaxed text-[#707072]">
              {item.body}
            </p>
          </div>
        ))}
      </section>
    </ConsoleShell>
  );
}

export function MissionView({ missionId }: { missionId: string }) {
  const query = useQuery({
    queryKey: ["mission", missionId],
    queryFn: () => api.mission(missionId),
    refetchInterval: 5000,
  });
  const [starting, setStarting] = useState(false);

  if (query.isLoading) {
    return (
      <ConsoleShell>
        <PageHeader
          eyebrow="Mission"
          title="Loading mission"
          description="Reading the frozen definition and recent runs."
          breadcrumbs={[
            { label: "Missions", href: "/app/missions" },
            { label: short(missionId) },
          ]}
        />
        <LoadingBlock label="Loading mission" rows={4} />
      </ConsoleShell>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ConsoleShell>
        <PageHeader
          eyebrow="Mission"
          title="Mission unavailable"
          description={getAetherErrorMessage(
            query.error,
            "This mission could not be loaded.",
          )}
          breadcrumbs={[
            { label: "Missions", href: "/app/missions" },
            { label: short(missionId) },
          ]}
        />
        <Empty
          title="Could not open this mission"
          body="It may have been archived, or your session may not have access."
          action={
            <Link href="/app/missions" className={boxButton(false)}>
              Back to missions
            </Link>
          }
        />
      </ConsoleShell>
    );
  }

  const mission = query.data;
  const versions = asArray(mission.versions);
  const runs = asArray(mission.runs);
  const latestVersion = versions[0];
  const activeRuns = runs.filter(
    (run) =>
      !["COMPLETED", "RECOVERED", "ABORTED_SAFE", "NEEDS_ATTENTION"].includes(
        String(run.state),
      ),
  ).length;

  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Mission"
        title={String(mission.name)}
        description={String(
          mission.description ?? "Versioned multi-step onchain mission.",
        )}
        breadcrumbs={[
          { label: "Missions", href: "/app/missions" },
          { label: String(mission.name) },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/app/missions" className={boxButton(false)}>
              All missions
            </Link>

            <button
              type="button"
              className={boxButton(true)}
              disabled={starting}
              onClick={async () => {
                setStarting(true);
                try {
                  const result = await api.createRun(missionId, { input: {} });
                  toast.success("Run started.");
                  window.location.href = `/app/runs/${String(result.runId)}`;
                } catch (error) {
                  toast.error(
                    getAetherErrorMessage(error, "Run could not be started."),
                  );
                  setStarting(false);
                }
              }}
            >
              <Play size={15} strokeWidth={1.75} aria-hidden="true" />
              {starting ? "Starting…" : "Run mission"}
            </button>
          </div>
        }
      />

      {/* Meta strip */}
      <section
        aria-label="Mission summary"
        className="grid border border-t-0 border-black sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          ["Mission ID", short(mission.missionId)],
          ["Created", formatDate(mission.createdAt)],
          ["Last updated", formatDate(mission.updatedAt)],
          ["Active runs", String(activeRuns)],
        ].map(([label, value], index, arr) => (
          <div
            key={label}
            className={[
              "min-h-[96px] bg-white px-5 py-4",
              "border-b border-black sm:border-b-0",
              index < arr.length - 1 ? "sm:border-r" : "",
            ].join(" ")}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#707072]">
              {label}
            </span>
            <strong className="mt-2 block text-[14px] font-semibold text-black">
              {value}
            </strong>
          </div>
        ))}
      </section>

      <div className="grid border border-t-0 border-black lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {/* Versions */}
        <section className="border-b border-black bg-white lg:border-b-0 lg:border-r">
          <header className="flex items-center justify-between gap-3 border-b border-black px-5 py-4">
            <div>
              <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[#707072]">
                Immutable
              </p>
              <h2 className="m-0 mt-1 text-[18px] font-medium tracking-[-0.02em] text-black">
                Frozen versions
              </h2>
            </div>
            <span className="border border-black bg-[#f5f5f5] px-2.5 py-1 text-[11px] font-semibold text-black">
              {versions.length}
            </span>
          </header>

          {versions.length ? (
            <div className="divide-y divide-[#e5e5e5]">
              {versions.map((version, index) => (
                <article
                  key={String(version.missionVersionId)}
                  className="px-5 py-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center border border-black bg-[#f5f5f5] font-mono text-[11px] text-[#707072]">
                          v{String(version.versionNumber ?? index + 1)}
                        </span>
                        <strong className="text-[14px] font-semibold text-black">
                          Version {String(version.versionNumber ?? index + 1)}
                        </strong>
                      </div>
                      <p className="m-0 mt-2 text-[12px] text-[#707072]">
                        Created {formatDate(version.createdAt)}
                      </p>
                    </div>
                    <Status value="IMMUTABLE" />
                  </div>
                  {version.hash ? (
                    <div className="mt-3">
                      <CopyValue
                        value={String(version.hash)}
                        label="Copy version hash"
                      />
                    </div>
                  ) : null}
                  {index === 0 ? (
                    <p className="m-0 mt-3 border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-[12px] text-[#525252]">
                      Latest frozen definition. New runs use this version unless
                      the mission is re-versioned.
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <Empty
                title="No frozen versions"
                body="A mission version is created when the definition is first saved."
              />
            </div>
          )}

          {latestVersion ? (
            <div className="border-t border-black px-5 py-4">
              <button
                type="button"
                className={boxButton(false)}
                onClick={async () => {
                  const hash = String(latestVersion.hash ?? "");
                  if (!hash) return;
                  try {
                    await navigator.clipboard.writeText(hash);
                    toast.success("Latest version hash copied.");
                  } catch {
                    toast.error("Could not copy hash.");
                  }
                }}
              >
                <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
                Copy latest hash
              </button>
            </div>
          ) : null}
        </section>

        {/* Runs */}
        <section className="bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-black px-5 py-4">
            <div>
              <p className="m-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[#707072]">
                Flight records
              </p>
              <h2 className="m-0 mt-1 text-[18px] font-medium tracking-[-0.02em] text-black">
                Recent runs
              </h2>
            </div>
            <span className="border border-black bg-[#f5f5f5] px-2.5 py-1 text-[11px] font-semibold text-black">
              {runs.length}
            </span>
          </header>

          {runs.length ? (
            <div className="divide-y divide-[#e5e5e5]">
              {runs.map((run) => (
                <Link
                  key={String(run.runId)}
                  href={`/app/runs/${String(run.runId)}`}
                  className="group block px-5 py-5 no-underline transition-colors hover:bg-[#fafafa]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block font-mono text-[13px] font-semibold text-black">
                        {short(run.runId)}
                      </strong>
                      <p className="m-0 mt-1 text-[13px] text-[#525252]">
                        {String(run.stateReason ?? "No state reason recorded.")}
                      </p>
                    </div>
                    <Status value={run.state} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#707072]">
                    <span>Created {formatDate(run.createdAt)}</span>
                    <span>Updated {formatDate(run.updatedAt)}</span>
                    {run.terminalAt ? (
                      <span>Finished {formatDate(run.terminalAt)}</span>
                    ) : (
                      <span className="font-semibold text-[#9a5b00]">
                        In progress
                      </span>
                    )}
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-black">
                    Open run
                    <ArrowRight
                      size={13}
                      strokeWidth={1.75}
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <Empty
                title="No runs yet"
                body="Start the mission to create a persisted flight record with checkpoints and evidence."
                action={
                  <button
                    type="button"
                    className={boxButton(true)}
                    disabled={starting}
                    onClick={async () => {
                      setStarting(true);
                      try {
                        const result = await api.createRun(missionId, {
                          input: {},
                        });
                        toast.success("Run started.");
                        window.location.href = `/app/runs/${String(result.runId)}`;
                      } catch (error) {
                        toast.error(
                          getAetherErrorMessage(
                            error,
                            "Run could not be started.",
                          ),
                        );
                        setStarting(false);
                      }
                    }}
                  >
                    <Play size={15} strokeWidth={1.75} aria-hidden="true" />
                    {starting ? "Starting…" : "Run mission"}
                  </button>
                }
              />
            </div>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}
