import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function unlock(page: import("@playwright/test").Page) {
  await page.goto("/agents");
  await page
    .getByLabel("Application access code")
    .fill("browser-test-access-token");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "SAVE WITH A COMPLETE RECORD." }),
  ).toBeVisible();
}

async function unlockLending(page: import("@playwright/test").Page) {
  await page.goto("/?product=lending");
  await expect(page).toHaveURL(/\/agents\?product=lending$/);
  await page
    .getByLabel("Application access code")
    .fill("browser-test-access-token");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", {
      name: "OPEN A LENDING POSITION WITH A COMPLETE RECORD.",
    }),
  ).toBeVisible();
}

test("locked application explains its real execution boundary", async ({
  page,
}) => {
  await page.goto("/agents");
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
  await expect(page).toHaveURL(/\/agents$/);
  await expect(
    page.getByRole("heading", { name: "PUT SAVINGS ON RECORD." }),
  ).toBeVisible();
});

test("@accessibility locked application has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/agents");
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

test("lending query selects lending configuration and mission controls", async ({
  page,
}) => {
  await unlockLending(page);
  await expect(page.getByText("LENDING / AETHER")).toBeVisible();
  await expect(page.getByLabel("Collateral amount")).toHaveValue("10");
  await expect(page.getByLabel("Amount to borrow")).toHaveValue("0.0001");
  await expect(
    page.getByText("0x5555555555555555555555555555555555555555"),
  ).toBeVisible();
  await expect(
    page.getByText("0x6666666666666666666666666666666666666666"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open lending position" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Open lending (blocked borrowing)" }),
  ).toBeDisabled();
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
