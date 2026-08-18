import { expect, test } from "@playwright/test";

import { hasVisibleEntryContent } from "../../lib/entry-content";

test("counts words, punctuation, and emoji as visible entry content", () => {
  expect(hasVisibleEntryContent("A remembered detail")).toBe(true);
  expect(hasVisibleEntryContent("...")).toBe(true);
  expect(hasVisibleEntryContent("🌻")).toBe(true);
});

test("rejects empty, whitespace-only, and invisible formatting drafts", () => {
  expect(hasVisibleEntryContent("")).toBe(false);
  expect(hasVisibleEntryContent(" \n\t\r ")).toBe(false);
  expect(hasVisibleEntryContent("\u00a0\u00a0")).toBe(false);
  expect(hasVisibleEntryContent("\u200b\u200d\u2060\ufeff")).toBe(false);
});
