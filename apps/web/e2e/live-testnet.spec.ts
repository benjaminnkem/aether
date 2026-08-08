import { expect, test } from "@playwright/test";
test.describe("live Ethereum Sepolia acceptance", () => {
  test.skip(
    process.env.LIVE_SEPOLIA_TESTS !== "true",
    "Live Sepolia acceptance is explicitly opt-in.",
  );
  test("@live fixed unknown-outcome scenario lands once and continues", async ({
    page,
  }) => {
    test.setTimeout(15 * 60_000);
    await page.goto("/login");
    await page.getByLabel("Email").fill(String(process.env.LIVE_TEST_EMAIL));
    await page
      .getByLabel("Password")
      .fill(String(process.env.LIVE_TEST_PASSWORD));
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("/demo");
    await page
      .getByRole("article")
      .filter({ hasText: "Unknown outcome" })
      .getByRole("button", { name: "Run on Sepolia" })
      .click();
    await expect(page).toHaveURL(/\/demo\/runs\//);
    await expect(page.getByText("Outcome unknown")).toBeVisible({
      timeout: 5 * 60_000,
    });
    await expect(page.getByText(/Original write landed/)).toBeVisible({
      timeout: 10 * 60_000,
    });
    await expect(page.getByText(/duplicate/i)).toHaveCount(0);
  });
});
