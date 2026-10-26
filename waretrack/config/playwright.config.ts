import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../tests",
  testMatch: "**/*.e2e.ts",
  timeout: 45000,
  workers: 1,
  reporter: "list",
  outputDir: "../docs/test-results",
  use: {
    baseURL: "http://127.0.0.1:5180",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined,
      args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    screenshot: "only-on-failure",
  },
  webServer: { command: "npm run dev", url: "http://127.0.0.1:5180", reuseExistingServer: true, timeout: 30000 },
});
