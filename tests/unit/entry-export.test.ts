import { expect, test } from "@playwright/test";

import { createPortableArchive, serializePlainTextEntries } from "../../lib/entry-export";
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
