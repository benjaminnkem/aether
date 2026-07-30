import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DesiredStateEditor from "./desired-state-editor";
import { aetherClient } from "@aether/sdk";

describe("desired state editor", () => {
  it("validates form values through the shared schema and SDK", async () => {
    vi.spyOn(aetherClient, "validateDesiredState").mockImplementation(
      async (value) => value,
    );
    const user = userEvent.setup();
    render(<DesiredStateEditor />);
    await user.click(screen.getByRole("button", { name: "Validate draft" }));
    expect(await screen.findByText("Schema valid")).toBeVisible();
  });

  it("reports ambiguous invalid units and addresses", async () => {
    const user = userEvent.setup();
    render(<DesiredStateEditor />);
    const address = screen.getByLabelText("Approved oracle address");
    await user.clear(address);
    await user.type(address, "not-an-address");
    await user.click(screen.getByRole("button", { name: "Validate draft" }));
    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("invalidates an approval-to-save when a validated address changes", async () => {
    vi.spyOn(aetherClient, "validateDesiredState").mockImplementation(
      async (value) => value,
    );
    const user = userEvent.setup();
    render(<DesiredStateEditor />);
    await user.click(screen.getByRole("button", { name: "Validate draft" }));
    const save = await screen.findByRole("button", {
      name: "Save new version",
    });
    expect(save).toBeEnabled();
    await user.type(screen.getByLabelText("Approved oracle address"), "0");
    expect(save).toBeDisabled();
  });

  it("keeps form and YAML validation bound to the same parsed values", async () => {
    vi.spyOn(aetherClient, "validateDesiredState").mockImplementation(
      async (value) => value,
    );
    const user = userEvent.setup();
    render(<DesiredStateEditor />);
    await user.click(screen.getByRole("tab", { name: "YAML" }));
    const yaml = screen.getByLabelText("Canonical YAML");
    expect((yaml as HTMLTextAreaElement).value).toContain("chainId: 84532");
    await user.click(screen.getByRole("button", { name: "Validate YAML" }));
    expect(await screen.findByText("Schema valid")).toBeVisible();
  });
});
