import { expect, test } from "@playwright/test";

import { mergeHistoryPages, parseHistoryPage } from "../../lib/history";

const first = {
  completed: true,
  entryDate: "2026-08-17",
  excerpt: "A recent memory",
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
