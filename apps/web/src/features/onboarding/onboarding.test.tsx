import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { Onboarding } from "./onboarding";
import { useUiStore } from "@/stores/ui";

describe("onboarding", () => {
  beforeEach(() => useUiStore.setState({ onboardingStep: 0 }));
  it("progresses and resumes from persisted step state", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Onboarding />);
    expect(screen.getByText("Set up organization.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Set up protocol source.")).toBeVisible();
    unmount();
    render(<Onboarding />);
    expect(screen.getByText("Set up protocol source.")).toBeVisible();
  });
});
