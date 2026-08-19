import { expect, test } from "@playwright/test";

import { unzipSync } from "fflate";

import { buildPortableZip, createPortableArchive, serializePlainTextEntries, streamPortableZip } from "../../lib/entry-export";
import type { RichEntryDocument } from "../../lib/rich-text";
import type { CloudEntry, Profile } from "../../types/cloud";
import type { HabitPreferences } from "../../types/habit";

const richContent = {
  schemaVersion: 1,
  editorState: {
    root: {
      children: [{
        children: [{ detail: 0, format: 1, mode: "normal", text: "Rich memory", type: "text", version: 1 }],
        direction: null,
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      }],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  },
} satisfies RichEntryDocument;

function entry(entryDate: string, content: string, wordCount: number): CloudEntry {
  return {
    completedAt: wordCount >= 100 ? "2026-08-17T10:00:00.000Z" : null,
    content,
    createdAt: "2026-08-17T09:00:00.000Z",
    entryDate,
    id: `entry-${entryDate}`,
    title: `Title ${entryDate}`,
    richContent,
    updatedAt: "2026-08-17T10:00:00.000Z",
    userId: "private-user-id",
    version: 3,
    wordCount,
  };
}

const preferences: HabitPreferences = {
  dailyPromptsEnabled: true,
  onboardingCompleted: true,
  weeklyReview: { day: 0, enabled: false, time: "19:00" },
};

const profile: Profile = {
  createdAt: "2026-08-01T00:00:00.000Z",
  dailyPromptsEnabled: true,
  habitOnboardingCompleted: true,
  lastWelcomeBackDate: null,
  timezone: "Asia/Singapore",
  updatedAt: "2026-08-17T00:00:00.000Z",
  userId: "private-user-id",
  weeklyReviewDay: 0,
  weeklyReviewEnabled: false,
  weeklyReviewTime: "19:00",
};

test("serializes every selected entry once in chronological plain-text order", () => {
  const output = serializePlainTextEntries([
    entry("2026-08-17", "Newer paragraph\nwith a second line.", 6),
    entry("2026-08-01", "Older memory.", 2),
    entry("2026-08-01", "Older memory.", 2),
  ]);

  expect(output.indexOf("Saturday, August 1, 2026")).toBeLessThan(
    output.indexOf("Monday, August 17, 2026"),
  );
  expect(output).toContain("Newer paragraph\nwith a second line.");
  expect(output).not.toContain("schemaVersion");
  expect(output.match(/Older memory\./g)).toHaveLength(1);
});

test("creates a versioned portable archive without private infrastructure fields", () => {
  const archive = createPortableArchive(
    {
      email: "writer@example.com",
      entries: [entry("2026-08-17", "Private journal text", 3)],
      preferences,
      profile,
    },
    [{ category: "everyday-life", entryDate: "2026-08-17", prompt: "What happened?", refreshedAt: null }],
    "2026-08-17T12:00:00.000Z",
  );

  expect(archive).toMatchObject({
    account: { email: "writer@example.com", timezone: "Asia/Singapore" },
    exportedAt: "2026-08-17T12:00:00.000Z",
    format: "365x100-portable-archive",
    version: 1,
  });
  expect(archive.entries[0].contentRich).toEqual(richContent);
  expect(archive.entries[0].content).toBe("Private journal text");
  expect(JSON.stringify(archive)).not.toContain("private-user-id");
  expect(JSON.stringify(archive)).not.toContain("service_role");
  expect(JSON.stringify(archive)).not.toContain("product_events");
  expect(JSON.stringify(archive)).not.toContain("weekly_review_deliveries");
});

test("creates a ZIP with every photo once and no private storage details", async () => {
  const datedEntry = entry("2026-08-17", "Private journal text", 3);
  datedEntry.media = {
    byteSize: 30,
    createdAt: "2026-08-17T09:00:00.000Z",
    height: 800,
    id: "media-private-id",
    mimeType: "image/webp",
    storagePath: "private-user-id/entry-id/media-private-id.webp",
    updatedAt: "2026-08-17T10:00:00.000Z",
    version: 1,
    width: 1200,
  };
  const photo = new Blob([new Uint8Array([82, 73, 70, 70])], { type: "image/webp" });
  const client = {
    rpc: async () => ({ data: { consents: [], publications: [] }, error: null }),
    from: () => ({
      select: () => ({
        order: () => ({ range: async () => ({ data: [], error: null }) }),
      }),
    }),
    storage: {
      from: () => ({ download: async () => ({ data: photo, error: null }) }),
    },
  };

  const output = await buildPortableZip(client as never, {
    email: "writer@example.com",
    entries: [datedEntry],
    preferences,
    profile,
  });
  const files = unzipSync(new Uint8Array(await output.arrayBuffer()));
  const manifest = JSON.parse(new TextDecoder().decode(files["365x100-data.json"])) as Record<string, unknown>;
  const serialized = JSON.stringify(manifest);

  expect(Object.keys(files).sort()).toEqual(["365x100-data.json", "photos/2026-08-17.webp"]);
  expect(manifest).toMatchObject({ consents: [], format: "365x100-portable-archive", publications: [], version: 3 });
  expect(serialized).toContain("photos/2026-08-17.webp");
  expect(serialized).not.toContain("private-user-id");
  expect(serialized).not.toContain("media-private-id");
  expect(serialized).not.toContain("storagePath");
});

test("streams a portable ZIP sequentially without retaining private paths", async () => {
  const datedEntry = entry("2026-08-17", "Streamed journal text", 3);
  datedEntry.media = {
    byteSize: 4,
    createdAt: "2026-08-17T09:00:00.000Z",
    height: 1,
    id: "media-private-id",
    mimeType: "image/webp",
    storagePath: "private/path.webp",
    updatedAt: "2026-08-17T10:00:00.000Z",
    version: 1,
    width: 1,
  };
  const client = {
    rpc: async () => ({ data: { consents: [], publications: [] }, error: null }),
    from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }) }),
    storage: { from: () => ({ download: async () => ({ data: new Blob(["RIFF"], { type: "image/webp" }), error: null }) }) },
  };
  const chunks: Uint8Array[] = [];
  let closed = false;
  await streamPortableZip(client as never, {
    close: async () => { closed = true; },
    write: async (data) => { chunks.push(Uint8Array.from(data)); },
  }, {
    email: "writer@example.com",
    entries: [datedEntry],
    preferences,
    profile,
  });
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const files = unzipSync(bytes);
  const manifest = new TextDecoder().decode(files["365x100-data.json"]);
  expect(closed).toBe(true);
  expect(Object.keys(files).sort()).toEqual(["365x100-data.json", "photos/2026-08-17.webp"]);
  expect(manifest).toContain("Streamed journal text");
  expect(manifest).not.toContain("private/path.webp");
});
