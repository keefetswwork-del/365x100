export interface EntryMedia {
  id: string;
  storagePath: string;
  mimeType: "image/webp";
  byteSize: number;
  width: number;
  height: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAccountStatus {
  tier: "free" | "premium";
  storedCount: number;
  limit: number | null;
  canAdd: boolean;
  privacyAccepted: boolean;
  privacyVersion: string;
}

export type MediaUploadStatus =
  | "idle"
  | "preparing"
  | "uploading"
  | "saved"
  | "removing"
  | "error"
  | "conflict";

export type MediaFailureCategory =
  | "decode"
  | "format"
  | "network"
  | "oversize"
  | "processing"
  | "quota"
  | "server"
  | "unauthorized";

export type MediaMutationResult =
  | { status: "saved"; media: EntryMedia }
  | { status: "conflict"; remote: EntryMedia | null }
  | { status: "limit"; storedCount: number; limit: number }
  | { status: "privacy-required" };
