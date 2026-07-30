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
  await expect(page.getByText("Critical drift", { exact: true })).toBeVisible();
  for (let index = 0; index < 2; index += 1)
    await page
      .getByRole("button", { name: "Advance incident lifecycle" })
      .click();
  await page.goto("/app/operations/op-oracle-restoration");
  await page.getByRole("button", { name: "Approve exact plan" }).click();
  await page.getByRole("button", { name: /Demo controls/ }).click();
  for (let index = 0; index < 3; index += 1)
    await page
      .getByRole("button", { name: "Advance incident lifecycle" })
      .click();
  await page.goto("/app/overview");
  await expect(page.getByText("Protocol aligned")).toBeVisible();
});

test("desired state and mobile operation fallback remain usable", async ({
  page,
}, testInfo) => {
  await page.goto("/app/desired-state");
  await expect(
    page.getByRole("heading", { name: "Desired State" }),
  ).toBeVisible();
  await expect(page.getByLabel("Approved oracle address")).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.goto("/app/operations/op-oracle-restoration");
    await expect(page.locator(".operation-stepper")).toBeVisible();
  }
});

test("onboarding resumes after reload and support states are explicit", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await expect(page.getByText("Set up organization.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.reload();
  await expect(page.getByText("Set up protocol.")).toBeVisible();

  await page.goto("/unauthorized");
  await expect(
    page.getByRole("heading", {
      name: "You do not have access to this protocol.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Aether did not perform")).toBeVisible();
});

test("critical drift drawer separates facts from inference", async ({
  page,
}) => {
  await page.goto("/app/drift");
  await page.getByRole("button", { name: /Demo controls/ }).click();
  await page
    .getByLabel("Select demo scenario")
    .selectOption("unauthorized-oracle");
  await page.getByText("Unauthorized oracle address").first().click();
  await expect(
    page.getByRole("heading", { name: "Observed fact" }),
  ).toBeVisible();
  await expect(page.getByText("Analysis, not proof")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Generate correction plan/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Analysis, not proof")).toBeHidden();
});

for (const scenario of [
  {
    value: "missing-role",
    heading: "Execution requires attention",
    evidence: "No transaction submitted",
  },
  {
    value: "partial-execution",
    heading: "Forward correction required",
    evidence: "confirmed",
  },
  {
    value: "unknown-outcome",
    heading: "Automatic retry is locked",
    evidence: "reconciliation",
  },
] as const) {
  test(`${scenario.value} remains safety preserving`, async ({ page }) => {
    await page.goto("/app/overview");
    await page.getByRole("button", { name: /Demo controls/ }).click();
    await page.getByLabel("Select demo scenario").selectOption(scenario.value);
    await page.goto("/app/executions/exec-kh-8314");
    await expect(page.getByText(scenario.heading)).toBeVisible();
    await expect(
      page.getByText(new RegExp(scenario.evidence, "i")).first(),
    ).toBeVisible();
  });
}

test("audit correlation, legacy redirects, and removed routes are deterministic", async ({
  page,
}) => {
  await page.goto("/app/audit-log");
  await page.getByLabel("Search audit log").fill("KH-8314");
  await expect(page.getByText("KeeperHub workflow updated")).toBeVisible();

  await page.goto("/app/integrations");
  await expect(page).toHaveURL(/\/app\/protocol-setup$/);
  await expect(
    page.getByRole("heading", { name: "Protocol Setup" }),
  ).toBeVisible();

  await page.goto("/app/team");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});

test("reduced motion keeps the static hero fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".hero-field")).toBeVisible();
  await expect(page.locator(".hero-field canvas")).toBeHidden();
});
