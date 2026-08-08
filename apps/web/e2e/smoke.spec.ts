import { expect, test, type Page } from "@playwright/test";

async function authenticate(page: Page) {
  await page.context().addCookies([
    {
      name: "aether_access",
      value: "browser-test",
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
test("landing and authentication use production copy", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /KNOW WHAT LANDED/ }),
  ).toBeVisible();
  await expect(page.getByText(/AI-powered|self-healing/i)).toHaveCount(0);
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: /Create your workspace account/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeEditable();
});
test("protected routes require the secure session cookie", async ({ page }) => {
  await page.goto("/app/overview");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
});
test("all primary routes render on desktop and mobile", async ({ page }) => {
  await authenticate(page);
  await page.route("**/v1/missions", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/v1/approvals", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/v1/audit", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  for (const path of [
    "/app/overview",
    "/app/missions",
    "/app/missions/new",
    "/app/approvals",
    "/app/audit",
    "/app/settings/integrations",
    "/app/settings/api-keys",
    "/app/settings/policy",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
test("mission control shows mission dates and complete transaction evidence", async ({
  page,
}) => {
  await authenticate(page);
  const transactionHash = `0x${"4".repeat(64)}`;
  await page.route("**/v1/missions", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            missionId: "mission_dates",
            name: "Savings mission",
            description: "Deposit and verify.",
            createdAt: "2026-08-08T10:00:00.000Z",
          },
        ],
      },
    }),
  );
  await page.goto("/app/missions");
  await expect(page.getByText(/Created .*2026/)).toBeVisible();

  await page.route("**/v1/runs/run_evidence**", (route) => {
    if (route.request().url().includes("/stream")) {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "",
      });
    }
    return route.fulfill({
      json: {
        runId: "run_evidence",
        state: "RECOVERED",
        stateReason: "Safe state independently verified.",
        objective: "Deposit and verify.",
        createdAt: "2026-08-08T10:01:00.000Z",
        startedAt: "2026-08-08T10:01:01.000Z",
        updatedAt: "2026-08-08T10:05:00.000Z",
        terminalAt: "2026-08-08T10:05:00.000Z",
        steps: [
          {
            stepRunId: "step_run_1",
            stepId: "revoke",
            state: "VERIFIED",
            executionAttemptIds: ["attempt_1"],
            observationIds: ["observation_1"],
          },
        ],
        reconciliation: [],
        transactionEvidence: [
          {
            transactionHash,
            explorerUrl: `https://sepolia.etherscan.io/tx/${transactionHash}`,
            providerTransactionLink: `https://provider.example/tx/${transactionHash}`,
            keeperHubExecutionId: "keeper_execution_1",
            stepId: "revoke",
            kind: "COMPENSATION",
            status: "CONFIRMED",
            createdAt: "2026-08-08T10:03:00.000Z",
          },
        ],
      },
    });
  });
  await page.goto("/app/runs/run_evidence");
  await expect(page.getByText("keeper_execution_1")).toBeVisible();
  await expect(page.getByText("Execution attempts")).toBeVisible();
  await expect(page.getByText("1").first()).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: /View transaction .* on Sepolia Etherscan/,
    }),
  ).toHaveAttribute(
    "href",
    `https://sepolia.etherscan.io/tx/${transactionHash}`,
  );
  await expect(
    page.getByRole("link", { name: "Open KeeperHub-provided link ↗" }),
  ).toHaveAttribute("href", `https://provider.example/tx/${transactionHash}`);
});
test("demo replay is explicitly labeled and never invents evidence", async ({
  page,
}) => {
  await page.route("**/v1/demo/scenarios", (route) =>
    route.fulfill({
      json: {
        liveExecutionEnabled: false,
        scenarios: ["HAPPY_PATH", "PARTIAL_FAILURE", "UNKNOWN_OUTCOME"],
        replays: [],
      },
    }),
  );
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: /See every write/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/will not fabricate transaction evidence/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Live execution disabled" }),
  ).toHaveCount(3);
});

test("live demo opens its isolated flight recorder with the view token", async ({
  page,
}) => {
  await page.route("**/v1/demo/scenarios", (route) =>
    route.fulfill({
      json: {
        liveExecutionEnabled: true,
        launchToken: "launch-token-that-is-long-enough-for-the-demo-route",
        scenarios: ["HAPPY_PATH", "PARTIAL_FAILURE", "UNKNOWN_OUTCOME"],
        replays: [],
      },
    }),
  );
  await page.route("**/v1/demo/runs", async (route) => {
    expect(route.request().method()).toBe("POST");
    await route.fulfill({
      json: {
        runId: "run_demo_browser",
        scenario: "HAPPY_PATH",
        live: true,
        viewToken: "view-token-for-run-demo-browser",
      },
    });
  });
  await page.route("**/v1/demo/runs/run_demo_browser**", async (route) => {
    expect(route.request().headers()["x-demo-run-token"]).toBe(
      "view-token-for-run-demo-browser",
    );
    if (route.request().url().includes("/stream")) {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'event: boundary\ndata: {"runId":"run_demo_browser","state":"COMPLETED"}\n\n',
      });
      return;
    }
    await route.fulfill({
      json: {
        runId: "run_demo_browser",
        state: "COMPLETED",
        stateReason: "Every fixed write was independently verified.",
        objective: "Complete the fixed Sepolia demonstration.",
        steps: [],
        reconciliation: [],
      },
    });
  });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Run on Sepolia" }).first().click();
  await expect(page).toHaveURL(/\/demo\/runs\/run_demo_browser$/);
  await expect(
    page.getByRole("heading", { name: "run_demo_browser" }),
  ).toBeVisible();
  await expect(page.getByText("undefined", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Invalid Date", { exact: true })).toHaveCount(0);
});
