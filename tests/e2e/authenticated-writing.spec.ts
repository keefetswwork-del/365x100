import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const MAILPIT_URL = "http://127.0.0.1:54324";

async function requestEmailCode(page: Page, email: string) {
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a six-digit code" }).click();
  await expect(page.getByLabel(`Code sent to ${email}`)).toBeVisible();
}

async function readLatestCode(request: APIRequestContext, email: string) {
  let code = "";
  await expect.poll(async () => {
    const response = await request.get(`${MAILPIT_URL}/api/v1/messages`);
    const payload = await response.json() as {
      messages?: Array<{ ID?: string; To?: Array<{ Address?: string }> }>;
    };
    const message = payload.messages?.find((item) =>
      JSON.stringify(item.To).includes(email),
    );
    if (!message?.ID) {
      return "";
    }

    const detailResponse = await request.get(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
    const detail = await detailResponse.json() as { HTML?: string; Text?: string };
    code = `${detail.Text ?? ""} ${detail.HTML ?? ""}`.match(/\b\d{6}\b/)?.[0] ?? "";
    return code;
  }).toMatch(/^\d{6}$/);

  return code;
}

async function signInWithOtp(
  page: Page,
  request: APIRequestContext,
  email: string,
) {
  await requestEmailCode(page, email);
  const code = await readLatestCode(request, email);
  await page.getByLabel(`Code sent to ${email}`).fill(code);
  await page.getByRole("button", { name: "Verify and save my writing" }).click();
}

async function newPage(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByLabel("Your entry for today")).toBeEnabled();
  return page;
}

test("migrates an OTP draft, syncs devices, retries offline, and reviews conflicts", async ({
  browser,
  page,
  request,
}) => {
  const email = `writer-${Date.now()}@example.com`;
  const editor = page.getByLabel("Your entry for today");
  const originalDraft = "A private moment written before creating an account.";

  await page.goto("/");
  await editor.fill(originalDraft);
  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
  await signInWithOtp(page, request, email);

  await expect(page.getByRole("dialog", { name: "When does your day end?" })).toBeVisible();
  await expect(editor).toHaveValue(originalDraft);
  await page.getByRole("button", { name: /^Use / }).click();
  await expect(page.getByRole("dialog", { name: "See the week you wrote." })).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByText("Saved to cloud", { exact: true })).toBeVisible();
  await expect(editor).toHaveValue(originalDraft);
  await expect.poll(() => page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith("365x100:entry:")).length,
  )).toBe(0);

  await page.reload();
  await expect(editor).toHaveValue(originalDraft);

  const secondContext = await browser.newContext();
  const secondPage = await newPage(secondContext);
  await signInWithOtp(secondPage, request, email);
  const secondEditor = secondPage.getByLabel("Your entry for today");
  await expect(secondEditor).toHaveValue(originalDraft);

  const firstUpdate = `${originalDraft} First device update.`;
  await editor.fill(firstUpdate);
  await expect(page.getByText("Saved to cloud", { exact: true })).toBeVisible();

  const competingUpdate = `${originalDraft} Second device update.`;
  await secondEditor.fill(competingUpdate);
  await expect(secondPage.getByRole("dialog", { name: "Choose the version to keep." })).toBeVisible();
  await expect(secondPage.getByLabel("Browser version")).toHaveValue(competingUpdate);
  await expect(secondPage.getByLabel("Cloud version")).toHaveValue(firstUpdate);
  await secondPage.getByRole("button", { name: "Keep browser version" }).click();
  await expect(secondPage.getByText("Saved to cloud", { exact: true })).toBeVisible();

  await secondContext.setOffline(true);
  const offlineUpdate = `${competingUpdate} Written while offline.`;
  await secondEditor.fill(offlineUpdate);
  await expect(secondPage.getByText("Offline — saved on this device", { exact: true })).toBeVisible();
  await secondContext.setOffline(false);
  await expect(secondPage.getByText("Saved to cloud", { exact: true })).toBeVisible();

  await secondPage.getByLabel("Writing navigation").getByRole("button", { name: "Account" }).click();
  await secondPage.getByRole("button", { name: "Sign out" }).click();
  await expect(secondPage.getByRole("button", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Writing navigation").getByRole("button", { name: "Account" }).click();
  await page.getByLabel("Type DELETE to confirm account deletion").fill("DELETE");
  await page.getByRole("button", { name: "Permanently delete my account" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  await secondContext.close();
});
