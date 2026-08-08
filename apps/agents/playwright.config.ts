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
    url: `http://127.0.0.1:${port}/agents`,
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
      LENDING_LIVE_EXECUTION_ENABLED: "false",
      LENDING_POOL_ADDRESS: "0x5555555555555555555555555555555555555555",
      LENDING_COLLATERAL_TOKEN_ADDRESS:
        "0x6666666666666666666666666666666666666666",
      LENDING_COLLATERAL_SYMBOL: "USDC",
      LENDING_COLLATERAL_DECIMALS: "6",
      LENDING_MIN_COLLATERAL: "10",
      LENDING_MAX_COLLATERAL: "100",
      LENDING_BORROW_TOKEN_ADDRESS:
        "0x7777777777777777777777777777777777777777",
      LENDING_BORROW_SYMBOL: "WETH",
      LENDING_BORROW_DECIMALS: "18",
      LENDING_BORROW_AMOUNT: "0.0001",
      LENDING_MIN_BORROW: "0.00001",
      LENDING_MAX_BORROW: "0.001",
      LENDING_ATOKEN_ADDRESS: "0x8888888888888888888888888888888888888888",
      LENDING_VARIABLE_DEBT_TOKEN_ADDRESS:
        "0x9999999999999999999999999999999999999999",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
