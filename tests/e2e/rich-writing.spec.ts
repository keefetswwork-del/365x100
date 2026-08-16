import { expect, test } from "@playwright/test";

test("formats and restores an anonymous entry without changing its word count", async ({ page }) => {
  await page.goto("/");
  const editor = page.getByLabel("Your entry for today");
  await expect(editor).toBeEnabled();
  await editor.fill("A bright ordinary day");
  await expect(page.getByText("4 / 100 words")).toBeVisible();

  await editor.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.getByRole("button", { name: "Bold" }).click();
  await expect(editor.locator("strong")).toHaveText("A bright ordinary day");

  await page.getByRole("button", { name: "More" }).click();
  const more = page.getByRole("dialog", { name: "More formatting options" });
  await expect(more).toBeVisible();
  await expect(more.getByLabel("Text style")).toBeVisible();
  await more.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("4 / 100 words")).toBeVisible();
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();

  const saved = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("365x100:entry-rich:"));
    return key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
  });
  expect(saved?.schemaVersion).toBe(1);

  await page.reload();
  await expect(editor).toHaveText("A bright ordinary day");
  await expect(editor.locator("strong")).toHaveText("A bright ordinary day");

  await page.getByRole("button", { name: "About" }).click();
  const about = page.getByRole("dialog", { name: "One hundred words makes today rememberable." });
  await expect(about).toContainText("Monthly and annual digital books");
  await expect(about).toContainText("not available for purchase or generation yet");
  await about.getByRole("button", { name: "Close" }).click();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByLabel("Text style")).toBeVisible();
});
