import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { CloudEntry, Profile } from "@/types/cloud";
import type { HabitPreferences } from "@/types/habit";
import type {
  PortableArchiveV1,
  PortableArchiveV2,
  PortablePromptAssignment,
} from "@/types/history";
import { strToU8, Zip, zip, ZipPassThrough } from "fflate";
import { downloadMediaBlob } from "@/lib/entry-media";

type Client = SupabaseClient<Database>;
const MAX_BLOB_ARCHIVE_BYTES = 200_000_000;

interface ArchiveWritable {
  abort?: () => Promise<void>;
  close: () => Promise<void>;
  write: (data: Uint8Array) => Promise<void>;
}

interface FilePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ accept: Record<string, string[]>; description: string }>;
  }) => Promise<{ createWritable: () => Promise<ArchiveWritable> }>;
}

export class PortableArchiveTooLargeError extends Error {
  constructor() {
    super("This archive is too large for an in-memory mobile download. Use a supported desktop browser to stream it safely.");
    this.name = "PortableArchiveTooLargeError";
  }
}

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

function zipFiles(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, { level: 0 }, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

function portableMedia(entries: CloudEntry[]): PortableArchiveV2["media"] {
  return [...entries]
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate))
    .flatMap((entry) => entry.media ? [{
      byteSize: entry.media.byteSize,
      createdAt: entry.media.createdAt,
      entryDate: entry.entryDate,
      file: `photos/${entry.entryDate}.webp`,
      height: entry.media.height,
      mimeType: "image/webp" as const,
      updatedAt: entry.media.updatedAt,
      width: entry.media.width,
    }] : []);
}

export function portableZipByteEstimate(entries: CloudEntry[]): number {
  return entries.reduce((total, entry) => total + (entry.media?.byteSize ?? 0), 0)
    + new TextEncoder().encode(JSON.stringify(entries.map((entry) => ({
      content: entry.content,
      contentRich: entry.richContent,
      entryDate: entry.entryDate,
    })))).byteLength
    + 1_000_000;
}

export async function choosePortableZipDestination(filename: string): Promise<ArchiveWritable | null> {
  if (typeof window === "undefined") return null;
  if (window.matchMedia("(pointer: coarse)").matches) return null;
  const picker = (window as FilePickerWindow).showSaveFilePicker;
  if (!picker) return null;
  const handle = await picker({
    suggestedName: filename,
    types: [{ accept: { "application/zip": [".zip"] }, description: "365x100 portable archive" }],
  });
  return handle.createWritable();
}

async function streamZip(
  writable: ArchiveWritable,
  entries: Array<{ bytes: () => Promise<Uint8Array>; name: string }>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let writeChain = Promise.resolve();
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      void writable.abort?.().finally(() => reject(error));
    };
    const archive = new Zip((error, data, final) => {
      if (error) {
        fail(error);
        return;
      }
      writeChain = writeChain.then(() => writable.write(data));
      if (final) {
        writeChain.then(() => writable.close()).then(() => {
          if (!settled) {
            settled = true;
            resolve();
          }
        }, fail);
      }
    });

    void (async () => {
      try {
        for (const entry of entries) {
          const file = new ZipPassThrough(entry.name);
          archive.add(file);
          file.push(await entry.bytes(), true);
        }
        archive.end();
      } catch (error) {
        fail(error);
      }
    })();
  });
}

export async function buildPortableZip(
  client: Client,
  input: {
    email: string;
    entries: CloudEntry[];
    preferences: HabitPreferences;
    profile: Profile;
  },
): Promise<Blob> {
  const promptAssignments = await fetchPromptAssignments(client);
  const base = createPortableArchive(input, promptAssignments);
  const files: Record<string, Uint8Array> = {};
  const media = portableMedia(input.entries);

  if (portableZipByteEstimate(input.entries) > MAX_BLOB_ARCHIVE_BYTES) {
    throw new PortableArchiveTooLargeError();
  }

  for (const entry of [...input.entries].sort((a, b) => a.entryDate.localeCompare(b.entryDate))) {
    if (!entry.media) continue;
    const filename = `photos/${entry.entryDate}.webp`;
    const blob = await downloadMediaBlob(client, entry.media);
    files[filename] = new Uint8Array(await blob.arrayBuffer());
  }

  const archive: PortableArchiveV2 = { ...base, media, version: 2 };
  files["365x100-data.json"] = strToU8(JSON.stringify(archive, null, 2));
  const zipBytes = await zipFiles(files);
  const zipBuffer = new ArrayBuffer(zipBytes.byteLength);
  new Uint8Array(zipBuffer).set(zipBytes);
  return new Blob([zipBuffer], { type: "application/zip" });
}

export async function streamPortableZip(
  client: Client,
  writable: ArchiveWritable,
  input: {
    email: string;
    entries: CloudEntry[];
    preferences: HabitPreferences;
    profile: Profile;
  },
): Promise<void> {
  const promptAssignments = await fetchPromptAssignments(client);
  const archive: PortableArchiveV2 = {
    ...createPortableArchive(input, promptAssignments),
    media: portableMedia(input.entries),
    version: 2,
  };
  const files = [...input.entries]
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate))
    .flatMap((entry) => entry.media ? [{
      bytes: async () => new Uint8Array(await (await downloadMediaBlob(client, entry.media!)).arrayBuffer()),
      name: `photos/${entry.entryDate}.webp`,
    }] : []);
  files.push({
    bytes: async () => strToU8(JSON.stringify(archive, null, 2)),
    name: "365x100-data.json",
  });
  await streamZip(writable, files);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
