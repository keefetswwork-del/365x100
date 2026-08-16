import { isValidLocalDate } from "@/lib/local-date";

export const ENTRY_KEY_PREFIX = "365x100:entry:";
const ENTRY_KEY_PATTERN = /^365x100:entry:(\d{4}-\d{2}-\d{2})$/;

type EntryStorage = Pick<Storage, "getItem" | "setItem">;

function getBrowserStorage(): EntryStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getEntryStorageKey(localDate: string): string {
  return `${ENTRY_KEY_PREFIX}${localDate}`;
}

export function loadEntry(
  localDate: string,
  storage: EntryStorage | null = getBrowserStorage(),
): string {
  if (!storage) {
    return "";
  }

  try {
    return storage.getItem(getEntryStorageKey(localDate)) ?? "";
  } catch {
    return "";
  }
}

export function saveEntry(
  localDate: string,
  entry: string,
  storage: EntryStorage | null = getBrowserStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(getEntryStorageKey(localDate), entry);
    return true;
  } catch {
    return false;
  }
}

export interface LocalEntry {
  entryDate: string;
  content: string;
}

export function listEntries(storage?: Storage): LocalEntry[] {
  const target = storage ?? (getBrowserStorage() as Storage | null);
  if (!target || typeof target.length !== "number") {
    return [];
  }

  const entries: LocalEntry[] = [];
  try {
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      const match = key?.match(ENTRY_KEY_PATTERN);
      if (!key || !match || !isValidLocalDate(match[1])) {
        continue;
      }

      entries.push({
        content: target.getItem(key) ?? "",
        entryDate: match[1],
      });
    }
  } catch {
    return [];
  }

  return entries.sort((left, right) => left.entryDate.localeCompare(right.entryDate));
}

export function removeEntry(localDate: string, storage?: Storage): boolean {
  const target = storage ?? (getBrowserStorage() as Storage | null);
  if (!target || typeof target.removeItem !== "function") {
    return false;
  }

  try {
    target.removeItem(getEntryStorageKey(localDate));
    return true;
  } catch {
    return false;
  }
}
