import type { RichEntryDocument } from "@/lib/rich-text";
import type { HabitPreferences } from "@/types/habit";
import type { EntryMedia } from "@/types/media";

export type JournalLibraryView = "progress" | "calendar" | "history";

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
