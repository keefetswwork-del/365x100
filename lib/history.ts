import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/database.types";
import type {
  HistoryEntrySummary,
  HistoryFilters,
  HistoryPage,
} from "@/types/history";

type Client = SupabaseClient<Database>;

function isObject(value: Json | undefined): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseHistoryItem(value: Json): HistoryEntrySummary | null {
  if (!isObject(value)) return null;
  if (
    typeof value.entryDate !== "string" ||
    typeof value.excerpt !== "string" ||
    typeof value.wordCount !== "number" ||
    typeof value.completed !== "boolean" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    completed: value.completed,
    entryDate: value.entryDate,
    excerpt: value.excerpt,
    updatedAt: value.updatedAt,
    wordCount: value.wordCount,
  };
}

export function parseHistoryPage(value: Json): HistoryPage {
  if (!isObject(value) || !Array.isArray(value.items)) {
    throw new Error("History response is invalid.");
  }

  const items = value.items.map(parseHistoryItem);
  if (items.some((item) => item === null)) {
    throw new Error("History response is invalid.");
  }

  return {
    hasMore: value.hasMore === true,
    items: items as HistoryEntrySummary[],
    nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null,
  };
}

export async function fetchEntryHistory(
  client: Client,
  filters: HistoryFilters,
  beforeDate: string | null = null,
): Promise<HistoryPage> {
  const { data, error } = await client.rpc("get_entry_history", {
    p_before_date: beforeDate ?? undefined,
    p_from_date: filters.fromDate ?? undefined,
    p_limit: 30,
    p_query: filters.query.trim() || undefined,
    p_to_date: filters.toDate ?? undefined,
  });

  if (error || !data) {
    throw new Error("History could not be loaded.");
  }

  return parseHistoryPage(data);
}

export function mergeHistoryPages(
  current: HistoryEntrySummary[],
  next: HistoryEntrySummary[],
): HistoryEntrySummary[] {
  const entries = new Map(current.map((entry) => [entry.entryDate, entry]));
  for (const entry of next) entries.set(entry.entryDate, entry);
  return [...entries.values()].sort((a, b) => b.entryDate.localeCompare(a.entryDate));
}
