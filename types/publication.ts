import type { RichEntryDocument } from "@/lib/rich-text";
import type { EntryMedia } from "@/types/media";

export type PublicationMode = "ai" | "original";
export type PublicationState = "draft" | "eligible" | "failed" | "generating" | "ready" | "stale";
export type EditorialSection = "moments" | "quotations" | "review" | "themes" | "title";

export interface PublicationSummary {
  coverMediaId: string | null;
  generationCount: number;
  id: string;
  mode: PublicationMode;
  sectionRegenerationCount: number;
  staleReason: "source-text" | "source-title" | null;
  state: PublicationState;
  title: string;
  updatedAt: string;
}

export interface PublicationMonth {
  eligible: boolean;
  ended: boolean;
  entryCount: number;
  monthEnd: string;
  monthStart: string;
  publication: PublicationSummary | null;
  words: number;
  writingDays: number;
}

export interface PublicationLibrary {
  aiEntitled: boolean;
  disclosureVersion: string;
  generationLimit: number;
  items: PublicationMonth[];
  sectionRegenerationLimit: number;
}

export interface EditorialMoment {
  date: string;
  sourceRef: string;
  text: string;
}

export interface EditorialQuotation {
  date: string;
  quote: string;
  sourceRef: string;
}

export interface PublicationEditorial {
  moments: EditorialMoment[];
  quotations: EditorialQuotation[];
  review: string;
  themes: string[];
  title: string;
  version: 1;
}

export interface PublicationEntry {
  content: string;
  entryDate: string;
  id: string;
  media: EntryMedia | null;
  richContent: RichEntryDocument | null;
  title: string;
  version: number;
  wordCount: number;
}

export interface PublicationRecord extends PublicationSummary {
  approvedVersionId: string | null;
  currentDraftVersionId: string | null;
  periodEnd: string;
  periodStart: string;
  scope: "annual" | "monthly";
}

export interface PublicationDocument {
  editorial: PublicationEditorial | null;
  entries: PublicationEntry[];
  publication: PublicationRecord;
}

export type PublicationFeedback = "accurate" | "invented-fact" | "needs-review";
