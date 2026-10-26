import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../tests",
  testMatch: "*.e2e.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5190",
    headless: true,
    launchOptions: { executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] },
    viewport: { width: 1536, height: 1050 },
  },
  reporter: "list",
});
