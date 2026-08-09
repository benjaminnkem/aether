import { expect, test } from "@playwright/test";
test.describe("@visual production surfaces", () => {
  test.use({ reducedMotion: "reduce", colorScheme: "light" });
  for (const [name, path] of [
    ["landing", "/"],
    ["login", "/login"],
    ["demo", "/demo"],
  ] as const)
    test(name, async ({ page }) => {
      if (path === "/demo")
        await page.route("**/v1/demo/scenarios", (route) =>
          route.fulfill({
            json: { liveExecutionEnabled: false, replays: [], scenarios: [] },
          }),
        );
      await page.goto(path);
      await page.addStyleTag({
        content:
          "nextjs-portal{display:none!important}.hero-particles{display:none!important}",
      });
      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
        animations: "disabled",
      });
    });
});
