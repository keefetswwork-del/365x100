import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

function localSupabaseEnvironment(): Record<string, string> {
  const output = process.platform === "win32"
    ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npx supabase status -o env"], { encoding: "utf8" })
    : execFileSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8" });
  return Object.fromEntries(output.split(/\r?\n/).map((line) => /^(\w+)="?(.*?)"?$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => [match[1], match[2].replace(/"$/, "")]));
}

function webp(width = 1200, height = 800, size = 30): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([..."RIFF"].map((character) => character.charCodeAt(0)), 0);
  bytes.set([..."WEBP"].map((character) => character.charCodeAt(0)), 8);
  bytes.set([..."VP8X"].map((character) => character.charCodeAt(0)), 12);
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes[24] = encodedWidth & 0xff;
  bytes[25] = (encodedWidth >> 8) & 0xff;
  bytes[26] = (encodedWidth >> 16) & 0xff;
  bytes[27] = encodedHeight & 0xff;
  bytes[28] = (encodedHeight >> 8) & 0xff;
  bytes[29] = (encodedHeight >> 16) & 0xff;
  return bytes;
}

function uploadForm(entryId: string, operationId: string, bytes: Uint8Array, expected?: { id: string; version: number }): FormData {
  const form = new FormData();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  form.set("entryId", entryId);
  form.set("operationId", operationId);
  form.set("file", new Blob([buffer], { type: "image/webp" }), "photo.webp");
  if (expected) {
    form.set("expectedMediaId", expected.id);
    form.set("expectedVersion", String(expected.version));
  }
  return form;
}

const environment = localSupabaseEnvironment();
const apiUrl = environment.API_URL;
const functionsUrl = environment.FUNCTIONS_URL;
const publicKey = environment.PUBLISHABLE_KEY || environment.ANON_KEY;
const serviceRoleKey = environment.SERVICE_ROLE_KEY;

test("keeps upload, replacement, idempotency and removal private and conflict safe", async () => {
  test.skip(!apiUrl || !functionsUrl || !publicKey || !serviceRoleKey, "The local Supabase stack must be running.");

  const admin = createClient(apiUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = `Local-media-${suffix}!`;
  const userA = await admin.auth.admin.createUser({ email: `media-a-${suffix}@example.com`, email_confirm: true, password });
  const userB = await admin.auth.admin.createUser({ email: `media-b-${suffix}@example.com`, email_confirm: true, password });
  expect(userA.error).toBeNull();
  expect(userB.error).toBeNull();
  const caller = userA.data.user!;
  const other = userB.data.user!;
  const entryA = crypto.randomUUID();
  const entryB = crypto.randomUUID();

  try {
    expect((await admin.from("profiles").insert([
      { timezone: "UTC", user_id: caller.id },
      { timezone: "UTC", user_id: other.id },
    ])).error).toBeNull();
    expect((await admin.from("entries").insert([
      { content: "", entry_date: "2026-08-18", id: entryA, user_id: caller.id, word_count: 0 },
      { content: "other", entry_date: "2026-08-18", id: entryB, user_id: other.id, word_count: 1 },
    ])).error).toBeNull();

    const browser = createClient(apiUrl, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const signedIn = await browser.auth.signInWithPassword({ email: `media-a-${suffix}@example.com`, password });
    expect(signedIn.error).toBeNull();
    const token = signedIn.data.session!.access_token;
    const headers = { Authorization: `Bearer ${token}`, apikey: publicKey };
    const operation = crypto.randomUUID();

    const consentRequired = await fetch(`${functionsUrl}/journal-media`, {
      method: "POST", headers, body: uploadForm(entryA, operation, webp()),
    });
    expect(consentRequired.status).toBe(428);
    expect(await consentRequired.json()).toMatchObject({ status: "privacy-required" });
    expect((await browser.rpc("accept_media_privacy")).error).toBeNull();

    const forged = await fetch(`${functionsUrl}/journal-media`, {
      method: "POST", headers, body: uploadForm(entryA, crypto.randomUUID(), new Uint8Array([0xff, 0xd8, 0xff, 0x00])),
    });
    expect(forged.status).toBe(415);

    const oversized = await fetch(`${functionsUrl}/journal-media`, {
      method: "POST", headers, body: uploadForm(entryA, crypto.randomUUID(), webp(1200, 800, 1_000_001)),
    });
    expect(oversized.status).toBe(415);

    const crossUser = await fetch(`${functionsUrl}/journal-media`, {
      method: "POST", headers, body: uploadForm(entryB, crypto.randomUUID(), webp()),
    });
    expect(crossUser.status).toBe(404);

    const uploaded = await fetch(`${functionsUrl}/journal-media`, {
      method: "POST", headers, body: uploadForm(entryA, operation, webp()),
    });
    expect(uploaded.status).toBe(200);
    const first = (await uploaded.json()).media as { id: string; storagePath: string; version: number };
    expect(first).toMatchObject({ id: operation, version: 1 });

    const replay = await fetch(`${functionsUrl}/journal-media`, {
      method: "POST", headers, body: uploadForm(entryA, operation, webp()),
    });
    expect(replay.status).toBe(200);
    expect((await replay.json()).media.id).toBe(first.id);
    expect((await admin.from("entry_media").select("id").eq("entry_id", entryA)).data).toHaveLength(1);

    const replacementOperation = crypto.randomUUID();
    const replacement = await fetch(`${functionsUrl}/journal-media`, {
      method: "POST", headers, body: uploadForm(entryA, replacementOperation, webp(900, 600), first),
    });
    expect(replacement.status).toBe(200);
    const second = (await replacement.json()).media as { id: string; storagePath: string; version: number };
    expect(second).toMatchObject({ id: replacementOperation, version: 2 });
    expect((await admin.storage.from("journal-media").download(first.storagePath)).error).not.toBeNull();

    const stale = await fetch(`${functionsUrl}/journal-media`, {
      method: "POST", headers, body: uploadForm(entryA, crypto.randomUUID(), webp(), first),
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ status: "conflict", remote: { id: second.id, version: 2 } });

    const removed = await fetch(`${functionsUrl}/journal-media`, {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId: second.id, operationId: crypto.randomUUID(), version: second.version }),
    });
    expect(removed.status).toBe(204);
    expect((await admin.from("entry_media").select("id").eq("entry_id", entryA)).data).toEqual([]);
    expect((await admin.storage.from("journal-media").download(second.storagePath)).error).not.toBeNull();
  } finally {
    await admin.auth.admin.deleteUser(caller.id).catch(() => undefined);
    await admin.auth.admin.deleteUser(other.id).catch(() => undefined);
  }
});

test("rejects cleanup requests without the cron secret", async () => {
  const response = await fetch(`${functionsUrl}/cleanup-journal-media`, {
    method: "POST",
    headers: { "x-cron-secret": "not-the-secret" },
  });
  expect(response.status).toBe(401);
});
