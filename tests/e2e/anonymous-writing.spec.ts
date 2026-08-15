import { expect, test } from "@playwright/test";

test("completes and restores the anonymous writing flow", async ({ page }) => {
  await page.goto("/");

  const editor = page.getByLabel("Your entry for today");
  await expect(editor).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "What happened today?" }),
  ).toBeVisible();

  const firstNinetyNineWords = Array.from(
    { length: 99 },
    (_, index) => `memory${index + 1}`,
  ).join(" ");

  await editor.fill(firstNinetyNineWords);
  await expect(page.getByText("99 / 100 words")).toBeVisible();
  await expect(page.getByText("Saving…")).toBeVisible();

  const completedEntry = `${firstNinetyNineWords} finished`;
  await editor.fill(completedEntry);

  await expect(page.getByText("100 / 100 words")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Today is complete." }),
  ).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const storedDraft = await page.evaluate(() => {
    const entryKey = Object.keys(localStorage).find((key) =>
      key.startsWith("365x100:entry:"),
    );

    return entryKey
      ? { key: entryKey, value: localStorage.getItem(entryKey) }
      : null;
  });

  expect(storedDraft?.key).toMatch(/^365x100:entry:\d{4}-\d{2}-\d{2}$/);
  expect(storedDraft?.value).toBe(completedEntry);

  await page.reload();
  await expect(editor).toHaveValue(completedEntry);
  await expect(
    page.getByRole("heading", { name: "Today is complete." }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Save your entry and begin your year" })
    .click();
  await expect(page.getByText("Accounts are coming next.")).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(editor).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What happened today?" }),
  ).toBeVisible();
});
