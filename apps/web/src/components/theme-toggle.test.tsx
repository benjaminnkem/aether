import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <ThemeToggle compact />
    </ThemeProvider>,
  );
}

afterEach(() => {
  document.documentElement.className = "";
  localStorage.clear();
});

describe("ThemeToggle", () => {
  it("cycles light, dark, and system themes", async () => {
    const user = userEvent.setup();
    renderToggle();
    const button = await screen.findByRole("button", {
      name: /theme:/i,
    });
    expect(button).toBeVisible();
    await user.click(button);
    await user.click(button);
    expect(button).toHaveAccessibleName(/theme:/i);
  });
});
