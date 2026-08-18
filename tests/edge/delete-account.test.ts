import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

function localSupabaseEnvironment(): Record<string, string> {
  const output = process.platform === "win32"
    ? execFileSync(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", "npx supabase status -o env"],
        { encoding: "utf8" },
      )
    : execFileSync("npx", ["supabase", "status", "-o", "env"], {
        encoding: "utf8",
      });

  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => /^(\w+)="?(.*?)"?$/.exec(line.trim()))
      .filter((match): match is RegExpExecArray => Boolean(match))
      .map((match) => [match[1], match[2].replace(/"$/, "")]),
  );
}

const environment = localSupabaseEnvironment();
const apiUrl = environment.API_URL;
const functionsUrl = environment.FUNCTIONS_URL;
const publicKey = environment.PUBLISHABLE_KEY || environment.ANON_KEY;
const serviceRoleKey = environment.SERVICE_ROLE_KEY;

test("requires authentication and permanently deletes only the caller", async () => {
  test.skip(
    !apiUrl || !functionsUrl || !publicKey || !serviceRoleKey,
    "The local Supabase stack must be running.",
  );

  const unauthorized = await fetch(`${functionsUrl}/delete-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: publicKey },
    body: JSON.stringify({ confirmation: "DELETE" }),
  });
  expect(unauthorized.status).toBe(401);

  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = `Local-test-${suffix}!`;
  const emailA = `delete-a-${suffix}@example.com`;
  const emailB = `delete-b-${suffix}@example.com`;
  const { data: createdA, error: createAError } = await admin.auth.admin.createUser({
    email: emailA,
    email_confirm: true,
    password,
  });
  const { data: createdB, error: createBError } = await admin.auth.admin.createUser({
    email: emailB,
    email_confirm: true,
    password,
  });

  expect(createAError).toBeNull();
  expect(createBError).toBeNull();
  expect(createdA.user).not.toBeNull();
  expect(createdB.user).not.toBeNull();
  const userA = createdA.user!;
  const userB = createdB.user!;
  const entryA = crypto.randomUUID();
  const entryB = crypto.randomUUID();
  const mediaId = crypto.randomUUID();
  const operationId = crypto.randomUUID();
  const storagePath = `${userA.id}/${entryA}/${mediaId}.webp`;

  try {
    const { error: profileError } = await admin.from("profiles").insert([
      { timezone: "Asia/Singapore", user_id: userA.id },
      { timezone: "UTC", user_id: userB.id },
    ]);
    const { error: entryError } = await admin.from("entries").insert([
      { content: "caller entry", entry_date: "2026-08-16", id: entryA, user_id: userA.id, word_count: 2 },
      { content: "other entry", entry_date: "2026-08-16", id: entryB, user_id: userB.id, word_count: 2 },
    ]);
    expect(profileError).toBeNull();
    expect(entryError).toBeNull();
    const stored = await admin.storage.from("journal-media").upload(
      storagePath,
      new Blob(["private-photo"], { type: "image/webp" }),
      { contentType: "image/webp" },
    );
    expect(stored.error).toBeNull();
    const mediaInsert = await admin.from("entry_media").insert({
      byte_size: 13,
      entry_id: entryA,
      height: 1,
      id: mediaId,
      operation_id: operationId,
      storage_path: storagePath,
      user_id: userA.id,
      width: 1,
    });
    expect(mediaInsert.error).toBeNull();

    const browserClient = createClient(apiUrl, publicKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signedIn, error: signInError } = await browserClient.auth.signInWithPassword({
      email: emailA,
      password,
    });
    expect(signInError).toBeNull();
    const accessToken = signedIn.session?.access_token;
    expect(accessToken).toBeTruthy();

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: publicKey,
    };
    const invalidConfirmation = await fetch(`${functionsUrl}/delete-account`, {
      method: "POST",
      headers,
      body: JSON.stringify({ confirmation: "delete" }),
    });
    expect(invalidConfirmation.status).toBe(400);

    const deletion = await fetch(`${functionsUrl}/delete-account`, {
      method: "POST",
      headers,
      body: JSON.stringify({ confirmation: "DELETE", userId: userB.id }),
    });
    expect(deletion.status).toBe(204);

    const callerLookup = await admin.auth.admin.getUserById(userA.id);
    const otherLookup = await admin.auth.admin.getUserById(userB.id);
    expect(callerLookup.error).not.toBeNull();
    expect(otherLookup.data.user?.id).toBe(userB.id);

    const callerProfiles = await admin.from("profiles").select("user_id").eq("user_id", userA.id);
    const callerEntries = await admin.from("entries").select("user_id").eq("user_id", userA.id);
    const callerMedia = await admin.from("entry_media").select("user_id").eq("user_id", userA.id);
    const callerPhoto = await admin.storage.from("journal-media").download(storagePath);
    expect(callerProfiles.data).toEqual([]);
    expect(callerEntries.data).toEqual([]);
    expect(callerMedia.data).toEqual([]);
    expect(callerPhoto.error).not.toBeNull();
  } finally {
    await admin.auth.admin.deleteUser(userA.id).catch(() => undefined);
    await admin.auth.admin.deleteUser(userB.id).catch(() => undefined);
  }
});
