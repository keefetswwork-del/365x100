import type { RichEntryDocument } from "@/lib/rich-text";
import type { HabitPreferences } from "@/types/habit";
import type { EntryMedia } from "@/types/media";

export type JournalLibraryView = "progress" | "calendar" | "history" | "books";

export interface HistoryFilters {
  query: string;
  fromDate: string | null;
  toDate: string | null;
}

export interface HistoryEntrySummary {
  completed: boolean;
  entryDate: string;
  excerpt: string;
  updatedAt: string;
  wordCount: number;
  media?: EntryMedia | null;
  title?: string;
}

export interface HistoryPage {
  hasMore: boolean;
  items: HistoryEntrySummary[];
  nextCursor: string | null;
}

export interface PortableArchiveEntry {
  completedAt: string | null;
  content: string;
  contentRich: RichEntryDocument | null;
  createdAt: string;
  entryDate: string;
  updatedAt: string;
  wordCount: number;
  title: string;
}

export interface PortablePromptAssignment {
  category: string | null;
  entryDate: string;
  prompt: string | null;
  refreshedAt: string | null;
}

export interface PortableArchiveV1 {
  account: {
    email: string;
    preferences: HabitPreferences;
    timezone: string;
  };
  entries: PortableArchiveEntry[];
  exportedAt: string;
  format: "365x100-portable-archive";
  promptAssignments: PortablePromptAssignment[];
  version: 1;
}

export interface PortableArchiveMedia {
  byteSize: number;
  createdAt: string;
  entryDate: string;
  file: string;
  height: number;
  mimeType: "image/webp";
  updatedAt: string;
  width: number;
}

export interface PortableArchiveV2 extends Omit<PortableArchiveV1, "version"> {
  media: PortableArchiveMedia[];
  version: 2;
}

export interface PortableArchiveV3 extends Omit<PortableArchiveV2, "version"> {
  consents: Array<{
    acceptedAt: string;
    kind: string;
    periodStart: string | null;
    version: string;
  }>;
  publications: Array<{
    approvedEditorial: Record<string, unknown> | null;
    mode: "ai" | "original";
    periodEnd: string;
    periodStart: string;
    scope: "annual" | "monthly";
    state: string;
    title: string;
  }>;
  version: 3;
}
