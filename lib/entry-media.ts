import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json, Tables } from "@/lib/database.types";
import type {
  EntryMedia,
  MediaAccountStatus,
  MediaFailureCategory,
  MediaMutationResult,
} from "@/types/media";

type Client = SupabaseClient<Database>;
type MediaRow = Tables<"entry_media">;

export class MediaConflictError extends Error {
  constructor(readonly remote: EntryMedia | null) {
    super("Photo changed on another device.");
    this.name = "MediaConflictError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mapEntryMedia(row: MediaRow | Record<string, unknown>): EntryMedia {
  return {
    id: String(row.id),
    storagePath: String("storage_path" in row ? row.storage_path : row.storagePath),
    mimeType: "image/webp",
    byteSize: Number("byte_size" in row ? row.byte_size : row.byteSize),
    width: Number(row.width),
    height: Number(row.height),
    version: Number(row.version),
    createdAt: String("created_at" in row ? row.created_at : row.createdAt),
    updatedAt: String("updated_at" in row ? row.updated_at : row.updatedAt),
  };
}

export function parseMediaAccountStatus(value: Json): MediaAccountStatus {
  if (!isRecord(value)) throw new Error("Photo account status is invalid.");
  if (
    (value.tier !== "free" && value.tier !== "premium")
    || typeof value.storedCount !== "number"
    || (value.limit !== null && typeof value.limit !== "number")
    || typeof value.canAdd !== "boolean"
    || typeof value.privacyAccepted !== "boolean"
    || typeof value.privacyVersion !== "string"
  ) throw new Error("Photo account status is invalid.");
  return value as unknown as MediaAccountStatus;
}

export async function fetchMediaAccountStatus(client: Client): Promise<MediaAccountStatus> {
  const { data, error } = await client.rpc("get_media_account_status");
  if (error || !data) throw new Error("Photo access could not be loaded.");
  return parseMediaAccountStatus(data);
}

export async function acceptMediaPrivacy(client: Client): Promise<MediaAccountStatus> {
  const { data, error } = await client.rpc("accept_media_privacy");
  if (error || !data) throw new Error("Photo privacy acceptance could not be saved.");
  return parseMediaAccountStatus(data);
}

export async function fetchEntryMedia(client: Client, entryId: string): Promise<EntryMedia | null> {
  const { data, error } = await client.from("entry_media").select("*").eq("entry_id", entryId).maybeSingle();
  if (error) throw new Error("Photo could not be loaded.");
  return data ? mapEntryMedia(data) : null;
}

export async function fetchAllEntryMedia(client: Client): Promise<Array<EntryMedia & { entryId: string }>> {
  const output: Array<EntryMedia & { entryId: string }> = [];
  for (let offset = 0; ; offset += 250) {
    const { data, error } = await client.from("entry_media").select("*").order("created_at").range(offset, offset + 249);
    if (error) throw new Error("Photos could not be exported.");
    output.push(...data.map((row) => ({ ...mapEntryMedia(row), entryId: row.entry_id })));
    if (data.length < 250) return output;
  }
}

export async function createMediaSignedUrl(client: Client, media: EntryMedia): Promise<string> {
  const { data, error } = await client.storage.from("journal-media").createSignedUrl(media.storagePath, 900);
  if (error || !data?.signedUrl) throw new Error("Photo access could not be created.");
  return data.signedUrl;
}

export async function downloadMediaBlob(client: Client, media: EntryMedia): Promise<Blob> {
  const { data, error } = await client.storage.from("journal-media").download(media.storagePath);
  if (error || !data) throw new Error("Photo could not be downloaded.");
  return data;
}

export async function uploadEntryMedia(
  client: Client,
  input: {
    blob: Blob;
    entryId: string;
    expected: EntryMedia | null;
    operationId: string;
  },
): Promise<MediaMutationResult> {
  const form = new FormData();
  form.set("file", new File([input.blob], "photo.webp", { type: "image/webp" }));
  form.set("entryId", input.entryId);
  form.set("operationId", input.operationId);
  if (input.expected) {
    form.set("expectedMediaId", input.expected.id);
    form.set("expectedVersion", String(input.expected.version));
  }
  const { data, error } = await client.functions.invoke("journal-media", { body: form });
  if (error) {
    const context = "context" in error ? (error as { context?: Response }).context : undefined;
    if (context) {
      const body = await context.clone().json().catch(() => null);
      if (isRecord(body) && body.status === "limit") return body as unknown as MediaMutationResult;
      if (isRecord(body) && body.status === "privacy-required") return { status: "privacy-required" };
      if (isRecord(body) && body.status === "conflict") {
        return { status: "conflict", remote: isRecord(body.remote) ? mapEntryMedia(body.remote) : null };
      }
    }
    throw new Error("Photo upload failed.");
  }
  if (!isRecord(data) || data.status !== "saved" || !isRecord(data.media)) throw new Error("Photo upload returned an invalid response.");
  return { status: "saved", media: mapEntryMedia(data.media) };
}

export async function removeEntryMedia(client: Client, media: EntryMedia, operationId: string): Promise<void> {
  const { error } = await client.functions.invoke("journal-media", {
    body: { mediaId: media.id, operationId, version: media.version },
    method: "DELETE",
  });
  if (error) {
    const context = "context" in error ? (error as { context?: Response }).context : undefined;
    if (context?.status === 409) {
      const body = await context.clone().json().catch(() => null);
      throw new MediaConflictError(isRecord(body?.remote) ? mapEntryMedia(body.remote) : null);
    }
    throw new Error("Photo could not be removed.");
  }
}

export async function recordMediaEvent(
  client: Client,
  input: {
    durationBucket?: string;
    entryDate: string;
    eventName: string;
    failureCategory?: MediaFailureCategory;
    operationId: string;
    sizeBucket?: string;
  },
): Promise<void> {
  await client.rpc("record_media_event", {
    p_duration_bucket: input.durationBucket ?? null,
    p_entry_date: input.entryDate,
    p_event_name: input.eventName,
    p_failure_category: input.failureCategory ?? null,
    p_operation_id: input.operationId,
    p_size_bucket: input.sizeBucket ?? null,
  }).then(() => undefined, () => undefined);
}
