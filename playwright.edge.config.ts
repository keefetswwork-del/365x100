import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/edge",
  testMatch: "**/*.test.ts",
  fullyParallel: false,
  // Edge integration tests share one mutable local Supabase stack.
  workers: 1,
  reporter: "list",
});
