import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DesiredStateEditor from "./desired-state-editor";
import { aetherClient } from "@aether/sdk";

describe("desired state editor", () => {
  async function fillValidDraft(user: ReturnType<typeof userEvent.setup>) {
    const values: Array<[string, string]> = [
      ["Release provenance", "v1.0.0"],
      ["Contract resource", "market"],
      ["Contract version", "1.0.0"],
      [
        "Approved implementation address",
        "0x1111111111111111111111111111111111111111",
      ],
      ["Approved oracle address", "0x2222222222222222222222222222222222222222"],
      ["Administrator", "0x3333333333333333333333333333333333333333"],
      ["Guardian", "0x4444444444444444444444444444444444444444"],
      ["Source", "github:owner/repository@0123456789abcdef"],
    ];
    for (const [label, value] of values) {
      const input = screen.getByLabelText(label);
      await user.clear(input);
      await user.type(input, value);
    }
  }

  it("validates form values through the shared schema and SDK", async () => {
    const validate = vi
      .spyOn(aetherClient, "validateDesiredState")
      .mockImplementation(async (value) => value);
    const user = userEvent.setup();
    render(<DesiredStateEditor />);
    await fillValidDraft(user);
    await user.click(screen.getByRole("button", { name: "Validate draft" }));
    await waitFor(() => expect(validate).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: "Save new version" }),
    ).toBeEnabled();
  });

  it("reports ambiguous invalid units and addresses", async () => {
    const user = userEvent.setup();
    render(<DesiredStateEditor />);
    await fillValidDraft(user);
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
    await fillValidDraft(user);
    await user.click(screen.getByRole("button", { name: "Validate draft" }));
    const save = await screen.findByRole("button", {
      name: "Save new version",
    });
    expect(save).toBeEnabled();
    await user.type(screen.getByLabelText("Approved oracle address"), "0");
    expect(save).toBeDisabled();
  });

  it("keeps form and YAML validation bound to the same parsed values", async () => {
    const validate = vi
      .spyOn(aetherClient, "validateDesiredState")
      .mockImplementation(async (value) => value);
    const user = userEvent.setup();
    render(<DesiredStateEditor />);
    await fillValidDraft(user);
    await user.click(screen.getByRole("tab", { name: "YAML" }));
    const yaml = screen.getByLabelText("Canonical YAML");
    expect((yaml as HTMLTextAreaElement).value).toContain("chainId: 11155111");
    await user.click(screen.getByRole("button", { name: "Validate YAML" }));
    await waitFor(() => expect(validate).toHaveBeenCalled());
  });
});
