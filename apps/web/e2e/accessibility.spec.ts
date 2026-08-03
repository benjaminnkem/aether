import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { authenticatedSession, dashboardFixture } from "./fixtures/dashboard";

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
}

test("public and product critical surfaces pass automated accessibility checks", async ({
  page,
}) => {
  await page.route("**/v1/auth/session", (route) =>
    route.fulfill({ status: 401 }),
  );
  await page.goto("/");
  await expectNoSeriousViolations(page);

  await page.unroute("**/v1/auth/session");
  await page.route("**/v1/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authenticatedSession),
    }),
  );
  await page.route("**/v1/dashboard**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(dashboardFixture),
    }),
  );
  await page.goto("/app/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expectNoSeriousViolations(page);
});
