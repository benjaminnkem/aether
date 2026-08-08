import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { Dialog, Drawer, PermissionState, Status } from "@aether/ui";
import { timelineEventContext, timelineStepId } from "./app/views";

describe("Aether design-system interactions", () => {
  it("resolves timeline events to their mission step", () => {
    const steps = [
      { stepRunId: "step-run-1", stepId: "revoke-repayment-approval" },
    ];
    const attempts = [
      { executionAttemptId: "attempt-1", stepRunId: "step-run-1" },
    ];
    expect(
      timelineStepId(
        { data: { stepId: "supply-collateral" } },
        steps,
        attempts,
      ),
    ).toBe("supply-collateral");
    expect(
      timelineStepId(
        { data: { executionAttemptId: "attempt-1" } },
        steps,
        attempts,
      ),
    ).toBe("revoke-repayment-approval");
    expect(timelineStepId({ data: {} }, steps, attempts)).toBeUndefined();
    expect(
      timelineEventContext(
        {
          data: { executionAttemptId: "attempt-1" },
          createdAt: "2026-08-09T00:01:00.000Z",
          state: "ACKNOWLEDGED",
        },
        steps,
        [{ ...attempts[0], planId: "plan-1" }],
        [{ planId: "plan-1", kind: "COMPENSATION" }],
      ),
    ).toEqual({
      phase: "Recovery",
      stepId: "revoke-repayment-approval",
    });
    expect(
      timelineEventContext(
        {
          data: { stepId: "supply-collateral" },
          createdAt: "2026-08-09T00:01:00.000Z",
          state: "VERIFIED",
        },
        steps,
        attempts,
        [],
      ),
    ).toEqual({ phase: "Mission", stepId: "supply-collateral" });
  });

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
          <Drawer open={open} onOpenChange={setOpen} title="Chain evidence">
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
      screen.getByRole("dialog", { name: "Chain evidence" }),
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
