import { readFileSync } from "node:fs";
import { join } from "node:path";

import { unzipSync } from "fflate";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const MAILPIT_URL = "http://127.0.0.1:54324";
const TEST_PHOTO = join(process.cwd(), "public", "branding", "365x100-app-icon.png");

async function mailpitIds(request: APIRequestContext): Promise<Set<string>> {
  const messages = await (await request.get(`${MAILPIT_URL}/api/v1/messages`)).json() as { messages?: Array<{ ID?: string }> };
  return new Set(messages.messages?.flatMap((message) => message.ID ? [message.ID] : []) ?? []);
}

async function latestCode(request: APIRequestContext, email: string, excludedIds: Set<string>): Promise<string> {
  let code = "";
  await expect.poll(async () => {
    const messages = await (await request.get(`${MAILPIT_URL}/api/v1/messages`)).json() as {
      messages?: Array<{ ID?: string; To?: Array<{ Address?: string }> }>;
    };
    const message = messages.messages?.find((item) => item.ID && !excludedIds.has(item.ID) && JSON.stringify(item.To).includes(email));
    if (!message?.ID) return "";
    const detail = await (await request.get(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json() as { HTML?: string; Text?: string };
    code = `${detail.Text ?? ""} ${detail.HTML ?? ""}`.match(/\b\d{6}\b/)?.[0] ?? "";
    return code;
  }).toMatch(/^\d{6}$/);
  return code;
}

async function signIn(page: Page, request: APIRequestContext, email: string): Promise<void> {
  const existingMessages = await mailpitIds(request);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel(/I accept the Privacy Policy/).check();
  await page.getByLabel(/I accept the Terms of Use/).check();
  await page.getByRole("button", { name: "Email me a six-digit code" }).click();
  await page.getByLabel(`Code sent to ${email}`).fill(await latestCode(request, email, existingMessages));
  await page.getByRole("button", { name: "Verify and save my writing" }).click();
}

async function finishFirstOnboarding(page: Page): Promise<void> {
  const timezone = page.getByRole("dialog", { name: "When does your day end?" });
  await expect(timezone).toBeVisible();
  await timezone.getByRole("button", { name: /^Use / }).click();
  const rhythm = page.getByRole("dialog", { name: "See the week you wrote." });
  await expect(rhythm).toBeVisible();
  await rhythm.getByRole("button", { name: "Not now" }).click();
}

async function signedInPage(context: BrowserContext, request: APIRequestContext, email: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/");
  await signIn(page, request, email);
  await expect(page.getByLabel("Your entry for today")).toBeEnabled();
  return page;
}

test("keeps one private photo with the entry across writing, library, export and devices", async ({ browser, context, page, request }) => {
  test.setTimeout(90_000);
  const email = `photo-${Date.now()}@example.com`;
  await page.goto("/");
  await signIn(page, request, email);
  await finishFirstOnboarding(page);

  const editor = page.getByLabel("Your entry for today");
  const date = await page.locator("time[datetime]").getAttribute("datetime");
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.getByLabel("Choose a photo").setInputFiles(TEST_PHOTO);
  await expect(page.getByText("Photo added", { exact: true })).toBeVisible();
  await expect(page.getByAltText(`Photo for ${date}`)).toBeVisible();
  await expect(editor).toHaveText("");
  await expect(page.getByText("0 words preserved", { exact: true })).toBeVisible();

  const writing = "A photograph can arrive before the words, and the writing remains independent.";
  await editor.fill(writing);
  await expect(page.getByText("Saved to cloud", { exact: true })).toBeVisible();
  await page.reload();
  await expect(editor).toHaveText(writing);
  await expect(page.getByAltText(`Photo for ${date}`)).toBeVisible();

  await page.getByLabel("Writing navigation").getByRole("button", { name: "Library" }).click();
  const library = page.getByRole("dialog", { name: "A record of showing up." });
  await expect(library.getByAltText(new RegExp("Photo for"))).toBeVisible();
  await library.getByRole("tab", { name: "Calendar" }).click();
  await expect(library.getByRole("button", { name: new RegExp(`${date}: .*photo attached`) })).toBeVisible();
  await library.getByRole("button", { name: "Close" }).click();

  const secondContext = await browser.newContext();
  const secondPage = await signedInPage(secondContext, request, email);
  await expect(secondPage.getByAltText(`Photo for ${date}`)).toBeVisible();
  await secondContext.close();

  await context.setOffline(true);
  await expect(page.getByText("Photo unavailable offline", { exact: true })).toBeVisible();
  await editor.fill(`${writing} Offline words remain safe.`);
  await expect(page.getByText("Offline — saved on this device", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Saved to cloud", { exact: true })).toBeVisible();
  await expect(page.getByAltText(`Photo for ${date}`)).toBeVisible();

  await page.getByLabel("Choose a replacement photo").setInputFiles({
    buffer: Buffer.from("not an image"),
    mimeType: "image/png",
    name: "forged.png",
  });
  await expect(page.getByText("Please choose a JPEG, PNG or WebP image.", { exact: true })).toBeVisible();
  await expect(editor).toContainText("Offline words remain safe.");
  await expect(page.getByAltText(`Photo for ${date}`)).toBeVisible();

  await page.getByLabel("Writing navigation").getByRole("button", { name: "Account" }).click();
  const account = page.getByRole("dialog", { name: email });
  const downloadPromise = page.waitForEvent("download");
  await account.getByRole("button", { name: "Download my data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^365x100-data-\d{4}-\d{2}-\d{2}\.zip$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const files = unzipSync(new Uint8Array(readFileSync(path!)));
  expect(Object.keys(files)).toContain(`photos/${date}.webp`);
  const manifest = JSON.parse(new TextDecoder().decode(files["365x100-data.json"])) as Record<string, unknown>;
  expect(manifest).toMatchObject({ format: "365x100-portable-archive", version: 2 });
  expect(JSON.stringify(manifest)).not.toContain("storagePath");
  await account.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Confirm remove" }).click();
  await expect(page.getByText("Photo removed. Your writing is unchanged.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a photo" })).toBeVisible();
  await expect(editor).toContainText("Offline words remain safe.");
});
