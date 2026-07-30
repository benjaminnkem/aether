"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { parse, stringify } from "yaml";
import { desiredStateSchema, type DesiredState } from "@aether/shared";
import {
  Button,
  DiffBlock,
  Field,
  Input,
  Select,
  TabContent,
  Tabs,
  Textarea,
  ToastRegion,
  ValidationSummary,
} from "@aether/ui";
import { aetherClient } from "@aether/sdk";

const defaults: DesiredState = {
  version: "v2.4.2",
  networkId: "base-sepolia",
  chainId: 84532,
  contractId: "arcadia-market",
  contractVersion: "2.4.2",
  implementationAddress: "0x7D4A3AfF7c4C51B1726a91c738ACb6F227127C3f",
  oracleAddress: "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311",
  administrators: ["0x4eC4816D356B31fD7023d15E2eDF4fC2B5518AB7"],
  guardians: ["0x6BA4F4C99Aba65Cfa9Ce27Ab981EE33573Ec7Cc1"],
  paused: false,
  fee: { value: "50", unit: "bps" },
  minimumExecutorGas: { value: "0.1", unit: "ether" },
  maximumAutomaticTransaction: { value: "0", unit: "ether" },
  release: "arcadia-v2.4.2",
  source: "github.com/arcadia-labs/markets/pull/482",
};

export default function DesiredStateEditor() {
  const [mode, setMode] = useState("form");
  const [issues, setIssues] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [yamlDraft, setYamlDraft] = useState(() => stringify(defaults));
  const { register, handleSubmit, watch, reset } = useForm<DesiredState>({
    defaultValues: defaults,
  });
  const values = watch();
  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(defaults),
    [values],
  );

  const validate = async (input: unknown) => {
    const result = desiredStateSchema.safeParse(input);
    if (!result.success) {
      setIssues(
        result.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      );
      setValidated(false);
      return;
    }
    await aetherClient.validateDesiredState(result.data);
    setIssues([]);
    setValidated(true);
    setYamlDraft(stringify(result.data));
  };

  const validateYaml = async () => {
    try {
      const parsed = desiredStateSchema.parse(parse(yamlDraft));
      reset(parsed);
      await validate(parsed);
    } catch (error) {
      setValidated(false);
      setIssues([
        error instanceof Error
          ? `YAML: ${error.message}`
          : "YAML does not match the desired-state schema.",
      ]);
    }
  };

  return (
    <div>
      <div className="panel__head" style={{ marginBottom: 16 }}>
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
        <span className="a-badge">
          {dirty
            ? "Unsaved changes"
            : validated
              ? "Schema valid"
              : "Active values"}
        </span>
      </div>
      <ValidationSummary errors={issues} />
      <Tabs value={mode} onValueChange={setMode} tabs={[]}>
        <TabContent value="form">
          <form
            className="settings-form a-card"
            onSubmit={handleSubmit((input) => void validate(input))}
          >
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
                  <option value="base-sepolia">Base Sepolia</option>
                  <option value="ethereum-sepolia">Ethereum Sepolia</option>
                </Select>
              </Field>
              <Field label="Chain ID">
                <Input
                  type="number"
                  {...register("chainId", { valueAsNumber: true })}
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Contract resource">
                <Input {...register("contractId")} />
              </Field>
              <Field label="Contract version">
                <Input {...register("contractVersion")} />
              </Field>
            </div>
            <Field label="Approved implementation address">
              <Input className="mono" {...register("implementationAddress")} />
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
            <div className="form-row">
              <Field
                label="Protocol fee"
                hint={`${values.fee.value} basis points`}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px",
                    gap: 8,
                  }}
                >
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px",
                    gap: 8,
                  }}
                >
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px",
                  gap: 8,
                }}
              >
                <Input {...register("maximumAutomaticTransaction.value")} />
                <Select {...register("maximumAutomaticTransaction.unit")}>
                  <option value="ether">ETH</option>
                </Select>
              </div>
            </Field>
            <Field label="Source">
              <Input {...register("source")} />
            </Field>
            <label className="a-field">
              <span className="a-field__label">Emergency state</span>
              <span className="context-strip">
                <input type="checkbox" {...register("paused")} />
                Pause protocol in desired state
              </span>
            </label>
            <div className="page-actions">
              <Button type="submit">Validate draft</Button>
              <Button
                variant="primary"
                disabled={!validated}
                onClick={() => setSaved(true)}
              >
                Save new version
              </Button>
            </div>
          </form>
        </TabContent>
        <TabContent value="code">
          <div className="settings-form a-card">
            <Field
              label="Canonical YAML"
              hint="Form and code modes use the same browser-safe Zod schema."
            >
              <Textarea
                className="mono"
                rows={28}
                value={yamlDraft}
                onChange={(event) => {
                  setYamlDraft(event.target.value);
                  setValidated(false);
                }}
              />
            </Field>
            <Button variant="primary" onClick={() => void validateYaml()}>
              Validate YAML
            </Button>
          </div>
        </TabContent>
      </Tabs>
      <div style={{ marginTop: 16 }}>
        <DiffBlock
          before={
            "version: v2.4.1\noracleAddress: 0x2C8A…44311\nminimumExecutorGas: 0.08 ETH"
          }
          after={`version: ${values.version}\noracleAddress: ${values.oracleAddress.slice(0, 12)}…\nminimumExecutorGas: ${values.minimumExecutorGas.value} ETH`}
        />
      </div>
      <ToastRegion
        message={
          saved ? "Desired state version saved in mock mode." : undefined
        }
      />
    </div>
  );
}
