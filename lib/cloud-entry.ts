import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json, Tables } from "@/lib/database.types";
import {
  asDatabaseJson,
  plainTextFromRichDocument,
  sanitizeRichEntryDocument,
  type RichEntryDocument,
} from "@/lib/rich-text";
import type { CloudEntry, Profile, SaveEntryResult } from "@/types/cloud";

type Client = SupabaseClient<Database>;
type EntryRow = Tables<"entries">;
type ProfileRow = Tables<"profiles">;

export class CloudRequestError extends Error {
  constructor(message: string, readonly retryable = true) {
    super(message);
    this.name = "CloudRequestError";
  }
}

function mapEntry(row: EntryRow): CloudEntry {
  const richContent = sanitizeRichEntryDocument(row.content_rich);
  return {
    completedAt: row.completed_at,
    content: row.content,
    richContent:
      richContent && plainTextFromRichDocument(richContent) === row.content
        ? richContent
        : null,
    createdAt: row.created_at,
    entryDate: row.entry_date,
    id: row.id,
    updatedAt: row.updated_at,
    userId: row.user_id,
    version: row.version,
    wordCount: row.word_count,
  };
}

function mapProfile(row: ProfileRow): Profile {
  return {
    createdAt: row.created_at,
    dailyPromptsEnabled: row.daily_prompts_enabled,
    habitOnboardingCompleted: row.habit_onboarding_completed,
    lastWelcomeBackDate: row.last_welcome_back_date,
    timezone: row.timezone,
    updatedAt: row.updated_at,
    userId: row.user_id,
    weeklyReviewDay: row.weekly_review_day,
    weeklyReviewEnabled: row.weekly_review_enabled,
    weeklyReviewTime: row.weekly_review_time,
  };
}

export function mapProfileRow(row: ProfileRow): Profile {
  return mapProfile(row);
}

function isObject(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEntry(value: Json | undefined): CloudEntry | null {
  if (!value || !isObject(value)) {
    return null;
  }

  const row = value as Record<string, Json | undefined>;
  if (
    typeof row.id !== "string" ||
    typeof row.user_id !== "string" ||
    typeof row.entry_date !== "string" ||
    typeof row.content !== "string" ||
    typeof row.word_count !== "number" ||
    typeof row.version !== "number" ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string" ||
    (row.completed_at !== null && typeof row.completed_at !== "string")
  ) {
    return null;
  }

  return mapEntry(row as unknown as EntryRow);
}

export async function fetchProfile(client: Client): Promise<Profile | null> {
  const { data, error } = await client.from("profiles").select("*").maybeSingle();
  if (error) {
    throw new CloudRequestError("Profile could not be loaded.");
  }

  return data ? mapProfile(data) : null;
}

export async function saveProfileTimezone(
  client: Client,
  timezone: string,
): Promise<Profile> {
  const { data, error } = await client.rpc("set_profile_timezone", {
    p_timezone: timezone,
  });
  if (error || !data) {
    throw new CloudRequestError("Timezone could not be saved.");
  }

  return mapProfile(data);
}

export async function fetchCloudEntry(
  client: Client,
  entryDate: string,
): Promise<CloudEntry | null> {
  const { data, error } = await client
    .from("entries")
    .select("*")
    .eq("entry_date", entryDate)
    .maybeSingle();
  if (error) {
    throw new CloudRequestError("Entry could not be loaded.");
  }

  return data ? mapEntry(data) : null;
}

export async function fetchCloudEntries(
  client: Client,
  entryDates: string[],
): Promise<CloudEntry[]> {
  if (entryDates.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("entries")
    .select("*")
    .in("entry_date", entryDates);
  if (error) {
    throw new CloudRequestError("Entries could not be loaded.");
  }

  return data.map(mapEntry);
}

export async function saveCloudEntry(
  client: Client,
  input: {
    entryDate: string;
    content: string;
    wordCount: number;
    expectedVersion: number;
    richContent: RichEntryDocument | null;
  },
): Promise<SaveEntryResult> {
  const request = input.richContent
    ? client.rpc("save_rich_entry", {
        p_content: input.content,
        p_content_rich: asDatabaseJson(input.richContent)!,
        p_entry_date: input.entryDate,
        p_expected_version: input.expectedVersion,
        p_word_count: input.wordCount,
      })
    : client.rpc("save_entry", {
        p_content: input.content,
        p_entry_date: input.entryDate,
        p_expected_version: input.expectedVersion,
        p_word_count: input.wordCount,
      });
  const { data, error } = await request;
  if (error || !data || !isObject(data)) {
    throw new CloudRequestError("Entry could not be saved.");
  }

  if (data.status === "saved") {
    const entry = parseEntry(data.entry);
    if (!entry) {
      throw new CloudRequestError("Cloud returned an invalid entry.", false);
    }
    return { status: "saved", entry };
  }

  if (data.status === "conflict") {
    return { status: "conflict", remote: parseEntry(data.remote) };
  }

  throw new CloudRequestError("Cloud returned an unknown save result.", false);
}
