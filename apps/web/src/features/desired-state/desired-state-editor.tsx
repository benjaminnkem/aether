"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { parse, stringify } from "yaml";
import {
  activeLiveChain,
  desiredStateSchema,
  type DesiredState,
  type GitHubDesiredStateSource,
} from "@aether/shared";
import {
  Button,
  DiffBlock,
  Field,
  Input,
  Select,
  TabContent,
  Tabs,
  Textarea,
  ValidationSummary,
} from "@aether/ui";
import { aetherClient } from "@aether/sdk";
import { useRefreshDashboard } from "@/features/dashboard/use-refresh-dashboard";

const defaults: DesiredState = {
  version: "v1.0.0",
  networkId: activeLiveChain.slug,
  chainId: activeLiveChain.chainId,
  contractId: "",
  contractVersion: "",
  implementationAddress: "",
  oracleAddress: "",
  administrators: [""],
  guardians: [""],
  paused: false,
  fee: { value: "0", unit: "bps" },
  minimumExecutorGas: { value: "0", unit: "ether" },
  maximumAutomaticTransaction: { value: "0", unit: "ether" },
  release: "",
  source: "",
};

export default function DesiredStateEditor({
  githubSource,
}: {
  githubSource?: GitHubDesiredStateSource;
}) {
  const refreshDashboard = useRefreshDashboard();
  const [mode, setMode] = useState("form");
  const [issues, setIssues] = useState<string[]>([]);
  const [validatedFingerprint, setValidatedFingerprint] = useState("");
  const [yamlDraft, setYamlDraft] = useState(() => stringify(defaults));
  const [baseline, setBaseline] = useState(defaults);
  const loadedActiveCommit = useRef("");
  const { register, handleSubmit, watch, reset } = useForm<DesiredState>({
    defaultValues: defaults,
  });
  const values = watch();
  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(baseline),
    [baseline, values],
  );
  const formFingerprint = useMemo(() => JSON.stringify(values), [values]);
  const yamlFingerprint = useMemo(() => {
    try {
      return JSON.stringify(desiredStateSchema.parse(parse(yamlDraft)));
    } catch {
      return "";
    }
  }, [yamlDraft]);
  const activeFingerprint = mode === "code" ? yamlFingerprint : formFingerprint;
  const validated =
    activeFingerprint.length > 0 && validatedFingerprint === activeFingerprint;
  const hasUnsavedChanges =
    mode === "code" ? yamlFingerprint !== JSON.stringify(baseline) : dirty;

  useEffect(() => {
    if (
      !githubSource?.matchesActiveVersion ||
      loadedActiveCommit.current === githubSource.commitSha
    )
      return;
    loadedActiveCommit.current = githubSource.commitSha;
    reset(githubSource.manifest);
    setBaseline(githubSource.manifest);
    setYamlDraft(stringify(githubSource.manifest));
    setValidatedFingerprint(JSON.stringify(githubSource.manifest));
    setIssues([]);
  }, [githubSource, reset]);

  const validate = async (input: unknown) => {
    const result = desiredStateSchema.safeParse(input);
    if (!result.success) {
      setIssues(
        result.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      );
      setValidatedFingerprint("");
      return;
    }
    await aetherClient.validateDesiredState(result.data);
    setIssues([]);
    setValidatedFingerprint(JSON.stringify(result.data));
    setYamlDraft(stringify(result.data));
  };

  const validateYaml = async () => {
    try {
      const parsed = desiredStateSchema.parse(parse(yamlDraft));
      reset(parsed);
      await validate(parsed);
    } catch (error) {
      setValidatedFingerprint("");
      setIssues([
        error instanceof Error
          ? `YAML: ${error.message}`
          : "YAML does not match the desired-state schema.",
      ]);
    }
  };

  const statusLabel = hasUnsavedChanges
    ? validated
      ? "Validated · unsaved"
      : "Unsaved changes"
    : "Active values";

  return (
    <div className="desired-editor">
      {githubSource ? (
        <div className="github-source-banner a-card">
          <div>
            <span className="visual-kicker">Pinned GitHub source</span>
            <strong>{githubSource.repository}</strong>
            <span>
              {githubSource.branch}/{githubSource.path} · commit{" "}
              <code>{githubSource.commitSha.slice(0, 12)}</code>
            </span>
            <span>
              Resource {githubSource.resolution.repositoryContractId} →{" "}
              <code>{githubSource.resolution.resolvedContractId}</code>
              {githubSource.matchesActiveVersion
                ? " · matches active version"
                : " · differs from active version"}
            </span>
          </div>
          <div className="page-actions">
            <a
              className="a-button a-button--ghost"
              href={githubSource.fileUrl}
              target="_blank"
              rel="noreferrer"
            >
              View source
            </a>
            <Button
              type="button"
              variant="primary"
              disabled={githubSource.matchesActiveVersion}
              onClick={() => {
                reset(githubSource.manifest);
                setYamlDraft(stringify(githubSource.manifest));
                setMode("code");
                setIssues([]);
                setValidatedFingerprint("");
                toast.success(
                  "Repository version loaded. Validate it before activation.",
                );
              }}
            >
              {githubSource.matchesActiveVersion
                ? "Repo version active"
                : "Load repo version"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="desired-editor__toolbar a-card">
        <div>
          <span className="visual-kicker">Manifest editor</span>
          <p>
            Form and YAML share one Zod schema. Validate before saving a new
            immutable version.
          </p>
        </div>
        <div className="desired-editor__toolbar-actions">
          <Tabs
            value={mode}
            onValueChange={(nextMode) => {
              if (nextMode === "code") setYamlDraft(stringify(values));
              setMode(nextMode);
            }}
            tabs={[
              { value: "form", label: "Form" },
              { value: "code", label: "YAML" },
            ]}
          >
            <span />
          </Tabs>
          <span
            className={
              validated
                ? "a-badge a-badge--success"
                : hasUnsavedChanges
                  ? "a-badge a-badge--warning"
                  : "a-badge"
            }
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <ValidationSummary errors={issues} />

      <Tabs value={mode} onValueChange={setMode} tabs={[]}>
        <TabContent value="form">
          <form
            className="settings-form a-card desired-form"
            onSubmit={handleSubmit((input) => void validate(input))}
          >
            <section
              className="desired-form__section"
              aria-labelledby="ds-identity"
            >
              <h3 id="ds-identity">Identity & release</h3>
              <div className="form-row">
                <Field label="Manifest version">
                  <Input {...register("version")} />
                </Field>
                <Field label="Release provenance">
                  <Input {...register("release")} />
                </Field>
              </div>
              <div className="form-row">
                <Field label="Network">
                  <Select {...register("networkId")}>
                    <option value={activeLiveChain.slug}>
                      {activeLiveChain.displayName}
                    </option>
                  </Select>
                </Field>
                <Field label="Chain ID">
                  <Input
                    type="number"
                    {...register("chainId", { valueAsNumber: true })}
                  />
                </Field>
              </div>
            </section>

            <section
              className="desired-form__section"
              aria-labelledby="ds-targets"
            >
              <h3 id="ds-targets">Contract targets</h3>
              <div className="form-row">
                <Field label="Contract resource">
                  <Input {...register("contractId")} />
                </Field>
                <Field label="Contract version">
                  <Input {...register("contractVersion")} />
                </Field>
              </div>
              <Field label="Approved implementation address">
                <Input
                  className="mono"
                  {...register("implementationAddress")}
                />
              </Field>
              <Field label="Approved oracle address">
                <Input className="mono" {...register("oracleAddress")} />
              </Field>
              <div className="form-row">
                <Field label="Administrator">
                  <Input className="mono" {...register("administrators.0")} />
                </Field>
                <Field label="Guardian">
                  <Input className="mono" {...register("guardians.0")} />
                </Field>
              </div>
            </section>

            <section
              className="desired-form__section"
              aria-labelledby="ds-policy"
            >
              <h3 id="ds-policy">Safety limits</h3>
              <div className="form-row">
                <Field
                  label="Protocol fee"
                  hint={`${values.fee.value} basis points`}
                >
                  <div className="unit-field">
                    <Input inputMode="numeric" {...register("fee.value")} />
                    <Select {...register("fee.unit")}>
                      <option value="bps">bps</option>
                    </Select>
                  </div>
                </Field>
                <Field
                  label="Minimum executor gas"
                  hint={`${values.minimumExecutorGas.value} native token`}
                >
                  <div className="unit-field">
                    <Input {...register("minimumExecutorGas.value")} />
                    <Select {...register("minimumExecutorGas.unit")}>
                      <option value="ether">ETH</option>
                    </Select>
                  </div>
                </Field>
              </div>
              <Field
                label="Maximum automatic transaction value"
                hint="Zero prevents native-value automation."
              >
                <div className="unit-field">
                  <Input {...register("maximumAutomaticTransaction.value")} />
                  <Select {...register("maximumAutomaticTransaction.unit")}>
                    <option value="ether">ETH</option>
                  </Select>
                </div>
              </Field>
              <Field label="Source">
                <Input {...register("source")} />
              </Field>
              <label className="a-field desired-pause">
                <span className="a-field__label">Emergency state</span>
                <span className="desired-pause__control">
                  <input type="checkbox" {...register("paused")} />
                  Pause protocol in desired state
                </span>
              </label>
            </section>

            <div className="desired-editor__actions">
              <Button type="submit">Validate draft</Button>
              <Button
                type="button"
                variant="primary"
                disabled={!validated || !hasUnsavedChanges}
                onClick={() => {
                  const parsed = desiredStateSchema.safeParse(values);
                  if (!parsed.success || !validated) {
                    toast.error(
                      "Validate the current desired state before saving.",
                    );
                    return;
                  }
                  void aetherClient
                    .saveDesiredState(parsed.data)
                    .then(async () => {
                      await refreshDashboard();
                      toast.success("Desired state version saved.");
                    })
                    .catch(() =>
                      toast.error("The API could not save this desired state."),
                    );
                }}
              >
                Save new version
              </Button>
              <span className="desired-editor__hint muted">
                {validated
                  ? "Ready to persist an immutable version."
                  : "Validation is required before save."}
              </span>
            </div>
          </form>
        </TabContent>
        <TabContent value="code">
          <div className="settings-form a-card desired-yaml">
            <Field
              label="Canonical YAML"
              hint="Form and code modes use the same browser-safe Zod schema."
            >
              <Textarea
                aria-label="Canonical YAML"
                className="mono"
                rows={28}
                value={yamlDraft}
                onChange={(event) => {
                  setYamlDraft(event.target.value);
                  setValidatedFingerprint("");
                }}
              />
            </Field>
            <div className="desired-editor__actions">
              <Button variant="primary" onClick={() => void validateYaml()}>
                Validate YAML
              </Button>
              <span className="desired-editor__hint muted">
                Invalid YAML never activates a version.
              </span>
            </div>
          </div>
        </TabContent>
      </Tabs>

      <section className="desired-diff a-card" aria-label="Semantic diff">
        <div className="panel__head">
          <div>
            <span className="visual-kicker">Semantic diff</span>
            <h3>Baseline vs draft</h3>
          </div>
        </div>
        <DiffBlock
          before={
            githubSource?.matchesActiveVersion || baseline.oracleAddress
              ? `version: ${baseline.version}\noracleAddress: ${baseline.oracleAddress.slice(0, 12)}…\nminimumExecutorGas: ${baseline.minimumExecutorGas.value} ETH`
              : "No previous desired-state version loaded."
          }
          after={`version: ${values.version}\noracleAddress: ${values.oracleAddress.slice(0, 12)}…\nminimumExecutorGas: ${values.minimumExecutorGas.value} ETH`}
        />
      </section>
    </div>
  );
}
