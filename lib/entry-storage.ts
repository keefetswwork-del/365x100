export const ENTRY_KEY_PREFIX = "365x100:entry:";

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
