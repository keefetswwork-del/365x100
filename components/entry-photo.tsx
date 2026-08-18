"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

import { MediaPrivacyPanel } from "@/components/media-privacy-panel";
import { PrivatePhoto } from "@/components/private-photo";
import type { Database } from "@/lib/database.types";
import {
  acceptMediaPrivacy,
  downloadMediaBlob,
  fetchMediaAccountStatus,
  MediaConflictError,
  recordMediaEvent,
  removeEntryMedia,
  uploadEntryMedia,
} from "@/lib/entry-media";
import {
  durationBucket,
  mediaSizeBucket,
  PhotoProcessingError,
  processPhoto,
} from "@/lib/photo-processing";
import { downloadBlob } from "@/lib/entry-export";
import type { EntryMedia, MediaAccountStatus, MediaFailureCategory, MediaUploadStatus } from "@/types/media";

interface EntryPhotoProps {
  client: SupabaseClient<Database>;
  disabled: boolean;
  ensureEntry: () => Promise<string>;
  entryDate: string;
  media: EntryMedia | null;
  onChange: (media: EntryMedia | null) => void;
  online: boolean;
}

export function EntryPhoto({ client, disabled, ensureEntry, entryDate, media, onChange, online }: EntryPhotoProps) {
  const [account, setAccount] = useState<MediaAccountStatus | null>(null);
  const [status, setStatus] = useState<MediaUploadStatus>("idle");
  const [message, setMessage] = useState("");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacyError, setPrivacyError] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fullView, setFullView] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void fetchMediaAccountStatus(client).then(setAccount, () => setAccount(null));
  }, [client, media?.id]);

  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  useEffect(() => {
    if (!fullView) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullView(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    queueMicrotask(() => previewCloseRef.current?.focus());
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullView]);

  async function prepareAndUpload(file: File) {
    const operationId = crypto.randomUUID();
    const started = performance.now();
    setMessage("");
    setStatus("preparing");
    void recordMediaEvent(client, { entryDate, eventName: "photo_selected", operationId });
    try {
      const processed = await processPhoto(file);
      const preview = URL.createObjectURL(processed.blob);
      setLocalPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return preview;
      });
      void recordMediaEvent(client, {
        durationBucket: durationBucket(performance.now() - started),
        entryDate,
        eventName: "photo_processing_completed",
        operationId,
        sizeBucket: mediaSizeBucket(processed.blob.size),
      });

      setStatus("uploading");
      const entryId = await ensureEntry();
      const result = await uploadEntryMedia(client, { blob: processed.blob, entryId, expected: media, operationId });
      if (result.status === "saved") {
        onChange(result.media);
        setStatus("saved");
        setMessage(media ? "Photo replaced" : "Photo added");
        setLocalPreview(null);
        setAccount(await fetchMediaAccountStatus(client));
        return;
      }
      if (result.status === "privacy-required") {
        setPendingFile(file);
        setPrivacyOpen(true);
        setStatus("idle");
        return;
      }
      if (result.status === "limit") {
        setStatus("error");
        setMessage("You’ve used your 10 complimentary photo uploads.");
        void recordMediaEvent(client, { entryDate, eventName: "free_photo_limit_reached", failureCategory: "quota", operationId });
        return;
      }
      setStatus("conflict");
      setMessage("This photo changed on another device. Reload the entry before trying again.");
    } catch (error) {
      const category: MediaFailureCategory = error instanceof PhotoProcessingError ? error.category : online ? "server" : "network";
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Photo upload failed.");
      setLocalPreview(null);
      void recordMediaEvent(client, {
        durationBucket: durationBucket(performance.now() - started),
        entryDate,
        eventName: error instanceof PhotoProcessingError ? "photo_processing_failed" : "photo_upload_failed",
        failureCategory: category,
        operationId,
      });
    }
  }

  async function choosePhoto(file: File | null) {
    if (!file) return;
    let currentAccount = account;
    if (!currentAccount) {
      setMessage("Photo access is still loading. Please try again.");
      return;
    }
    if (!currentAccount.privacyAccepted) {
      try {
        currentAccount = await fetchMediaAccountStatus(client);
        setAccount(currentAccount);
      } catch {
        setMessage("Photo access could not be refreshed. Your writing is unaffected.");
        return;
      }
    }
    if (!currentAccount.privacyAccepted) {
      setPendingFile(file);
      setPrivacyOpen(true);
      return;
    }
    await prepareAndUpload(file);
  }

  async function acceptPrivacy() {
    setPrivacyError("");
    try {
      const next = await acceptMediaPrivacy(client);
      setAccount(next);
      setPrivacyOpen(false);
      const file = pendingFile;
      setPendingFile(null);
      if (file) await prepareAndUpload(file);
    } catch {
      setPrivacyError("Privacy acceptance could not be saved. Your writing is unaffected.");
    }
  }

  async function removePhoto() {
    if (!media) return;
    setStatus("removing");
    setMessage("");
    try {
      await removeEntryMedia(client, media, crypto.randomUUID());
      onChange(null);
      setConfirmRemove(false);
      setStatus("idle");
      setMessage("Photo removed. Your writing is unchanged.");
      setAccount(await fetchMediaAccountStatus(client));
    } catch (error) {
      setStatus(error instanceof MediaConflictError ? "conflict" : "error");
      setMessage(error instanceof MediaConflictError
        ? "This photo changed on another device. Reload the entry before removing it."
        : "Photo could not be removed. Your writing is unchanged.");
    }
  }

  async function downloadPhoto() {
    if (!media) return;
    try {
      downloadBlob(`365x100-${entryDate}.webp`, await downloadMediaBlob(client, media));
    } catch {
      setMessage("Photo could not be downloaded.");
    }
  }

  const atLimit = account?.tier === "free" && !account.canAdd && !media;
  const busy = status === "preparing" || status === "uploading" || status === "removing";

  return (
    <section aria-label="Entry photo" className="mb-5 border-b border-[var(--line)] pb-5">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy || !online || atLimit} onChange={(event) => { void choosePhoto(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} className="sr-only" aria-label={media ? "Choose a replacement photo" : "Choose a photo"} />
      {(localPreview || media) && (
        <button type="button" onClick={() => setFullView(true)} className="block w-full overflow-hidden rounded-2xl bg-[var(--sage)]/20 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" aria-label="Open photo in a larger preview">
          {localPreview
            // The local object URL exists only in this browser and cannot be optimized at build time.
            ? <img src={localPreview} alt="Local photo preview" className="max-h-[28rem] w-full object-contain" /> // eslint-disable-line @next/next/no-img-element
            : media && <PrivatePhoto client={client} media={media} alt={`Photo for ${entryDate}`} className="max-h-[28rem] min-h-48 w-full object-contain" />}
        </button>
      )}
      <div className={`${media || localPreview ? "mt-3" : ""} flex flex-wrap items-center gap-2`}>
        <button type="button" disabled={disabled || busy || !online || atLimit} onClick={() => inputRef.current?.click()} className="min-h-11 rounded-full border border-[var(--ink)] px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-40">{media ? "Replace photo" : "Add a photo"}</button>
        {media && <button type="button" disabled={busy} onClick={() => void downloadPhoto()} className="min-h-11 rounded-full px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Download</button>}
        {media && !confirmRemove && <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} className="min-h-11 rounded-full px-4 text-sm font-bold text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-700">Remove</button>}
        {confirmRemove && <><button type="button" disabled={busy} onClick={() => void removePhoto()} className="min-h-11 rounded-full bg-red-800 px-4 text-sm font-bold text-white">Confirm remove</button><button type="button" disabled={busy} onClick={() => setConfirmRemove(false)} className="min-h-11 rounded-full px-4 text-sm font-bold">Cancel</button></>}
        <span className="text-xs font-semibold text-[var(--muted)]" role="status">{status === "preparing" ? "Preparing photo…" : status === "uploading" ? "Uploading photo…" : status === "removing" ? "Removing photo…" : message}</span>
      </div>
      {!media && !localPreview && !atLimit && <p className="mt-2 text-xs text-[var(--muted)]">JPEG, PNG or WebP · Maximum 10 MB · One private photo</p>}
      {!online && <p className="mt-2 text-xs font-semibold text-[var(--muted)]">Reconnect to add or replace a photo. Your writing still saves on this device.</p>}
      {atLimit && <p className="mt-2 text-xs leading-5 text-[var(--muted)]">You’ve used your 10 complimentary photo uploads. Existing photos remain available. <a href="mailto:hello@365x100.com?subject=365x100%20photo%20beta%20access" className="font-bold underline underline-offset-4">Request photo beta access</a>.</p>}

      {fullView && (media || localPreview) && <div className="fixed inset-0 z-[65] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Entry photo preview" onMouseDown={() => setFullView(false)}><button ref={previewCloseRef} type="button" onClick={() => setFullView(false)} className="absolute right-5 top-5 min-h-11 rounded-full bg-[var(--paper)] px-5 font-bold text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Close</button><div onMouseDown={(event) => event.stopPropagation()}>{localPreview ? <img src={localPreview} alt="Local photo preview" className="max-h-[88vh] max-w-[94vw] object-contain" /> : media && <PrivatePhoto client={client} media={media} alt={`Photo for ${entryDate}`} className="max-h-[88vh] max-w-[94vw] object-contain" />}</div></div>} {/* eslint-disable-line @next/next/no-img-element */}
      <MediaPrivacyPanel open={privacyOpen} version={account?.privacyVersion ?? ""} errorMessage={privacyError} onClose={() => { setPrivacyOpen(false); setPendingFile(null); }} onAccept={acceptPrivacy} />
    </section>
  );
}
