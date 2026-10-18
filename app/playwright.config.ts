import { defineConfig, devices } from "@playwright/test";

// Point at a deployed URL with: PW_BASE_URL=https://your-deploy.vercel.app npx playwright test
// (skips spinning up the local dev server - there's nothing to build/serve when testing
// a live deployment).
const baseURL = process.env.PW_BASE_URL ?? "http://localhost:5173";
const isRemote = Boolean(process.env.PW_BASE_URL);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(isRemote
    ? {}
    : {
        webServer: {
          command: "npm run dev -- --port 5173 --strictPort",
          url: "http://localhost:5173",
          reuseExistingServer: true,
          timeout: 30_000,
        },
      }),
});
