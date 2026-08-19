import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/database.types";
import { mapEntryMedia } from "@/lib/entry-media";
import { sanitizeRichEntryDocument } from "@/lib/rich-text";
import type {
  EditorialSection,
  PublicationDocument,
  PublicationEditorial,
  PublicationFeedback,
  PublicationLibrary,
  PublicationMode,
  PublicationRecord,
  PublicationSummary,
} from "@/types/publication";

type Client = SupabaseClient<Database>;
type ObjectJson = Record<string, Json | undefined>;

function object(value: Json | undefined): ObjectJson | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function string(value: Json | undefined, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: Json | undefined, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function publicationSummary(value: Json | undefined): PublicationSummary | null {
  const row = object(value);
  if (!row || typeof row.id !== "string") return null;
  return {
    coverMediaId: typeof row.coverMediaId === "string" ? row.coverMediaId : null,
    generationCount: number(row.generationCount),
    id: row.id,
    mode: row.mode === "ai" ? "ai" : "original",
    sectionRegenerationCount: number(row.sectionRegenerationCount),
    staleReason: row.staleReason === "source-title" || row.staleReason === "source-text" ? row.staleReason : null,
    state: ["draft", "eligible", "failed", "generating", "ready", "stale"].includes(string(row.state))
      ? string(row.state) as PublicationSummary["state"]
      : "eligible",
    title: string(row.title),
    updatedAt: string(row.updatedAt),
  };
}

export function parsePublicationLibrary(value: Json): PublicationLibrary {
  const root = object(value);
  if (!root || !Array.isArray(root.items)) throw new Error("Publication library is invalid.");
  return {
    aiEntitled: root.aiEntitled === true,
    disclosureVersion: string(root.disclosureVersion),
    generationLimit: number(root.generationLimit),
    items: root.items.map((item) => {
      const row = object(item);
      if (!row) throw new Error("Publication month is invalid.");
      return {
        eligible: row.eligible === true,
        ended: row.ended === true,
        entryCount: number(row.entryCount),
        monthEnd: string(row.monthEnd),
        monthStart: string(row.monthStart),
        publication: publicationSummary(row.publication),
        words: number(row.words),
        writingDays: number(row.writingDays),
      };
    }),
    sectionRegenerationLimit: number(root.sectionRegenerationLimit),
  };
}

export function sanitizePublicationEditorial(value: unknown): PublicationEditorial | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.version !== 1 || typeof row.title !== "string" || typeof row.review !== "string"
    || !Array.isArray(row.themes) || !Array.isArray(row.moments) || !Array.isArray(row.quotations)) return null;
  if (!row.themes.every((item) => typeof item === "string")) return null;
  const moments = row.moments.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const moment = item as Record<string, unknown>;
    return typeof moment.date === "string" && typeof moment.sourceRef === "string" && typeof moment.text === "string"
      ? [{ date: moment.date, sourceRef: moment.sourceRef, text: moment.text }] : [];
  });
  const quotations = row.quotations.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const quote = item as Record<string, unknown>;
    return typeof quote.date === "string" && typeof quote.sourceRef === "string" && typeof quote.quote === "string"
      ? [{ date: quote.date, quote: quote.quote, sourceRef: quote.sourceRef }] : [];
  });
  if (moments.length !== row.moments.length || quotations.length !== row.quotations.length) return null;
  return {
    moments,
    quotations,
    review: row.review.slice(0, 6000),
    themes: (row.themes as string[]).map((item) => item.slice(0, 200)).slice(0, 12),
    title: row.title.slice(0, 120),
    version: 1,
  };
}

export async function fetchPublicationLibrary(client: Client): Promise<PublicationLibrary> {
  const { data, error } = await client.rpc("get_publication_library");
  if (error || !data) throw new Error("Books could not be loaded.");
  return parsePublicationLibrary(data);
}

export async function createMonthlyPublication(client: Client, monthStart: string, mode: PublicationMode): Promise<string> {
  const { data, error } = await client.rpc("create_monthly_publication", { p_mode: mode, p_month: monthStart });
  const row = object(data ?? undefined);
  if (error || !row || typeof row.id !== "string") throw new Error("Chapter could not be created.");
  return row.id;
}

export function parsePublicationDocument(value: Json): PublicationDocument {
  const root = object(value);
  const rawPublication = object(root?.publication);
  if (!root || !rawPublication || typeof rawPublication.id !== "string" || !Array.isArray(root.entries)) {
    throw new Error("Publication document is invalid.");
  }
  const base = publicationSummary({
    coverMediaId: rawPublication.cover_media_id,
    generationCount: rawPublication.generation_count,
    id: rawPublication.id,
    mode: rawPublication.mode,
    sectionRegenerationCount: rawPublication.section_regeneration_count,
    staleReason: rawPublication.stale_reason,
    state: rawPublication.state,
    title: rawPublication.title,
    updatedAt: rawPublication.updated_at,
  });
  if (!base) throw new Error("Publication document is invalid.");
  const publication: PublicationRecord = {
    ...base,
    approvedVersionId: typeof rawPublication.approved_version_id === "string" ? rawPublication.approved_version_id : null,
    currentDraftVersionId: typeof rawPublication.current_draft_version_id === "string" ? rawPublication.current_draft_version_id : null,
    periodEnd: string(rawPublication.period_end),
    periodStart: string(rawPublication.period_start),
    scope: rawPublication.scope === "annual" ? "annual" : "monthly",
  };
  const version = object(root.editorialVersion);
  const editorial = sanitizePublicationEditorial(version?.editorial ?? null);
  const entries = root.entries.map((item) => {
    const entry = object(item);
    if (!entry || typeof entry.id !== "string") throw new Error("Publication entry is invalid.");
    return {
      content: string(entry.content),
      entryDate: string(entry.entryDate),
      id: entry.id,
      media: object(entry.media) ? mapEntryMedia(entry.media as ObjectJson) : null,
      richContent: sanitizeRichEntryDocument(entry.richContent),
      title: string(entry.title),
      version: number(entry.version),
      wordCount: number(entry.wordCount),
    };
  });
  return { editorial, entries, publication };
}

export async function fetchPublicationDocument(client: Client, publicationId: string): Promise<PublicationDocument> {
  const { data, error } = await client.rpc("get_publication_document", { p_publication_id: publicationId });
  if (error || !data) throw new Error("Chapter could not be loaded.");
  return parsePublicationDocument(data);
}

export async function savePublicationDraft(client: Client, publicationId: string, title: string, editorial: PublicationEditorial): Promise<void> {
  const { error } = await client.rpc("save_publication_draft", {
    p_editorial: editorial as unknown as Json,
    p_publication_id: publicationId,
    p_title: title.slice(0, 120),
  });
  if (error) throw new Error("Chapter draft could not be saved.");
}

export async function approvePublication(client: Client, publicationId: string): Promise<void> {
  const { error } = await client.rpc("approve_publication", { p_publication_id: publicationId });
  if (error) throw new Error("Chapter could not be approved.");
}

export async function setPublicationCover(client: Client, publicationId: string, mediaId: string | null): Promise<void> {
  const { error } = await client.rpc("set_publication_cover", { p_media_id: mediaId, p_publication_id: publicationId });
  if (error) throw new Error("Cover could not be updated.");
}

export async function deletePublication(client: Client, publicationId: string): Promise<void> {
  const { data, error } = await client.rpc("delete_publication", { p_publication_id: publicationId });
  if (error || !data) throw new Error("Generated chapter could not be deleted.");
}

export async function acceptAiProcessing(client: Client, publicationId: string): Promise<void> {
  const { error } = await client.rpc("accept_ai_processing", { p_publication_id: publicationId });
  if (error) throw new Error("AI processing consent could not be recorded.");
}

export async function generatePublication(client: Client, publicationId: string, section: EditorialSection | "full", idempotencyKey = crypto.randomUUID()): Promise<void> {
  const { error } = await client.functions.invoke("generate-publication", {
    body: { idempotencyKey, publicationId, section },
  });
  if (error) throw new Error("The editorial request could not be completed.");
}

export async function recordPublicationFeedback(client: Client, publicationId: string, verdict: PublicationFeedback): Promise<void> {
  const { error } = await client.rpc("record_publication_feedback", { p_publication_id: publicationId, p_verdict: verdict });
  if (error) throw new Error("Feedback could not be recorded.");
}

export async function recordPublicationEvent(
  client: Client,
  eventName: "books_viewed" | "pdf_downloaded",
  publicationId: string | null = null,
): Promise<void> {
  await client.rpc("record_publication_event", { p_event_name: eventName, p_publication_id: publicationId });
}
