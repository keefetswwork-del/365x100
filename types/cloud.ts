export type CloudSaveStatus =
  | "restoring"
  | "saved-local"
  | "saving-local"
  | "saving-cloud"
  | "saved-cloud"
  | "offline"
  | "retrying"
  | "conflict"
  | "error";

export interface Profile {
  userId: string;
  timezone: string;
  dailyPromptsEnabled: boolean;
  habitOnboardingCompleted: boolean;
  lastWelcomeBackDate: string | null;
  weeklyReviewDay: number;
  weeklyReviewEnabled: boolean;
  weeklyReviewTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudEntry {
  id: string;
  userId: string;
  entryDate: string;
  content: string;
  wordCount: number;
  completedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type SaveEntryResult =
  | { status: "saved"; entry: CloudEntry }
  | { status: "conflict"; remote: CloudEntry | null };

export interface MigrationConflict {
  entryDate: string;
  localContent: string;
  remote: CloudEntry;
}

export interface CloudEntryCache {
  entryDate: string;
  content: string;
  wordCount: number;
  version: number;
  dirty: boolean;
  updatedAt: string;
}

export interface PendingCloudSave {
  entryDate: string;
  content: string;
  wordCount: number;
  expectedVersion: number;
}
