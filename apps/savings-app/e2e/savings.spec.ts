import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function unlock(page: import("@playwright/test").Page) {
  await page.goto("/savings-app");
  await page
    .getByLabel("Application access code")
    .fill("browser-test-access-token");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "SAVE WITH A COMPLETE RECORD." }),
  ).toBeVisible();
}

test("locked application explains its real execution boundary", async ({
  page,
}) => {
  await page.goto("/savings-app");
  await expect(
    page.getByRole("heading", { name: "PUT SAVINGS ON RECORD." }),
  ).toBeVisible();
  await expect(
    page.getByText(/never invents transaction evidence/i),
  ).toBeVisible();
  await expect(page.getByLabel("Application access code")).toBeEditable();
});

test("bare application origin redirects to the savings application", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/savings-app$/);
  await expect(
    page.getByRole("heading", { name: "PUT SAVINGS ON RECORD." }),
  ).toBeVisible();
});

test("@accessibility locked application has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/savings-app");
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});

test("live-disabled configuration fails visibly without creating a mission", async ({
  page,
}) => {
  await unlock(page);
  await expect(page.getByText("Live execution disabled")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm and save" }),
  ).toBeDisabled();
  await expect(
    page.getByText("0x1111111111111111111111111111111111111111"),
  ).toBeVisible();
  await expect(
    page.getByText("0x2222222222222222222222222222222222222222"),
  ).toBeVisible();
});

test("@accessibility unlocked setup has no serious accessibility violations", async ({
  page,
}) => {
  await unlock(page);
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});
