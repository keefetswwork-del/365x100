import type { CloudEntry, CloudEntryCache } from "@/types/cloud";

const CLOUD_CACHE_PREFIX = "365x100:cloud:";

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getCloudCacheKey(userId: string, entryDate: string): string {
  return `${CLOUD_CACHE_PREFIX}${userId}:entry:${entryDate}`;
}

export function loadCloudCache(
  userId: string,
  entryDate: string,
  storage: Storage | null = getStorage(),
): CloudEntryCache | null {
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(getCloudCacheKey(userId, entryDate));
    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value) as Partial<CloudEntryCache>;
    if (
      parsed.entryDate !== entryDate ||
      typeof parsed.content !== "string" ||
      typeof parsed.wordCount !== "number" ||
      typeof parsed.version !== "number" ||
      typeof parsed.dirty !== "boolean" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }

    return parsed as CloudEntryCache;
  } catch {
    return null;
  }
}

export function saveCloudCache(
  userId: string,
  cache: CloudEntryCache,
  storage: Storage | null = getStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(getCloudCacheKey(userId, cache.entryDate), JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

export function cacheFromCloudEntry(entry: CloudEntry): CloudEntryCache {
  return {
    content: entry.content,
    dirty: false,
    entryDate: entry.entryDate,
    updatedAt: entry.updatedAt,
    version: entry.version,
    wordCount: entry.wordCount,
  };
}

export function removeUserCloudCaches(
  userId: string,
  storage: Storage | null = getStorage(),
): void {
  if (!storage) {
    return;
  }

  const prefix = `${CLOUD_CACHE_PREFIX}${userId}:`;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) {
      keys.push(key);
    }
  }

  keys.forEach((key) => storage.removeItem(key));
}

export function listUserCloudCaches(
  userId: string,
  storage: Storage | null = getStorage(),
): CloudEntryCache[] {
  if (!storage) {
    return [];
  }

  const prefix = `${CLOUD_CACHE_PREFIX}${userId}:entry:`;
  const caches: CloudEntryCache[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) {
      continue;
    }

    const entryDate = key.slice(prefix.length);
    const cache = loadCloudCache(userId, entryDate, storage);
    if (cache) {
      caches.push(cache);
    }
  }

  return caches.sort((left, right) => left.entryDate.localeCompare(right.entryDate));
}
