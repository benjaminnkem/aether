import { expect, test, type Page } from "@playwright/test";
import {
  authenticatedSession,
  dashboardFixture,
  githubDesiredStateFixture,
} from "./fixtures/dashboard";

async function installProductRoutes(page: Page) {
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
  await page.route("**/v1/github/repositories", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          full_name: "benjaminnkem/aether",
          default_branch: "main",
          private: false,
          html_url: "https://github.com/benjaminnkem/aether",
        },
      ]),
    }),
  );
  await page.route("**/v1/github/desired-state-source", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(githubDesiredStateFixture),
    }),
  );
}

async function hideDevelopmentChrome(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

test.describe("@visual visual baselines", () => {
  test.use({ colorScheme: "dark", reducedMotion: "reduce" });

  test("marketing landing", async ({ page }) => {
    await page.route("**/v1/auth/session", (route) =>
      route.fulfill({ status: 401 }),
    );
    await page.goto("/");
    await hideDevelopmentChrome(page);
    await expect(page).toHaveScreenshot("landing.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("authentication", async ({ page }) => {
    await page.route("**/v1/auth/session", (route) =>
      route.fulfill({ status: 401 }),
    );
    await page.goto("/login");
    await hideDevelopmentChrome(page);
    await expect(page).toHaveScreenshot("login.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  for (const [name, route] of [
    ["overview", "/app/overview"],
    ["protocol-setup", "/app/protocol-setup?tab=github"],
    ["desired-state", "/app/desired-state"],
    ["drift", "/app/drift"],
    ["operation", "/app/operations/operation-1"],
    ["execution", "/app/executions/execution-1"],
    ["audit", "/app/audit-log"],
  ] as const) {
    test(name, async ({ page }) => {
      await installProductRoutes(page);
      await page.goto(route);
      await hideDevelopmentChrome(page);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
        animations: "disabled",
      });
    });
  }
});
