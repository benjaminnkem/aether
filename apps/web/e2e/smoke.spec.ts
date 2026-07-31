import { expect, test } from "@playwright/test";

test("marketing and real authentication surfaces render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Create your Aether account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeEditable();
  await expect(page.getByLabel("Password")).toBeEditable();
});

test("dashboard fails closed when the API denies the session", async ({
  page,
}) => {
  await page.route("**/v1/dashboard**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: "AUTHENTICATION_REQUIRED" }),
    }),
  );
  await page.goto("/app/overview");
  await expect(
    page.getByText(/live API did not return a valid response/i),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Demo controls/i)).toHaveCount(0);
});

test("mobile and reduced motion keep navigation usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("removed fixed resource URLs do not fabricate records", async ({
  page,
}) => {
  await page.route("**/v1/dashboard**", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ code: "RESOURCE_NOT_FOUND" }),
    }),
  );
  await page.goto("/app/operations/op-oracle-restoration");
  await expect(
    page.getByText(/live API did not return a valid response/i),
  ).toBeVisible({ timeout: 15_000 });
  await page.goto("/app/executions/exec-kh-8314");
  await expect(
    page.getByText(/live API did not return a valid response/i),
  ).toBeVisible({ timeout: 15_000 });
});
