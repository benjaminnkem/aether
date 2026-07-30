import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Dialog, PermissionState, Status } from "@aether/ui";

describe("Aether design-system interactions", () => {
  it("opens and closes an accessible dialog", async () => {
    const user = userEvent.setup();
    render(
      <Dialog
        title="Create operation"
        trigger={<button>Open operation</button>}
      >
        <button>Confirm</button>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Open operation" }));
    expect(
      screen.getByRole("dialog", { name: "Create operation" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Create operation" }),
    ).not.toBeInTheDocument();
  });

  it("communicates status and permission with text", () => {
    render(
      <>
        <Status status="failed" />
        <PermissionState action="approve this operation" />
      </>,
    );
    expect(screen.getByText("failed")).toBeVisible();
    expect(screen.getByText(/Read-only permission/)).toBeVisible();
  });
});
