import { expect, test } from "@playwright/test";

import { historyPageFromCloudCaches, mergeHistoryPages, parseHistoryPage } from "../../lib/history";

const first = {
  completed: true,
  entryDate: "2026-08-17",
  excerpt: "A recent memory",
  title: "A remembered day",
  updatedAt: "2026-08-17T10:00:00.000Z",
  wordCount: 105,
};

test("parses a valid private history page", () => {
  expect(parseHistoryPage({
    hasMore: true,
    items: [first],
    nextCursor: "2026-08-17",
  })).toEqual({
    hasMore: true,
    items: [{ ...first, media: null }],
    nextCursor: "2026-08-17",
  });
});

test("rejects malformed history responses", () => {
  expect(() => parseHistoryPage({ items: [{ ...first, wordCount: "105" }] })).toThrow(
    "History response is invalid.",
  );
  expect(() => parseHistoryPage({ items: "journal text" })).toThrow(
    "History response is invalid.",
  );
});

test("merges pagination without duplicate dates and keeps newest first", () => {
  const older = { ...first, entryDate: "2026-07-01", excerpt: "Older" };
  const updated = { ...first, excerpt: "Updated excerpt" };

  expect(mergeHistoryPages([first], [older, updated])).toEqual([updated, older]);
});

test("builds a clearly bounded offline history from cached entries", () => {
  const page = historyPageFromCloudCaches([
    {
      content: "An older\n\nlocal memory",
      dirty: false,
      entryDate: "2026-08-17",
      richContent: null,
      updatedAt: "2026-08-17T10:00:00.000Z",
      version: 1,
      wordCount: 4,
    },
    {
      content: "Newest cached memory",
      dirty: true,
      entryDate: "2026-08-18",
      richContent: null,
      updatedAt: "2026-08-18T10:00:00.000Z",
      version: 2,
      wordCount: 101,
    },
  ]);

  expect(page).toEqual({
    hasMore: false,
    items: [
      expect.objectContaining({ completed: true, entryDate: "2026-08-18", media: null }),
      expect.objectContaining({ completed: false, entryDate: "2026-08-17", excerpt: "An older local memory", media: null }),
    ],
    nextCursor: null,
  });
});
