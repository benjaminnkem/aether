import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
async function clean(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
}
test("public, auth, demo, and flight recorder have no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await clean(page);
  await page.goto("/login");
  await clean(page);
  await page.route("**/v1/demo/scenarios", (route) =>
    route.fulfill({
      json: { liveExecutionEnabled: false, replays: [], scenarios: [] },
    }),
  );
  await page.goto("/demo");
  await clean(page);
});
