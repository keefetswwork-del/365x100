import { expect, test } from "@playwright/test";

import { listEntries } from "../../lib/entry-storage";
import { isValidLocalDate } from "../../lib/local-date";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("accepts real calendar dates and rejects impossible dates", () => {
  expect(isValidLocalDate("2024-02-29")).toBe(true);
  expect(isValidLocalDate("2025-02-29")).toBe(false);
  expect(isValidLocalDate("2026-13-01")).toBe(false);
});

test("enumerates only valid anonymous entry keys in date order", () => {
  const storage = new MemoryStorage();
  storage.setItem("365x100:entry:2026-08-17", "second");
  storage.setItem("365x100:entry:2026-08-16", "first");
  storage.setItem("365x100:entry:2026-99-99", "invalid");
  storage.setItem("unrelated", "ignored");

  expect(listEntries(storage)).toEqual([
    { content: "first", entryDate: "2026-08-16", richContent: null },
    { content: "second", entryDate: "2026-08-17", richContent: null },
  ]);
});
