import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const MAILPIT_URL = "http://127.0.0.1:54324";

function localSupabaseEnvironment(): Record<string, string> {
  const output = process.platform === "win32"
    ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npx supabase status -o env"], { encoding: "utf8" })
    : execFileSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8" });
  return Object.fromEntries(output.split(/\r?\n/).map((line) => /^(\w+)="?(.*?)"?$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => [match[1], match[2].replace(/"$/, "")]));
}

async function signIn(page: Page, request: APIRequestContext, email: string): Promise<void> {
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel(/I accept the Privacy Policy/).check();
  await page.getByLabel(/I accept the Terms of Use/).check();
  await page.getByRole("button", { name: "Email me a six-digit code" }).click();
  let code = "";
  await expect.poll(async () => {
    const messages = await (await request.get(`${MAILPIT_URL}/api/v1/messages`)).json() as {
      messages?: Array<{ ID?: string; To?: Array<{ Address?: string }> }>;
    };
    const message = messages.messages?.find((item) => JSON.stringify(item.To).includes(email));
    if (!message?.ID) return "";
    const detail = await (await request.get(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json() as { HTML?: string; Text?: string };
    code = `${detail.Text ?? ""} ${detail.HTML ?? ""}`.match(/\b\d{6}\b/)?.[0] ?? "";
    return code;
  }).toMatch(/^\d{6}$/);
  await page.getByLabel(`Code sent to ${email}`).fill(code);
  await page.getByRole("button", { name: "Verify and save my writing" }).click();
  await page.getByRole("dialog", { name: "When does your day end?" }).getByRole("button", { name: /^Use / }).click();
  await page.getByRole("dialog", { name: "See the week you wrote." }).getByRole("button", { name: "Not now" }).click();
}

function previousMonth(date: string): { label: string; monthStart: string } {
  const current = new Date(`${date}T12:00:00Z`);
  const previous = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1));
  return {
    label: new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC", year: "numeric" }).format(previous),
    monthStart: previous.toISOString().slice(0, 7),
  };
}

test("creates, edits and safeguards original and AI monthly chapters", async ({ page, request }, testInfo) => {
  test.setTimeout(150_000);
  const environment = localSupabaseEnvironment();
  const admin = createClient(environment.API_URL, environment.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `books-${Date.now()}@example.com`;

  await page.goto("/");
  await signIn(page, request, email);
  const today = await page.locator("time[datetime]").getAttribute("datetime");
  expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const month = previousMonth(today!);
  const users = await admin.auth.admin.listUsers();
  const userId = users.data.users.find((user) => user.email === email)?.id;
  expect(userId).toBeTruthy();

  let firstEntryId = "";
  for (let day = 1; day <= 10; day += 1) {
    const entryDate = `${month.monthStart}-${String(day).padStart(2, "0")}`;
    const content = day === 1
      ? "A bold beginning carried English, 中文, தமிழ் and a small memory emoji 😊."
      : `Memory ${day} stayed in chronological order for this private monthly chapter.`;
    const rich = day === 1 ? {
      schemaVersion: 1,
      editorState: { root: { children: [{ children: [{ format: 3, text: content, type: "text" }], format: "left", type: "paragraph" }], type: "root" } },
    } : null;
    const inserted = await admin.from("entries").insert({
      content,
      content_rich: rich,
      entry_date: entryDate,
      title: day === 1 ? "A bright beginning 中文 தமிழ் 😊" : `Memory ${day}`,
      user_id: userId!,
      word_count: content.trim().split(/\s+/).length,
    }).select("id").single();
    expect(inserted.error).toBeNull();
    if (day === 1) firstEntryId = inserted.data!.id;
  }
  const photoDataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, "#e9573f");
    gradient.addColorStop(1, "#173c35");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = "#fff8ee";
    context.beginPath();
    context.arc(32, 32, 15, 0, Math.PI * 2);
    context.fill();
    return canvas.toDataURL("image/webp", 0.9);
  });
  expect(photoDataUrl).toMatch(/^data:image\/webp;base64,/);
  const mediaId = randomUUID();
  const mediaBytes = Buffer.from(photoDataUrl.split(",")[1], "base64");
  const storagePath = `${userId}/${firstEntryId}/${mediaId}.webp`;
  expect((await admin.storage.from("journal-media").upload(storagePath, mediaBytes, {
    contentType: "image/webp",
    upsert: false,
  })).error).toBeNull();
  expect((await admin.from("entry_media").insert({
    byte_size: mediaBytes.byteLength,
    entry_id: firstEntryId,
    height: 64,
    id: mediaId,
    operation_id: randomUUID(),
    storage_path: storagePath,
    user_id: userId!,
    width: 64,
  })).error).toBeNull();
  expect((await admin.from("publication_entitlements").insert({
    ai_enabled: true,
    generation_limit: 1,
    section_regeneration_limit: 5,
    user_id: userId!,
  })).error).toBeNull();

  let generationCalls = 0;
  await page.route("**/functions/v1/generate-publication", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ headers: { "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-origin": "*" }, status: 204 });
      return;
    }
    const body = route.request().postDataJSON() as { publicationId: string; section: string };
    const publicationResult = await admin.from("publications").select("*").eq("id", body.publicationId).single();
    expect(publicationResult.error).toBeNull();
    const sourceResult = await admin.from("entries").select("id, entry_date, content")
      .eq("user_id", userId!).gte("entry_date", publicationResult.data!.period_start)
      .lte("entry_date", publicationResult.data!.period_end).order("entry_date");
    expect(sourceResult.error).toBeNull();
    const first = sourceResult.data![0];
    const refreshed = await admin.rpc("refresh_publication_sources", { p_publication_id: body.publicationId });
    expect(refreshed.error).toBeNull();
    const previousVersion = await admin.from("publication_versions").select("version_number")
      .eq("publication_id", body.publicationId).order("version_number", { ascending: false }).limit(1);
    const generation = ++generationCalls;
    const editorial = {
      moments: [{ date: first.entry_date, sourceRef: first.id, text: "The month began with a bright memory." }],
      quotations: [{ date: first.entry_date, quote: "A bold beginning", sourceRef: first.id }],
      review: generation === 1 ? "Ten memories formed a quiet record of the month." : "The renewed review keeps every source grounded.",
      themes: generation === 1 ? ["memory", "return"] : ["renewed"],
      title: `${month.label}: an edited chapter`,
      version: 1,
    };
    const insertedVersion = await admin.from("publication_versions").insert({
      approval_state: "draft",
      editorial,
      model: "gpt-5.6-terra",
      prompt_version: "monthly-editor-v1",
      publication_id: body.publicationId,
      source_fingerprint: String((refreshed.data as { editorialFingerprint?: string } | null)?.editorialFingerprint ?? ""),
      version_number: Number(previousVersion.data?.[0]?.version_number ?? 0) + 1,
    }).select("id").single();
    expect(insertedVersion.error).toBeNull();
    const updated = await admin.from("publications").update({
      current_draft_version_id: insertedVersion.data!.id,
      editorial_fingerprint: String((refreshed.data as { editorialFingerprint?: string } | null)?.editorialFingerprint ?? ""),
      generation_count: 1,
      mode: "ai",
      section_regeneration_count: body.section === "full" ? 0 : generation - 1,
      stale_reason: null,
      state: "draft",
      title: editorial.title,
    }).eq("id", body.publicationId);
    expect(updated.error).toBeNull();
    await route.fulfill({
      body: JSON.stringify({ status: "draft" }),
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      status: 200,
    });
  });

  await page.getByLabel("Writing navigation").getByRole("button", { name: "Library" }).click();
  const library = page.getByRole("dialog", { name: "A record of showing up." });
  await library.getByRole("tab", { name: "Books" }).click();
  const monthCard = library.getByRole("article").filter({ hasText: month.label });
  await expect(monthCard.getByText("10 writing days", { exact: false })).toBeVisible();
  await expect(monthCard.getByText("Ready to create", { exact: true })).toBeVisible();
  await monthCard.getByRole("button", { name: "Create original chapter" }).click();

  const preview = library.getByRole("article", { name: "Chapter preview" });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("heading", { name: "A bright beginning 中文 தமிழ் 😊" })).toBeVisible();
  await expect(preview.getByRole("heading", { name: "Memory 10" })).toBeVisible();
  await expect(preview.getByRole("img", { name: `Photo for ${new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${month.monthStart}-01T00:00:00Z`))}` })).toBeVisible();
  const previewText = await preview.textContent();
  expect(previewText?.indexOf("A bright beginning")).toBeLessThan(previewText?.indexOf("Memory 10") ?? -1);

  const coverTitle = library.getByLabel("Cover title");
  await coverTitle.fill(`${month.label}: kept moments`);
  await library.getByLabel("Cover photograph").selectOption(mediaId);
  await expect(preview.getByRole("img", { name: "Selected chapter cover" })).toBeVisible();
  await expect(library.getByText("Chapter draft saved", { exact: true })).toBeVisible();
  await library.getByRole("button", { name: "Approve chapter" }).click();
  await expect(library.getByText("Original entries · ready", { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  await library.getByRole("button", { name: "Download A5 PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`365x100-chapter-${month.monthStart}.pdf`);
  const path = await download.path();
  expect(path).not.toBeNull();
  const bytes = readFileSync(path!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.byteLength).toBeGreaterThan(10_000);
  await download.saveAs(testInfo.outputPath("monthly-chapter.pdf"));

  const aiButton = library.getByRole("button", { name: "Create AI-edited version" });
  await aiButton.click();
  const disclosure = library.getByRole("dialog", { name: `Create ${month.label} with OpenAI?` });
  await expect(disclosure.getByRole("button", { name: "Create AI-edited chapter" })).toBeDisabled();
  await disclosure.getByLabel(/I understand and consent to AI processing/).check();
  await disclosure.getByRole("button", { name: "Create AI-edited chapter" }).click();
  await expect(library.getByText("AI-edited · draft", { exact: true })).toBeVisible();
  await expect(library.getByLabel("Month in review")).toHaveValue("Ten memories formed a quiet record of the month.");

  await library.getByLabel("Month in review").fill("A careful founder review confirmed this month.");
  await expect(library.getByText("Chapter draft saved", { exact: true })).toBeVisible();
  await library.getByRole("button", { name: "Approve chapter" }).click();
  await expect(library.getByText("AI-edited · ready", { exact: true })).toBeVisible();
  await library.getByRole("button", { name: "accurate" }).click();
  await expect.poll(async () => (await admin.from("publication_feedback").select("verdict").eq("user_id", userId!).single()).data?.verdict).toBe("accurate");

  await library.getByRole("button", { name: "Regenerate themes" }).click();
  await expect(library.getByText("renewed", { exact: true })).toBeVisible();
  expect(generationCalls).toBe(2);

  const firstEntry = await admin.from("entries").select("id, version").eq("user_id", userId!).eq("entry_date", `${month.monthStart}-01`).single();
  expect(firstEntry.error).toBeNull();
  expect((await admin.from("entries").update({ title: "A source title changed", version: firstEntry.data!.version + 1 }).eq("id", firstEntry.data!.id)).error).toBeNull();
  await library.getByRole("button", { name: "Close" }).click();
  await page.getByLabel("Writing navigation").getByRole("button", { name: "Library" }).click();
  const reopened = page.getByRole("dialog", { name: "A record of showing up." });
  await reopened.getByRole("tab", { name: "Books" }).click();
  await reopened.getByRole("article").filter({ hasText: month.label }).getByRole("button", { name: "Open chapter" }).click();
  await expect(reopened.getByText("Your journal changed after this AI draft was created.", { exact: true })).toBeVisible();
  await expect(reopened.getByRole("button", { name: "Download A5 PDF" })).toBeDisabled();
});
