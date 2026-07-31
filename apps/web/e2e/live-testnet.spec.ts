import { expect, test } from "@playwright/test";

test.describe("live Base Sepolia acceptance", () => {
  test.skip(
    process.env.LIVE_TESTNET_ACCEPTANCE !== "1",
    "Protected live acceptance is opt-in.",
  );

  test("@live authenticated drift-to-verification lifecycle", async ({
    page,
  }) => {
    test.setTimeout(15 * 60_000);
    const email = process.env.LIVE_TEST_EMAIL;
    const password = process.env.LIVE_TEST_PASSWORD;
    if (!email || !password) throw new Error("Live test account is required.");
    await page.goto("/login");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app\/overview/);
    await page.goto("/app/drift");
    await page.getByRole("button", { name: /Run observation scan/ }).click();
    await expect(page.getByText("Live observation scan queued.")).toBeVisible();
    const finding = page.locator("table tbody tr").first();
    await expect(finding).toBeVisible({ timeout: 2 * 60_000 });
    await finding.click();
    await page.getByRole("button", { name: "Investigate with OpenAI" }).click();
    await expect(page.getByText("OpenAI investigation queued.")).toBeVisible();
    await page
      .getByRole("button", { name: "Generate correction plan" })
      .click();
    await expect(page).toHaveURL(/\/app\/operations\/[^/]+$/);
    await page.getByRole("button", { name: "Simulate exact request" }).click();
    await expect(page.getByText("KeeperHub simulation queued.")).toBeVisible();
    const approve = page.getByRole("button", { name: "Approve exact plan" });
    await expect(approve).toBeVisible({ timeout: 3 * 60_000 });
    await approve.click();
    const execute = page.getByRole("button", {
      name: /Execute with KeeperHub/,
    });
    await expect(execute).toBeVisible({ timeout: 30_000 });
    await execute.click();
    await expect(page).toHaveURL(/\/app\/executions\/[^/]+$/);
    const transactionLink = page.locator(
      'a[href^="https://sepolia.basescan.org/tx/"]',
    );
    await expect(transactionLink).toBeVisible({ timeout: 8 * 60_000 });
    await expect(transactionLink).toHaveAttribute(
      "href",
      /^https:\/\/sepolia\.basescan\.org\/tx\/0x[a-fA-F0-9]{64}$/,
    );
    await page.getByRole("link", { name: "Review audit evidence" }).click();
    await expect(page).toHaveURL(/\/app\/audit-log$/);
  });
});
