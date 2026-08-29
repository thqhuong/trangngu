import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const localApiPort = process.env.PLAYWRIGHT_API_PORT ?? "8787";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.pw.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: externalBaseURL ?? `http://127.0.0.1:${localApiPort}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run build && npm start",
        url: `http://127.0.0.1:${localApiPort}/api/health`,
        env: {
          NODE_ENV: "production",
          PORT: localApiPort,
          ADMIN_DASHBOARD_TOKEN: "e2e-owner-access-key-that-is-safe-and-local",
        },
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
