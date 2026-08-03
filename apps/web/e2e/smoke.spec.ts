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

test("browser SDK uses the configured API origin", async ({ page }) => {
  const apiBase = process.env.NEXT_PUBLIC_AETHER_API_URL?.replace(/\/$/, "");
  expect(apiBase).toBeTruthy();
  let requestedUrl: string | null = null;
  await page.route(`${apiBase}/auth/login`, async (route) => {
    requestedUrl = route.request().url();
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: "AUTHENTICATION_FAILED" }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Work email").fill("endpoint-check@example.invalid");
  await page.getByLabel("Password").fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect.poll(() => requestedUrl).toBe(`${apiBase}/auth/login`);
});

test("signup creates an authenticated session and continues to onboarding", async ({
  page,
}) => {
  const apiBase = process.env.NEXT_PUBLIC_AETHER_API_URL?.replace(/\/$/, "");
  expect(apiBase).toBeTruthy();
  await page.route(`${apiBase}/auth/signup`, (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        userId: "usr_browser_test",
        email: "new-user@example.invalid",
        accessToken: "browser-test-access-token",
        accessTokenExpiresInSeconds: 900,
        context: {},
      }),
    }),
  );

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Browser Test");
  await page.getByLabel("Work email").fill("new-user@example.invalid");
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
});

test("dashboard returns to sign in when the API denies the session", async ({
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
  await expect(page).toHaveURL(/\/login\?returnTo=/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
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
  await page.route("**/v1/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user: { id: "usr_test", email: "test@example.invalid" },
        context: {
          organizationId: "org_test",
          protocolId: "pro_test",
          role: "owner",
        },
        destination: "dashboard",
      }),
    }),
  );
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
