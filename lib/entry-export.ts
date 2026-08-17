import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { CloudEntry, Profile } from "@/types/cloud";
import type { HabitPreferences } from "@/types/habit";
import type {
  PortableArchiveV1,
  PortablePromptAssignment,
} from "@/types/history";

type Client = SupabaseClient<Database>;

function readableDate(entryDate: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${entryDate}T00:00:00Z`));
}

export function serializePlainTextEntries(entries: CloudEntry[]): string {
  const byDate = new Map(entries.map((entry) => [entry.entryDate, entry]));
  const ordered = [...byDate.values()].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const body = ordered.map((entry) => [
    readableDate(entry.entryDate),
    `${entry.wordCount} ${entry.wordCount === 1 ? "word" : "words"}`,
    "-".repeat(48),
    entry.content,
  ].join("\n")).join("\n\n\n");

  return [
    "365x100 Journal Export",
    `Entries: ${ordered.length}`,
    "",
    body,
    "",
  ].join("\n");
}

async function fetchPromptAssignments(client: Client): Promise<PortablePromptAssignment[]> {
  const assignments: Database["public"]["Tables"]["daily_prompt_assignments"]["Row"][] = [];
  const pageSize = 250;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("daily_prompt_assignments")
      .select("*")
      .order("entry_date", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Prompt assignments could not be exported.");
    assignments.push(...data);
    if (data.length < pageSize) break;
  }

  const promptIds = [...new Set(assignments.map((assignment) => assignment.prompt_id))];
  const prompts = new Map<number, { body: string; category: string }>();
  for (let index = 0; index < promptIds.length; index += 100) {
    const { data, error } = await client
      .from("prompts")
      .select("id, body, category")
      .in("id", promptIds.slice(index, index + 100));
    if (error) throw new Error("Prompt assignments could not be exported.");
    for (const prompt of data) prompts.set(prompt.id, prompt);
  }

  return assignments.map((assignment) => ({
    category: prompts.get(assignment.prompt_id)?.category ?? null,
    entryDate: assignment.entry_date,
    prompt: prompts.get(assignment.prompt_id)?.body ?? null,
    refreshedAt: assignment.refreshed_at,
  }));
}

export async function buildPortableArchive(
  client: Client,
  input: {
    email: string;
    entries: CloudEntry[];
    preferences: HabitPreferences;
    profile: Profile;
  },
): Promise<PortableArchiveV1> {
  return createPortableArchive(input, await fetchPromptAssignments(client));
}

export function createPortableArchive(
  input: {
    email: string;
    entries: CloudEntry[];
    preferences: HabitPreferences;
    profile: Profile;
  },
  promptAssignments: PortablePromptAssignment[],
  exportedAt = new Date().toISOString(),
): PortableArchiveV1 {
  return {
    account: {
      email: input.email,
      preferences: input.preferences,
      timezone: input.profile.timezone,
    },
    entries: [...input.entries]
      .sort((a, b) => a.entryDate.localeCompare(b.entryDate))
      .map((entry) => ({
        completedAt: entry.completedAt,
        content: entry.content,
        contentRich: entry.richContent,
        createdAt: entry.createdAt,
        entryDate: entry.entryDate,
        updatedAt: entry.updatedAt,
        wordCount: entry.wordCount,
      })),
    exportedAt,
    format: "365x100-portable-archive",
    promptAssignments,
    version: 1,
  };
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
