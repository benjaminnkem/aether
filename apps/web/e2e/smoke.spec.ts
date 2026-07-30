import { expect, test } from "@playwright/test";

test("marketing and dashboard critical path", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Keep protocols in their intended onchain state.",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Try the live demo/ }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(
    page.getByText("Protocol health", { exact: true }).first(),
  ).toBeVisible();
});

test("oracle incident lifecycle reaches verified health", async ({ page }) => {
  await page.goto("/app/overview");
  await page.getByRole("button", { name: /Demo controls/ }).click();
  await page
    .getByLabel("Select demo scenario")
    .selectOption("unauthorized-oracle");
  await expect(
    page.getByText("Critical drift requires attention"),
  ).toBeVisible();
  for (let index = 0; index < 6; index += 1)
    await page
      .getByRole("button", { name: "Advance incident lifecycle" })
      .click();
  await expect(page.getByText("Protocol is aligned")).toBeVisible();
});

test("desired state and mobile operation fallback remain usable", async ({
  page,
}, testInfo) => {
  await page.goto("/app/protocols/arcadia/desired-state");
  await expect(
    page.getByRole("heading", { name: "Desired state" }),
  ).toBeVisible();
  await expect(page.getByLabel("Approved oracle address")).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.goto("/app/protocols/arcadia/operations");
    await expect(page.locator(".operation-stepper")).toBeVisible();
  }
});
