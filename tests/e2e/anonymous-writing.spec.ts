import { expect, test } from "@playwright/test";

test("uses the canonical website wordmark", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("365x100 — Write today");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Write 100 words a day and preserve the story of your year. Track your progress, revisit your memories, and turn 365 days or each month of writing into a personal chapter.",
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/365x100-icon.png");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/apple-touch-icon.png");
  await expect(page.locator('link[href="/favicon.ico"]')).toHaveCount(0);
  await expect(page.getByText("Private Beta", { exact: true })).toBeVisible();

  const homeLink = page.getByRole("link", { name: "365x100", exact: true });
  await expect(homeLink).toBeVisible();
  await expect(homeLink).toHaveAttribute("href", "#editor");

  const wordmark = homeLink.getByRole("img", { name: "365x100", exact: true });
  const blackText = wordmark.locator('[aria-hidden="true"]');
  const redX = blackText.locator("span");

  await expect(blackText).toHaveText("365x100");
  await expect(blackText).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(redX).toHaveCSS("color", "rgb(255, 49, 49)");
  await expect(wordmark).toHaveCSS("font-weight", "700");
  expect(await wordmark.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("League");

  await homeLink.focus();
  await expect(homeLink).toBeFocused();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(homeLink).toBeVisible();

  await page.goto("/auth/callback");
  await expect(page.getByRole("img", { name: "365x100", exact: true })).toBeVisible();
});

test("completes and restores the anonymous writing flow", async ({ page }) => {
  await page.goto("/");

  const editor = page.getByLabel("Your entry for today");
  await expect(editor).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "What happened today?" }),
  ).toBeVisible();
  const entryDate = page.getByLabel("Entry date", { exact: true });
  await expect(entryDate.locator("time[datetime]")).toBeVisible();
  await expect(entryDate.getByRole("button")).toHaveCount(0);

  const firstNinetyNineWords = Array.from(
    { length: 99 },
    (_, index) => `memory${index + 1}`,
  ).join(" ");

  await editor.fill(firstNinetyNineWords);
  await expect(page.getByText("99 words preserved")).toBeVisible();
  await expect(page.getByText("Saving locally…")).toBeVisible();

  const completedEntry = `${firstNinetyNineWords} finished`;
  await editor.fill(completedEntry);

  await expect(page.getByText("100 words preserved", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "100 words preserved." }),
  ).toBeVisible();
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();

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
  await expect(editor).toHaveText(completedEntry);
  await expect(
    page.getByRole("heading", { name: "100 words preserved." }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Save your entry and begin your year" })
    .click();
  await expect(page.getByRole("dialog", { name: "Begin your year." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  await expect(page.getByLabel(/I accept the Privacy Policy/)).toBeVisible();
  await expect(page.getByLabel(/I accept the Terms of Use/)).toBeVisible();
  await expect(editor).toHaveText(completedEntry);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(editor).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What happened today?" }),
  ).toBeVisible();
});
