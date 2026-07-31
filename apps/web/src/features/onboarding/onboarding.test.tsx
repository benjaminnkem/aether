import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Onboarding } from "./onboarding";

describe("onboarding", () => {
  it("starts with honest empty persisted-record fields", () => {
    render(<Onboarding />);
    expect(screen.getByText("Create your operating context.")).toBeVisible();
    expect(screen.getByLabelText("Organization name")).toHaveValue("");
    expect(screen.getByLabelText("Protocol name")).toHaveValue("");
    expect(
      screen.getByRole("button", {
        name: "Create organization and protocol",
      }),
    ).toBeVisible();
    expect(screen.queryByText(/Arcadia/i)).not.toBeInTheDocument();
  });
});
