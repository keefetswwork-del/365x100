import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/unit",
  testMatch: "**/*.test.ts",
  reporter: "list",
});
