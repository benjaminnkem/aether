import { defineConfig, devices } from "@playwright/test";

const port = 3101;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  reporter: "line",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm build && pnpm exec next start --port ${port}`,
    url: `http://127.0.0.1:${port}/savings-app`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      SAVINGS_AETHER_API_URL: "http://127.0.0.1:4000/v1",
      SAVINGS_AETHER_API_KEY: `aeth_${"a".repeat(64)}`,
      SAVINGS_APP_ORIGIN: `http://127.0.0.1:${port}`,
      SAVINGS_APP_ACCESS_TOKEN: "browser-test-access-token",
      SAVINGS_SESSION_SECRET: "browser-test-session-secret-that-is-long-enough",
      SAVINGS_LIVE_EXECUTION_ENABLED: "false",
      SAVINGS_VAULT_ADDRESS: "0x1111111111111111111111111111111111111111",
      SAVINGS_TOKEN_ADDRESS: "0x2222222222222222222222222222222222222222",
      SAVINGS_TOKEN_SYMBOL: "TEST",
      SAVINGS_TOKEN_DECIMALS: "6",
      SAVINGS_MIN_AMOUNT: "1",
      SAVINGS_MAX_AMOUNT: "100",
      SAVINGS_KEEPERHUB_EXECUTOR_ADDRESS:
        "0x3333333333333333333333333333333333333333",
      SAVINGS_EXPLORER_URL: "https://sepolia.etherscan.io",
      SAVINGS_NEXT_DIST_DIR: ".next-e2e",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
