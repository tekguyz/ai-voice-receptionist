import { defineConfig, devices } from "@playwright/test";

// CI only (global rule): one end-to-end file, against the built app.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: false, timeout: 120_000 },
});
