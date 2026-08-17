import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

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

function historyDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00Z`));
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
    const threeDaysAgo = offsetDate(today!, -3);
    const seededYesterday = ["Yesterday", "was", "complete.", ...Array.from({ length: 97 }, (_, index) => `detail${index + 1}`)].join(" ");
    const seededEarlier = ["An", "uncached", "earlier", "entry.", ...Array.from({ length: 96 }, (_, index) => `earlier${index + 1}`)].join(" ");
    const inserted = await admin.from("entries").insert([
      { content: seededYesterday, entry_date: yesterday, user_id: userId, word_count: 100, completed_at: new Date().toISOString() },
      { content: seededEarlier, entry_date: threeDaysAgo, user_id: userId, word_count: 100, completed_at: new Date().toISOString() },
    ]);
    expect(inserted.error).toBeNull();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(refreshedPrompt ?? "");
    await expect(page.getByText("1-day streak", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "1-day streak" })).toHaveCount(0);

    await page.getByLabel("Writing navigation").getByRole("button", { name: "Library" }).click();
    let library = page.getByRole("dialog", { name: "A record of showing up." });
    await expect(library.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
    const search = library.getByLabel("Search your writing");
    await search.fill("Yesterday was complete.");
    await expect(library.getByText("Yesterday was complete.")).toBeVisible();
    expect(page.url()).not.toContain("Yesterday");
    await library.getByRole("button", { name: "Select entries" }).click();
    await library.getByLabel(`Select entry for ${historyDate(yesterday)}`).check();
    const selectedDownloadPromise = page.waitForEvent("download");
    await library.getByRole("button", { name: "Export selected (1)" }).click();
    const selectedDownload = await selectedDownloadPromise;
    expect(selectedDownload.suggestedFilename()).toMatch(/^365x100-journal-\d{4}-\d{2}-\d{2}\.txt$/);
    const selectedPath = await selectedDownload.path();
    expect(selectedPath).not.toBeNull();
    const selectedText = readFileSync(selectedPath!, "utf8");
    expect(selectedText).toContain("Yesterday was complete.");
    expect(selectedText).not.toContain("An uncached earlier entry.");

    await library.getByRole("button", { name: new RegExp(historyDate(yesterday)) }).click();
    const historyEditor = page.locator('[contenteditable="true"]');
    await expect(historyEditor).toHaveText(seededYesterday);
    await page.getByRole("button", { name: "Return to today" }).first().click();

    const dateTrigger = page.getByRole("button", { name: /^Open calendar for / });
    await dateTrigger.click();
    const progress = page.getByRole("dialog", { name: "A record of showing up." });
    await expect(progress.getByText("2", { exact: true }).first()).toBeVisible();
    const selectedToday = progress.getByRole("button", { name: `${today}: empty` });
    await expect(selectedToday).toHaveAttribute("aria-pressed", "true");
    await selectedToday.focus();
    await selectedToday.press("ArrowLeft");
    await expect(progress.getByRole("button", { name: `${yesterday}: complete, 100 words` })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(progress).toBeHidden();
    await expect(dateTrigger).toBeFocused();

    await dateTrigger.click();

    await context.setOffline(true);
    await progress.getByRole("button", { name: `${threeDaysAgo}: complete, 100 words` }).click();
    await expect(page.getByText("This entry is not available offline.")).toBeVisible();
    await context.setOffline(false);
    await page.locator("#editor").getByRole("button", { name: "Return to today" }).click();

    await page.getByRole("button", { name: "Previous day" }).click();
    const pastEditor = page.locator('[contenteditable="true"]');
    await expect(pastEditor).toBeFocused();
    await expect(pastEditor).toHaveText(seededYesterday);
    const updatedPastEntry = Array.from({ length: 100 }, (_, index) => `updated${index + 1}`).join(" ");
    await pastEditor.fill(updatedPastEntry);
    await expect(page.getByText(/Saving locally|Saving to cloud/)).toBeVisible();
    await expect(page.getByText("Saved to cloud", { exact: true })).toBeVisible();
    await expect(page.getByText("Past entry", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next day" }).click();
    await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();

    await dateTrigger.click();
    await progress.getByRole("button", { name: `${twoDaysAgo}: missed` }).click();
    await expect(pastEditor).toBeFocused();
    await expect(pastEditor).toHaveText("");
    const backfill = Array.from({ length: 100 }, (_, index) => `memory${index + 1}`).join(" ");
    await pastEditor.fill(backfill);
    await expect(page.getByText(/Saving locally|Saving to cloud/)).toBeVisible();
    await expect(page.getByText("Saved to cloud", { exact: true })).toBeVisible();
    await expect(page.getByText("3-day streak", { exact: true })).toBeVisible();

    await dateTrigger.click();
    await progress.getByRole("button", { name: `${threeDaysAgo}: complete, 100 words` }).click();
    await expect(page.getByRole("button", { name: "Previous day" })).toBeDisabled();
    await page.getByRole("button", { name: "Return to today" }).first().click();

    await page.getByLabel("Writing navigation").getByRole("button", { name: "Library" }).click();
    library = page.getByRole("dialog", { name: "A record of showing up." });
    await expect(library.getByText("An uncached earlier entry.")).toBeVisible();
    const allDownloadPromise = page.waitForEvent("download");
    await library.getByRole("button", { name: "Export all as text" }).click();
    const allDownload = await allDownloadPromise;
    const allPath = await allDownload.path();
    expect(allPath).not.toBeNull();
    const allText = readFileSync(allPath!, "utf8");
    expect(allText).toContain("An uncached earlier entry.");
    expect(allText).toContain(updatedPastEntry);
    expect(allText).toContain(backfill);
    expect(allText.indexOf("An uncached earlier entry.")).toBeLessThan(allText.indexOf(backfill));
    expect(allText.indexOf(backfill)).toBeLessThan(allText.indexOf(updatedPastEntry));
    await library.getByRole("button", { name: "Close" }).click();

    await page.getByLabel("Writing navigation").getByRole("button", { name: "Account" }).click();
    const accountAfterWriting = page.getByRole("dialog", { name: email });
    const archiveDownloadPromise = page.waitForEvent("download");
    await accountAfterWriting.getByRole("button", { name: "Download my data" }).click();
    const archiveDownload = await archiveDownloadPromise;
    expect(archiveDownload.suggestedFilename()).toMatch(/^365x100-data-\d{4}-\d{2}-\d{2}\.json$/);
    const archivePath = await archiveDownload.path();
    expect(archivePath).not.toBeNull();
    const archive = JSON.parse(readFileSync(archivePath!, "utf8")) as Record<string, unknown>;
    expect(archive).toMatchObject({ format: "365x100-portable-archive", version: 1 });
    expect(JSON.stringify(archive)).toContain(updatedPastEntry);
    expect(JSON.stringify(archive)).toContain("contentRich");
    expect(JSON.stringify(archive)).not.toContain(userId);
    expect(JSON.stringify(archive)).not.toContain("product_events");
    await accountAfterWriting.getByRole("button", { name: "Close" }).click();

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
    await expect(page.getByRole("button", { name: /^Open calendar for / })).toBeVisible();
    await expect(page.getByRole("button", { name: /day streak/ })).toHaveCount(0);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }
});
