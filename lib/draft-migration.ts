import type { SupabaseClient } from "@supabase/supabase-js";

import {
  cacheFromCloudEntry,
  listUserCloudCaches,
  saveCloudCache,
} from "@/lib/cloud-cache";
import {
  fetchCloudEntries,
  saveCloudEntry,
} from "@/lib/cloud-entry";
import type { Database } from "@/lib/database.types";
import { listEntries, removeEntry } from "@/lib/entry-storage";
import { countWords } from "@/lib/word-count";
import type { MigrationConflict } from "@/types/cloud";

type Client = SupabaseClient<Database>;

export type AnonymousMigrationDecision = "confirmed" | "conflict" | "upload";

export function decideAnonymousMigration(
  localContent: string,
  remoteContent: string | null,
): AnonymousMigrationDecision {
  if (remoteContent === null) {
    return "upload";
  }

  return remoteContent === localContent ? "confirmed" : "conflict";
}

export async function migrateAnonymousEntries(
  client: Client,
  userId: string,
): Promise<MigrationConflict[]> {
  const localEntries = listEntries();
  const remoteEntries = await fetchCloudEntries(
    client,
    localEntries.map((entry) => entry.entryDate),
  );
  const remoteByDate = new Map(remoteEntries.map((entry) => [entry.entryDate, entry]));
  const conflicts: MigrationConflict[] = [];

  for (const local of localEntries) {
    const remote = remoteByDate.get(local.entryDate);
    const decision = decideAnonymousMigration(
      local.content,
      remote?.content ?? null,
    );
    if (decision === "conflict" && remote) {
      conflicts.push({
        entryDate: local.entryDate,
        localContent: local.content,
        remote,
      });
      continue;
    }

    if (decision === "confirmed" && remote) {
      saveCloudCache(userId, cacheFromCloudEntry(remote));
      removeEntry(local.entryDate);
      continue;
    }

    const result = await saveCloudEntry(client, {
      content: local.content,
      entryDate: local.entryDate,
      expectedVersion: 0,
      wordCount: countWords(local.content),
    });

    if (result.status === "conflict" && result.remote) {
      conflicts.push({
        entryDate: local.entryDate,
        localContent: local.content,
        remote: result.remote,
      });
      continue;
    }

    if (result.status === "saved") {
      saveCloudCache(userId, cacheFromCloudEntry(result.entry));
      removeEntry(local.entryDate);
    }
  }

  return conflicts;
}

export async function reconcileDirtyCaches(
  client: Client,
  userId: string,
): Promise<MigrationConflict[]> {
  const dirtyCaches = listUserCloudCaches(userId).filter((cache) => cache.dirty);
  const remotes = await fetchCloudEntries(
    client,
    dirtyCaches.map((cache) => cache.entryDate),
  );
  const remoteByDate = new Map(remotes.map((entry) => [entry.entryDate, entry]));
  const conflicts: MigrationConflict[] = [];

  for (const cache of dirtyCaches) {
    const remote = remoteByDate.get(cache.entryDate) ?? null;
    if (remote?.content === cache.content) {
      saveCloudCache(userId, cacheFromCloudEntry(remote));
      continue;
    }

    if (remote && remote.version !== cache.version && remote.content !== cache.content) {
      conflicts.push({
        entryDate: cache.entryDate,
        localContent: cache.content,
        remote,
      });
      continue;
    }

    const result = await saveCloudEntry(client, {
      content: cache.content,
      entryDate: cache.entryDate,
      expectedVersion: remote?.version ?? 0,
      wordCount: cache.wordCount,
    });
    if (result.status === "saved") {
      saveCloudCache(userId, cacheFromCloudEntry(result.entry));
    } else if (result.remote) {
      conflicts.push({
        entryDate: cache.entryDate,
        localContent: cache.content,
        remote: result.remote,
      });
    }
  }

  return conflicts;
}
