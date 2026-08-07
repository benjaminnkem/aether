import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import DesiredStateEditor from "./desired-state-editor";
import { aetherClient } from "@aether/sdk";

describe("desired state editor", () => {
  function renderEditor() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <DesiredStateEditor />
      </QueryClientProvider>,
    );
  }

  function fillValidDraft() {
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
      const input = screen.getByLabelText(label) as HTMLInputElement;
      fireEvent.change(input, { target: { value } });
    }
  }

  it(
    "validates form values through the shared schema and SDK",
    async () => {
      const validate = vi
        .spyOn(aetherClient, "validateDesiredState")
        .mockImplementation(async (value) => value);
      const user = userEvent.setup();
      renderEditor();
      fillValidDraft();
      await user.click(screen.getByRole("button", { name: "Validate draft" }));
      await waitFor(() => expect(validate).toHaveBeenCalled());
      expect(
        screen.getByRole("button", { name: "Save new version" }),
      ).toBeEnabled();
    },
    15_000,
  );

  it(
    "reports ambiguous invalid units and addresses",
    async () => {
      const user = userEvent.setup();
      renderEditor();
      fillValidDraft();
      const address = screen.getByLabelText(
        "Approved oracle address",
      ) as HTMLInputElement;
      fireEvent.change(address, { target: { value: "not-an-address" } });
      await user.click(screen.getByRole("button", { name: "Validate draft" }));
      expect(screen.getByRole("alert")).toBeVisible();
    },
    15_000,
  );

  it(
    "invalidates an approval-to-save when a validated address changes",
    async () => {
      vi.spyOn(aetherClient, "validateDesiredState").mockImplementation(
        async (value) => value,
      );
      const user = userEvent.setup();
      renderEditor();
      fillValidDraft();
      await user.click(screen.getByRole("button", { name: "Validate draft" }));
      const save = await screen.findByRole("button", {
        name: "Save new version",
      });
      expect(save).toBeEnabled();
      const address = screen.getByLabelText(
        "Approved oracle address",
      ) as HTMLInputElement;
      fireEvent.change(address, {
        target: { value: `${address.value}0` },
      });
      expect(save).toBeDisabled();
    },
    15_000,
  );

  it(
    "keeps form and YAML validation bound to the same parsed values",
    async () => {
      const validate = vi
        .spyOn(aetherClient, "validateDesiredState")
        .mockImplementation(async (value) => value);
      const user = userEvent.setup();
      renderEditor();
      fillValidDraft();
      await user.click(screen.getByRole("tab", { name: "YAML" }));
      const yaml = screen.getByLabelText("Canonical YAML");
      expect((yaml as HTMLTextAreaElement).value).toContain(
        "chainId: 11155111",
      );
      await user.click(screen.getByRole("button", { name: "Validate YAML" }));
      await waitFor(() => expect(validate).toHaveBeenCalled());
    },
    15_000,
  );
});
