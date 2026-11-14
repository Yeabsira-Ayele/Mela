import { defineConfig } from "@playwright/test";

const browserChannel = process.env.A11Y_BROWSER_CHANNEL;

export default defineConfig({
  testDir: ".",
  testMatch: "a11y.spec.js",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 180_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    ...(browserChannel ? { channel: browserChannel } : {})
  },
  webServer: {
    command: "node server.js",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
