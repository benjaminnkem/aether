import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { Dialog, Drawer, PermissionState, Status } from "@aether/ui";

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
    expect(
      screen.getByRole("button", { name: "Open operation" }),
    ).toHaveFocus();
  });

  it("restores focus for a controlled evidence drawer", async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open evidence</button>
          <Drawer open={open} onOpenChange={setOpen} title="Oracle evidence">
            <p>Block-pinned fact</p>
          </Drawer>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Open evidence" });
    await user.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Oracle evidence" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
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
