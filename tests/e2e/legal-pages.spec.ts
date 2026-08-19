import { expect, test } from "@playwright/test";

test("shows an accessible footer and opens legal pages in new tabs", async ({ page }) => {
  await page.goto("/");

  const footer = page.getByRole("contentinfo");
  const initialBox = await footer.boundingBox();
  expect(initialBox?.y ?? 0).toBeGreaterThan(page.viewportSize()!.height);

  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByText("© 2026 365x100. All rights reserved.", { exact: true })).toBeVisible();

  const privacy = footer.getByRole("link", { name: "Privacy Policy (opens in a new tab)" });
  const terms = footer.getByRole("link", { name: "Terms of Use (opens in a new tab)" });
  const instagram = footer.getByRole("link", { name: "365x100daily on Instagram (opens in a new tab)" });
  const feedback = footer.getByRole("link", { name: "Feedback" });

  await expect(privacy).toHaveAttribute("href", "/privacy");
  await expect(terms).toHaveAttribute("href", "/terms");
  await expect(instagram).toHaveAttribute("href", "https://www.instagram.com/365x100daily/");
  await expect(feedback).toHaveAttribute("href", "mailto:hello@365x100.com?subject=365x100%20beta%20feedback");
  for (const link of [privacy, terms, instagram]) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  }

  expect(parseFloat(await footer.evaluate((element) => getComputedStyle(element).paddingBottom))).toBeGreaterThanOrEqual(112);
  expect((await instagram.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await privacy.focus();
  await expect(privacy).toBeFocused();

  const newTabPromise = page.waitForEvent("popup");
  await privacy.click();
  const legalPage = await newTabPromise;
  await legalPage.waitForLoadState();
  await expect(legalPage).toHaveURL(/\/privacy$/);
  await expect(legalPage.getByRole("heading", { level: 1, name: "365x100 Privacy Policy" })).toBeVisible();
  await legalPage.close();
});

test("renders complete legal documents with section navigation", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page).toHaveTitle("Privacy Policy | 365x100");
  await expect(page.getByText("Effective date: 19 August 2026", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "365x100 Privacy Policy sections" }).getByRole("link")).toHaveCount(13);
  await expect(page.getByRole("heading", { level: 2, name: "6. Storage locations and overseas processing" })).toBeVisible();
  await expect(page.getByRole("link", { name: "hello@365x100.com" }).first()).toHaveAttribute("href", "mailto:hello@365x100.com");
  await expect(page.getByRole("link", { name: "Back to writing" })).toHaveAttribute("href", "/");

  await page.goto("/terms");
  await expect(page).toHaveTitle("Terms of Use | 365x100");
  await expect(page.getByRole("heading", { level: 1, name: "365x100 Private Beta Terms of Use" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "365x100 Private Beta Terms of Use sections" }).getByRole("link")).toHaveCount(13);
  await expect(page.getByRole("link", { name: "365x100 Privacy Policy" })).toHaveAttribute("href", "/privacy");

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("link", { name: "365x100 home" })).toBeVisible();
});
