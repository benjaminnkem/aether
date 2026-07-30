"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { parse, stringify } from "yaml";
import { desiredStateSchema, type DesiredState } from "@aether/shared";
import {
  Button,
  CodeBlock,
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

const defaults: DesiredState = {
  version: "v2.4.2",
  chainId: 84532,
  oracle: "0x2C8A7E78B8d6909A2171B8449A3C1b8D64f44311",
  heartbeatSeconds: 1800,
  fee: { value: "50", unit: "bps" },
  release: "arcadia-v2.4.2",
};
export default function DesiredStateEditor() {
  const [mode, setMode] = useState("form");
  const [errors, setErrors] = useState<string[]>([]);
  const [valid, setValid] = useState(false);
  const { register, handleSubmit, watch, setValue } = useForm<DesiredState>({
    defaultValues: defaults,
  });
  const values = watch();
  const yaml = stringify(values);
  const validate = async (input: DesiredState) => {
    const result = desiredStateSchema.safeParse(input);
    if (!result.success) {
      setErrors(
        result.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      );
      setValid(false);
      return;
    }
    await aetherClient.validateDesiredState(result.data);
    setErrors([]);
    setValid(true);
  };
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 15,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Tabs
          value={mode}
          onValueChange={setMode}
          tabs={[
            { value: "form", label: "Form" },
            { value: "code", label: "YAML" },
          ]}
        >
          <span />
        </Tabs>
        <span className="a-badge">
          {valid ? "Schema valid" : "Draft not validated"}
        </span>
      </div>
      <ValidationSummary errors={errors} />
      <Tabs value={mode} onValueChange={setMode} tabs={[]}>
        <TabContent value="form">
          <form
            className="settings-form a-card"
            onSubmit={handleSubmit(validate)}
          >
            <div className="form-row">
              <Field label="Manifest version">
                <Input {...register("version")} />
              </Field>
              <Field label="Chain ID">
                <Input
                  type="number"
                  {...register("chainId", { valueAsNumber: true })}
                />
              </Field>
            </div>
            <Field label="Approved oracle address">
              <Input className="mono" {...register("oracle")} />
            </Field>
            <div className="form-row">
              <Field
                label="Oracle heartbeat (seconds)"
                hint="Preview: 30 minutes"
              >
                <Input
                  type="number"
                  {...register("heartbeatSeconds", { valueAsNumber: true })}
                />
              </Field>
              <Field label="Fee value and canonical unit">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 110px",
                    gap: 8,
                  }}
                >
                  <Input {...register("fee.value")} />
                  <Select {...register("fee.unit")}>
                    <option value="bps">basis points</option>
                    <option value="wei">wei</option>
                    <option value="gwei">gwei</option>
                    <option value="ether">ether</option>
                  </Select>
                </div>
              </Field>
            </div>
            <Field label="Release provenance">
              <Input {...register("release")} />
            </Field>
            <Button type="submit" variant="primary">
              Validate draft
            </Button>
          </form>
        </TabContent>
        <TabContent value="code">
          <div className="settings-form a-card">
            <Field
              label="Canonical YAML"
              hint="Form and code mode share one runtime schema."
            >
              <Textarea
                className="mono"
                value={yaml}
                rows={15}
                onChange={(event) => {
                  try {
                    const parsed = desiredStateSchema.parse(
                      parse(event.target.value),
                    );
                    Object.entries(parsed).forEach(([key, value]) =>
                      setValue(key as keyof DesiredState, value as never),
                    );
                    setErrors([]);
                  } catch {
                    setErrors([
                      "YAML does not match the desired-state schema.",
                    ]);
                  }
                }}
              />
            </Field>
            <Button variant="primary" onClick={() => void validate(values)}>
              Validate YAML
            </Button>
          </div>
        </TabContent>
      </Tabs>
      <div style={{ marginTop: 16 }}>
        <DiffBlock
          before={"oracle: 0x2C8A…44311\nrelease: arcadia-v2.4.1"}
          after={`oracle: ${values.oracle.slice(0, 10)}…\nrelease: ${values.release}`}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <CodeBlock code={yaml} />
      </div>
    </div>
  );
}
