import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/edge",
  testMatch: "**/*.test.ts",
  fullyParallel: false,
  reporter: "list",
});
