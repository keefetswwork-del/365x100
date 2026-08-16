import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const MAILPIT_URL = "http://127.0.0.1:54324";

function localSupabaseEnvironment(): Record<string, string> {
  const output = process.platform === "win32"
    ? execFileSync(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", "npx supabase status -o env"],
        { encoding: "utf8" },
      )
    : execFileSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8" });
  return Object.fromEntries(
    output.split(/\r?\n/)
      .map((line) => /^(\w+)="?(.*?)"?$/.exec(line.trim()))
      .filter((match): match is RegExpExecArray => Boolean(match))
      .map((match) => [match[1], match[2].replace(/"$/, "")]),
  );
}

async function signInWithOtp(page: Page, request: APIRequestContext, email: string) {
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a six-digit code" }).click();
  await expect(page.getByLabel(`Code sent to ${email}`)).toBeVisible();

  let code = "";
  await expect.poll(async () => {
    const response = await request.get(`${MAILPIT_URL}/api/v1/messages`);
    const payload = await response.json() as {
      messages?: Array<{ ID?: string; To?: Array<{ Address?: string }> }>;
    };
    const message = payload.messages?.find((item) => JSON.stringify(item.To).includes(email));
    if (!message?.ID) return "";
    const detail = await (await request.get(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json() as {
      HTML?: string;
      Text?: string;
    };
    code = `${detail.Text ?? ""} ${detail.HTML ?? ""}`.match(/\b\d{6}\b/)?.[0] ?? "";
    return code;
  }).toMatch(/^\d{6}$/);

  await page.getByLabel(`Code sent to ${email}`).fill(code);
  await page.getByRole("button", { name: "Verify and save my writing" }).click();
}

function offsetDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

test("configures return habits, persists prompts, and safely edits past entries", async ({
  browser,
  context,
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const environment = localSupabaseEnvironment();
  const admin = createClient(environment.API_URL, environment.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `habit-${Date.now()}@example.com`;
  let userId = "";

  try {
    await page.goto("/");
    await signInWithOtp(page, request, email);
    await page.getByRole("button", { name: /^Use / }).click();

    const onboarding = page.getByRole("dialog", { name: "See the week you wrote." });
    await onboarding.getByLabel("Email my weekly review").check();
    await onboarding.getByLabel("Day").selectOption("3");
    await onboarding.getByLabel("Time").fill("18:30");
    await onboarding.getByRole("button", { name: "Save weekly review" }).click();

    await page.getByLabel("Writing navigation").getByRole("button", { name: "Account" }).click();
    const account = page.getByRole("dialog", { name: email });
    await account.getByLabel("Offer a fresh writing prompt each day").check();
    await account.getByLabel("Email my weekly progress review").check();
    await account.getByLabel("Review day").selectOption("5");
    await account.getByLabel("Review time").fill("17:45");
    await account.getByRole("button", { name: "Save writing rhythm" }).click();
    await expect(account.getByText("Writing rhythm saved.")).toBeVisible();
    await account.getByRole("button", { name: "Close" }).click();

    const heading = page.getByRole("heading", { level: 1 });
    await expect(page.getByRole("button", { name: "Try another prompt" })).toBeVisible();
    const firstPrompt = await heading.textContent();
    await page.getByRole("button", { name: "Try another prompt" }).click();
    await expect(heading).not.toHaveText(firstPrompt ?? "");
    const refreshedPrompt = await heading.textContent();

    const users = await admin.auth.admin.listUsers();
    userId = users.data.users.find((user) => user.email === email)?.id ?? "";
    expect(userId).toBeTruthy();
    const today = await page.locator("time[datetime]").getAttribute("datetime");
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const yesterday = offsetDate(today!, -1);
    const twoDaysAgo = offsetDate(today!, -2);
    const inserted = await admin.from("entries").insert([
      { content: "Yesterday was complete.", entry_date: yesterday, user_id: userId, word_count: 100, completed_at: new Date().toISOString() },
      { content: "An uncached earlier entry.", entry_date: twoDaysAgo, user_id: userId, word_count: 100, completed_at: new Date().toISOString() },
    ]);
    expect(inserted.error).toBeNull();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(refreshedPrompt ?? "");
    await page.getByLabel("Writing navigation").getByRole("button", { name: "Calendar" }).click();
    const progress = page.getByRole("dialog", { name: "A record of showing up." });
    await expect(progress.getByText("2", { exact: true }).first()).toBeVisible();

    await context.setOffline(true);
    await progress.getByRole("button", { name: `${twoDaysAgo}: complete, 100 words` }).click();
    await expect(page.getByText("This entry is not available offline.")).toBeVisible();
    await context.setOffline(false);
    await page.locator("#editor").getByRole("button", { name: "Return to today" }).click();

    await page.getByLabel("Writing navigation").getByRole("button", { name: "Calendar" }).click();
    await page.getByRole("dialog", { name: "A record of showing up." })
      .getByRole("button", { name: `${yesterday}: complete, 100 words` }).click();
    const pastEditor = page.locator('[contenteditable="true"]');
    await expect(pastEditor).toHaveText("Yesterday was complete.");
    await pastEditor.fill("Yesterday was updated safely.");
    await expect(page.getByText("Saved to cloud", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Return to today" }).first().click();

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    await secondPage.goto("/");
    await signInWithOtp(secondPage, request, email);
    await expect(secondPage.getByRole("heading", { level: 1 })).toHaveText(refreshedPrompt ?? "");
    await secondContext.close();

    const events = await admin.from("product_events").select("*").eq("user_id", userId);
    expect(events.error).toBeNull();
    expect(events.data?.some((event) => event.event_name === "signup_completed")).toBe(true);
    expect(Object.keys(events.data?.[0] ?? {})).not.toContain("content");

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByLabel("Writing navigation")).toBeHidden();
    await expect(page.getByRole("button", { name: /day streak|Calendar/ })).toBeVisible();
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }
});
