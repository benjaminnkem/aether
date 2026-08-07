"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight2,
  DocumentCode2,
  ShieldTick,
  Warning2,
} from "iconsax-react";
import { aetherClient, getAetherErrorMessage } from "@aether/sdk";
import type { Dashboard } from "@aether/shared";
import { activeLiveChain } from "@aether/shared";
import { Badge, Button, EmptyState, Status, Timeline } from "@aether/ui";
import DesiredStateEditor from "./desired-state-editor";

export function DesiredStatePage({ data }: { data: Dashboard }) {
  const versions = data.records["desired-state"] ?? [];
  const active = versions.find((item) => item.value === "Active");
  const contracts = data.records.contracts ?? [];
  const githubSource = useQuery({
    queryKey: ["github", "desired-state-source"],
    queryFn: () => aetherClient.getGitHubDesiredState(),
    retry: false,
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Desired State</h1>
          <p>
            Versioned approved intent, deterministic safety rules, and
            human-readable units.
          </p>
        </div>
        <div className="page-actions">
          {active ? (
            <Badge tone="success">{active.title} active</Badge>
          ) : (
            <Badge tone="warning">No active version</Badge>
          )}
          <Link href="/app/drift">
            <Button variant="secondary" size="sm">
              Compare drift <ArrowRight2 size={14} aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </header>

      <div className="context-strip">
        <span>
          <i /> {data.protocols[0]?.name ?? "Protocol"}
        </span>
        <Badge>{activeLiveChain.displayName}</Badge>
        <Status status={active ? "healthy" : "warning"} />
        <span className="mono">
          {active?.meta ? `hash ${active.meta.slice(0, 18)}…` : "hash pending"}
        </span>
      </div>

      <section
        className="desired-summary-grid"
        aria-label="Desired state status"
      >
        <article className="desired-summary-card a-card">
          <span className="visual-kicker">Active version</span>
          <strong>{active?.title ?? "None"}</strong>
          <p>
            {active
              ? (active.subtitle ??
                "Persisted and available for drift comparison.")
              : "Save a validated manifest before observation can measure alignment."}
          </p>
        </article>
        <article className="desired-summary-card a-card">
          <span className="visual-kicker">GitHub provenance</span>
          <strong>
            {githubSource.isLoading
              ? "Checking…"
              : githubSource.data
                ? githubSource.data.repository
                : "Not linked"}
          </strong>
          <p>
            {githubSource.data
              ? `${githubSource.data.branch}/${githubSource.data.path}`
              : "Select a repository path in Protocol Setup for release evidence."}
          </p>
        </article>
        <article className="desired-summary-card a-card">
          <span className="visual-kicker">Allowlisted targets</span>
          <strong>{contracts.length}</strong>
          <p>
            {contracts.length
              ? "Contract resources bound to this protocol for policy checks."
              : "Register contracts in Protocol Setup before planning corrections."}
          </p>
        </article>
      </section>

      <div className="desired-workspace">
        <div className="desired-workspace__editor">
          {githubSource.isLoading ? (
            <div
              className="a-skeleton desired-skeleton"
              aria-label="Loading GitHub desired state"
            />
          ) : null}
          {githubSource.isError ? (
            <div className="a-callout a-callout--danger" role="alert">
              <Warning2 size={18} aria-hidden="true" />
              <div>
                <strong>GitHub desired state is unavailable</strong>
                <p>
                  {getAetherErrorMessage(
                    githubSource.error,
                    "Check the selected repository path and validate the YAML schema.",
                  )}
                </p>
              </div>
              <Link href="/app/protocol-setup?tab=github">
                <Button size="sm" variant="secondary">
                  Fix provenance
                </Button>
              </Link>
            </div>
          ) : null}
          <DesiredStateEditor githubSource={githubSource.data} />
        </div>

        <aside className="desired-workspace__rail panel-stack">
          <section className="panel a-card">
            <div className="panel__head">
              <h2>Active version</h2>
              <DocumentCode2 size={16} aria-hidden="true" />
            </div>
            <div className="panel__body">
              {active ? (
                <div className="desired-active-version">
                  <div className="desired-active-version__row">
                    <span>Version</span>
                    <strong>{active.title}</strong>
                  </div>
                  <div className="desired-active-version__row">
                    <span>Status</span>
                    <Status status={active.status} />
                  </div>
                  <div className="desired-active-version__row">
                    <span>Actor</span>
                    <code className="evidence-value">
                      {active.subtitle ?? "—"}
                    </code>
                  </div>
                  {active.meta ? (
                    <div className="desired-active-version__row">
                      <span>Manifest hash</span>
                      <code className="evidence-value mono">{active.meta}</code>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="No active version"
                  description="Validate and save a desired-state manifest to create the first immutable version."
                />
              )}
            </div>
          </section>

          <section className="panel a-card">
            <div className="panel__head">
              <h2>Safety policy</h2>
              <ShieldTick size={16} aria-hidden="true" />
            </div>
            <div className="panel__body">
              <Timeline
                items={[
                  {
                    title: "Approved targets only",
                    detail: `${contracts.length} registered contract(s)`,
                    status: contracts.length ? "healthy" : "warning",
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
                  {
                    title: "Mainnet prohibited",
                    detail: `${activeLiveChain.displayName} only`,
                    status: "healthy",
                  },
                ]}
              />
            </div>
          </section>

          <section className="panel a-card">
            <div className="panel__head">
              <h2>Version history</h2>
            </div>
            <div className="panel__body">
              {versions.length ? (
                <Timeline
                  items={versions.map((item) => ({
                    title: item.title,
                    detail: item.meta ?? item.subtitle,
                    status: item.status,
                  }))}
                />
              ) : (
                <p className="record-subtitle">No version history yet.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default DesiredStatePage;
