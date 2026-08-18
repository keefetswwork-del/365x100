import { expect, test, type Page } from "@playwright/test";

const SELECT_ALL = process.platform === "darwin" ? "Meta+A" : "Control+A";

async function openDesktopEditor(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const editor = page.getByLabel("Your entry for today");
  await expect(editor).toBeEnabled();
  return editor;
}

test("formats and restores an anonymous entry without changing its word count", async ({ page }) => {
  await page.goto("/");
  const editor = page.getByLabel("Your entry for today");
  await expect(editor).toBeEnabled();
  await editor.fill("A bright ordinary day");
  await expect(page.getByText("4 words preserved")).toBeVisible();

  await editor.press(SELECT_ALL);
  await page.getByRole("button", { name: "Bold" }).click();
  await expect(editor.locator("strong")).toHaveText("A bright ordinary day");
  await expect(page.getByText("Bold applied to selected text.")).toBeVisible();

  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) =>
      item.startsWith("365x100:entry-rich:"),
    );
    return key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
  });
  expect(saved?.schemaVersion).toBe(1);

  await page.reload();
  await expect(editor).toHaveText("A bright ordinary day");
  await expect(editor.locator("strong")).toHaveText("A bright ordinary day");

  await page.getByRole("button", { name: "About" }).click();
  const about = page.getByRole("dialog", {
    name: "Write at least 100 words every day and preserve the story of your year.",
  });
  await expect(about).toContainText("365 days. 100 words a day. Your year in writing.");
  await expect(about.getByRole("heading", { name: "Write today" })).toBeVisible();
  await expect(about.getByText("No fixed agenda. Write about anything, reach 100 words, or keep going when the day has more to say.", { exact: true })).toBeVisible();
  await expect(about.getByRole("heading", { name: "Gather a month" })).toBeVisible();
  await expect(about.getByText("Daily pages become a monthly digital storybook of moments, turning points, and people worth remembering.", { exact: true })).toBeVisible();
  await expect(about.getByRole("heading", { name: "Hold a year" })).toBeVisible();
  await expect(about.getByText("The vision is an annual digital book, with an optional hardcopy you can keep or share.", { exact: true })).toBeVisible();
  await expect(about.getByText("In development", { exact: true })).toHaveCount(2);
  await expect(about.getByText("Coming later", { exact: true })).toHaveCount(0);
  await expect(about.getByText("How it works", { exact: true })).toBeVisible();
  await expect(about.getByRole("heading", { name: "Start with today." })).toBeVisible();
  await expect(about).toContainText("Your draft saves as you write, whatever its length.");
  await expect(about).toContainText("Return whenever you are ready and preserve another memory.");
  await expect(about.getByText("About your books", { exact: true })).toBeVisible();
  await expect(about).toContainText("at least 10 distinct days, regardless of entry length");
  await expect(about).toContainText("fewer than 10 writing days remain safely in your journal");
  await expect(about).toContainText("365 days beginning with your first saved entry");
  await expect(about.getByText("Target: end Q2 2027", { exact: true })).toBeVisible();
  await expect(about.getByText("Target: end Q4 2027", { exact: true })).toBeVisible();
  await expect(about.getByRole("button", { name: "Close" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(about).toBeHidden();
  await page.getByRole("button", { name: "About" }).click();
  await page.mouse.click(5, 5);
  await expect(about).toBeHidden();
});

test("keeps the editor wide for long prompts and responsive at smaller widths", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const editorSection = page.locator("#editor");
  const editor = page.getByLabel("Your entry for today");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(editor).toBeEnabled();

  const initialWidth = await editorSection.evaluate((element) => element.getBoundingClientRect().width);
  await heading.evaluate((element) => {
    element.textContent = "What recent conversation deserves a place in your year?";
  });
  const longPromptWidth = await editorSection.evaluate((element) => element.getBoundingClientRect().width);
  const editorWidth = await editor.evaluate((element) => element.getBoundingClientRect().width);

  expect(initialWidth).toBeGreaterThan(650);
  expect(Math.abs(longPromptWidth - initialWidth)).toBeLessThanOrEqual(1);
  expect(editorWidth).toBeGreaterThan(longPromptWidth - 80);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);

  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const responsiveWidth = await editorSection.evaluate((element) => element.getBoundingClientRect().width);
    expect(responsiveWidth).toBeLessThanOrEqual(viewport.width);
    expect(responsiveWidth).toBeGreaterThan(viewport.width - 80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
});

test("preserves one selection through every inline, typography, palette, and alignment control", async ({ page }) => {
  const editor = await openDesktopEditor(page);
  await editor.fill("alpha beta gamma");
  await editor.press(SELECT_ALL);

  for (const label of ["Bold", "Italic", "Underline", "Strikethrough"]) {
    await page.getByRole("button", { name: label }).click();
    await expect(page.getByRole("button", { name: label })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }

  await page.getByLabel("Font", { exact: true }).selectOption({ label: "Manrope" });
  for (const size of ["Small", "Regular", "Large"]) {
    await page.getByLabel("Font size").selectOption({ label: size });
  }

  for (const label of ["Ink", "Terracotta", "Forest", "Blue"]) {
    await page.getByRole("button", { name: `${label} text` }).click();
    await expect(
      page.getByRole("button", { name: `${label} text` }),
    ).toHaveAttribute("aria-pressed", "true");
  }

  for (const label of ["Peach", "Sun", "Sage", "Sky"]) {
    await page.getByRole("button", { name: `${label} highlight` }).click();
    await expect(
      page.getByRole("button", { name: `${label} highlight` }),
    ).toHaveAttribute("aria-pressed", "true");
  }

  for (const alignment of ["center", "right", "justify", "left"]) {
    const button = page.getByRole("button", { name: `Align ${alignment}` });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }

  const text = editor.locator("[data-lexical-text=true]");
  await expect(text).toHaveClass(/font-bold/);
  await expect(text).toHaveClass(/italic/);
  await expect(text).toHaveClass(/underline/);
  await expect(text).toHaveClass(/line-through/);
  await expect(text).toHaveAttribute("style", /font-family: var\(--font-manrope\)/);
  await expect(text).toHaveAttribute("style", /font-size: 1\.2em/);
  await expect(text).toHaveAttribute("style", /color: rgb\(48, 79, 115\)/);
  await expect(text).toHaveAttribute(
    "style",
    /background-color: rgb\(220, 233, 245\)/,
  );
  await expect(page.getByLabel("Font size")).toHaveValue("1.2em");
  await expect(page.getByText("3 words preserved")).toBeVisible();
});

test("applies every block, list, indentation, alignment, and clear-formatting command", async ({ page }) => {
  const editor = await openDesktopEditor(page);
  await editor.fill("Structure me");
  await editor.press(SELECT_ALL);

  const textStyle = page.getByLabel("Text style");
  await textStyle.selectOption("title");
  await expect(editor.locator("h2")).toHaveText("Structure me");
  await textStyle.selectOption("subtitle");
  await expect(editor.locator("h3")).toHaveText("Structure me");
  await textStyle.selectOption("quote");
  await expect(editor.locator("blockquote")).toHaveText("Structure me");
  await textStyle.selectOption("paragraph");
  await expect(editor.locator("p")).toHaveText("Structure me");

  await page.getByRole("button", { name: "Bold" }).click();
  await page.getByRole("button", { name: "Bulleted list" }).click();
  await expect(editor.locator("ul")).toHaveCount(1);
  await page.getByRole("button", { name: "Numbered list" }).click();
  await expect(editor.locator("ol")).toHaveCount(1);

  await page.getByRole("button", { name: "Increase indent" }).click();
  await expect(editor.locator("li.rich-editor-nested-list")).toHaveCount(1);
  await page.getByRole("button", { name: "Decrease indent" }).click();
  await expect(editor.locator("li.rich-editor-nested-list")).toHaveCount(0);

  await page.getByRole("button", { name: "Align right" }).click();
  await expect(editor.locator("li")).toHaveAttribute("style", /text-align: right/);
  await page.getByRole("button", { name: "Clear formatting" }).click();
  await expect(editor.locator("p")).toHaveText("Structure me");
  await expect(editor.locator("ul, ol, strong, a")).toHaveCount(0);
  await expect(editor.locator("p")).not.toHaveAttribute("style", /text-align/);
  await expect(page.getByText("2 words preserved")).toBeVisible();
});

test("requires selected text for safe links and restores linked content", async ({ page }) => {
  const editor = await openDesktopEditor(page);
  await editor.fill("linked words");
  await page.getByRole("button", { name: "Add link" }).click();
  await expect(page.getByText("Select text to add a link.")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Link settings" })).toBeHidden();

  await editor.press(SELECT_ALL);
  await page.getByRole("button", { name: "Add link" }).click();
  const linkDialog = page.getByRole("dialog", { name: "Link settings" });
  await linkDialog.getByLabel("Web address").fill("javascript:alert(1)");
  await linkDialog.getByRole("button", { name: "Add link" }).click();
  await expect(linkDialog.getByRole("alert")).toHaveText(
    "Enter a valid web address.",
  );

  await linkDialog.getByLabel("Web address").fill("example.com");
  await linkDialog.getByRole("button", { name: "Add link" }).click();
  await expect(editor.locator("a")).toHaveAttribute("href", "https://example.com");
  await expect(page.getByText("2 words preserved")).toBeVisible();
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();

  await page.reload();
  await expect(editor.locator("a")).toHaveAttribute("href", "https://example.com");
  await editor.press(SELECT_ALL);
  await page.getByRole("button", { name: "Clear formatting" }).click();
  await expect(editor.locator("a")).toHaveCount(0);

  await editor.press(SELECT_ALL);
  await page.getByRole("button", { name: "Add link" }).click();
  await page
    .getByRole("dialog", { name: "Link settings" })
    .getByLabel("Web address")
    .fill("example.com");
  await page
    .getByRole("dialog", { name: "Link settings" })
    .getByRole("button", { name: "Add link" })
    .click();
  await editor.press(SELECT_ALL);
  await page.getByRole("button", { name: "Add link" }).click();
  await page
    .getByRole("dialog", { name: "Link settings" })
    .getByRole("button", { name: "Remove link" })
    .click();
  await expect(editor.locator("a")).toHaveCount(0);
  await expect(editor).toHaveText("linked words");
});

test("inserts emoji at the saved caret and supports collapsed formatting with undo and redo", async ({ page }) => {
  const editor = await openDesktopEditor(page);
  await editor.fill("hello world");
  await editor.press("Home");
  for (let index = 0; index < 5; index += 1) {
    await editor.press("ArrowRight");
  }

  await page.getByRole("button", { name: "Insert emoji" }).click();
  await page.getByRole("button", { name: "grinning face", exact: true }).click();
  await expect(editor).toHaveText("hello😀 world");
  await expect(page.getByText("2 words preserved")).toBeVisible();

  await editor.press("End");
  await page.getByRole("button", { name: "Bold" }).click();
  await expect(page.getByText("Bold is ready for what you type next.")).toBeVisible();
  await editor.type(" again");
  await expect(editor.locator("strong")).toHaveText(" again");
  await expect(editor).toHaveText("hello😀 world again");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(editor).toHaveText("hello😀 world");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(editor).toHaveText("hello😀 world again");
});

test("applies advanced mobile formatting and returns focus to the editor", async ({ page }) => {
  await page.goto("/");
  const editor = page.getByLabel("Your entry for today");
  await editor.fill("mobile words");
  await editor.press(SELECT_ALL);

  await page.getByRole("button", { name: "More" }).click();
  let more = page.getByRole("dialog", { name: "More formatting options" });
  await more.getByLabel("Font", { exact: true }).selectOption({ label: "Newsreader" });
  await expect(more).toBeHidden();
  await expect(editor).toBeFocused();

  await page.getByRole("button", { name: "More" }).click();
  more = page.getByRole("dialog", { name: "More formatting options" });
  await more.getByRole("button", { name: "Blue text" }).click();
  await expect(more).toBeHidden();
  await expect(editor).toBeFocused();

  const text = editor.locator("[data-lexical-text=true]");
  await expect(text).toHaveAttribute("style", /font-family: var\(--font-newsreader\)/);
  await expect(text).toHaveAttribute("style", /color: rgb\(48, 79, 115\)/);
  await expect(page.getByText("2 words preserved")).toBeVisible();
});
