"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { PublicationPdfButton } from "@/components/publication-pdf-button";
import { PublicationPreview } from "@/components/publication-preview";
import type { Database } from "@/lib/database.types";
import { buildPublicationPageModel } from "@/lib/publication-document";
import { preparePublicationCover, removePublicationCoverUpload, uploadPublicationCover } from "@/lib/publication-cover";
import {
  acceptAiProcessing,
  approvePublication,
  createMonthlyPublication,
  deletePublication,
  fetchPublicationDocument,
  fetchPublicationLibrary,
  generatePublication,
  recordPublicationFeedback,
  recordPublicationEvent,
  savePublicationDraft,
  setPublicationCover,
} from "@/lib/publications";
import type { PublicationDocument, PublicationEditorial, PublicationFeedback, PublicationLibrary, PublicationMonth } from "@/types/publication";

interface BooksViewProps {
  client: SupabaseClient<Database>;
  online: boolean;
}

const EMPTY_EDITORIAL: PublicationEditorial = {
  moments: [],
  quotations: [],
  review: "",
  themes: [],
  title: "",
  version: 1,
};

function monthLabel(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC", year: "numeric" })
    .format(new Date(`${date}T00:00:00Z`));
}

function stateLabel(month: PublicationMonth): string {
  if (!month.ended) return "In progress";
  if (!month.eligible) return "Not yet eligible";
  if (!month.publication) return "Ready to create";
  if (month.publication.state === "stale") return "Needs refreshing";
  if (month.publication.state === "ready") return "Ready";
  if (month.publication.state === "draft") return "Draft";
  if (month.publication.state === "failed") return "Try again";
  return month.publication.state;
}

export function BooksView({ client, online }: BooksViewProps) {
  const [library, setLibrary] = useState<PublicationLibrary | null>(null);
  const [document, setDocument] = useState<PublicationDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [aiMonth, setAiMonth] = useState<PublicationMonth | null>(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftEditorial, setDraftEditorial] = useState<PublicationEditorial>(EMPTY_EDITORIAL);
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const aiDialogRef = useRef<HTMLElement>(null);
  const aiReturnFocusRef = useRef<HTMLElement | null>(null);
  async function refreshLibrary() {
    setLoading(true);
    setError("");
    try {
      setLibrary(await fetchPublicationLibrary(client));
    } catch {
      setError("Books are unavailable right now. Your journal is unaffected.");
    } finally {
      setLoading(false);
    }
  }
  const loadLibraryFromEffect = useEffectEvent(refreshLibrary);

  useEffect(() => {
    queueMicrotask(() => {
      if (online) {
        void loadLibraryFromEffect();
        void recordPublicationEvent(client, "books_viewed");
      }
      else setLoading(false);
    });
  }, [client, online]);

  useEffect(() => {
    if (!document || !draftDirty) return;
    const timer = window.setTimeout(async () => {
      setDraftStatus("Saving chapter draft…");
      try {
        await savePublicationDraft(client, document.publication.id, draftTitle, draftEditorial);
        setDraftDirty(false);
        setDraftStatus("Chapter draft saved");
      } catch {
        setDraftStatus("Draft save failed — your journal is unchanged");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [client, document, draftDirty, draftEditorial, draftTitle]);

  useEffect(() => {
    if (!aiMonth) return;
    const dialog = aiDialogRef.current;
    dialog?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setAiMonth(null);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && globalThis.document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && globalThis.document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      aiReturnFocusRef.current?.focus();
    };
  }, [aiMonth]);

  function openAiDisclosure(month: PublicationMonth) {
    aiReturnFocusRef.current = globalThis.document.activeElement instanceof HTMLElement ? globalThis.document.activeElement : null;
    setAiMonth(month);
    setAiConsent(false);
  }

  async function openPublication(publicationId: string) {
    setWorking(true);
    setError("");
    try {
      const next = await fetchPublicationDocument(client, publicationId);
      setDocument(next);
      setDraftTitle(next.publication.title);
      setDraftEditorial(next.editorial ?? { ...EMPTY_EDITORIAL, title: next.publication.title });
      setDraftDirty(false);
      setDraftStatus("");
    } catch {
      setError("This chapter could not be opened.");
    } finally {
      setWorking(false);
    }
  }

  async function createOriginal(month: PublicationMonth) {
    setWorking(true);
    setError("");
    try {
      await openPublication(await createMonthlyPublication(client, month.monthStart, "original"));
      await refreshLibrary();
    } catch {
      setError("The original-entry chapter could not be created.");
    } finally {
      setWorking(false);
    }
  }

  async function createAiChapter() {
    if (!aiMonth || !aiConsent) return;
    setWorking(true);
    setError("");
    try {
      const publicationId = await createMonthlyPublication(client, aiMonth.monthStart, "ai");
      await acceptAiProcessing(client, publicationId);
      await generatePublication(client, publicationId, "full");
      await openPublication(publicationId);
      await refreshLibrary();
      setAiMonth(null);
      setAiConsent(false);
    } catch {
      setError("The AI-edited chapter could not be created. No successful-generation credit was consumed for a failed request.");
    } finally {
      setWorking(false);
    }
  }

  async function regenerate(section: "moments" | "quotations" | "review" | "themes" | "title" | "full") {
    if (!document) return;
    setWorking(true);
    setError("");
    try {
      await generatePublication(client, document.publication.id, section);
      await openPublication(document.publication.id);
      await refreshLibrary();
    } catch {
      setError("That section could not be regenerated. Your approved chapter remains unchanged.");
    } finally {
      setWorking(false);
    }
  }

  async function approve() {
    if (!document) return;
    setWorking(true);
    try {
      if (draftDirty) await savePublicationDraft(client, document.publication.id, draftTitle, draftEditorial);
      await approvePublication(client, document.publication.id);
      await openPublication(document.publication.id);
      await refreshLibrary();
    } catch {
      setError("The chapter could not be approved.");
    } finally {
      setWorking(false);
    }
  }

  async function changeCover(mediaId: string | null) {
    if (!document) return;
    setWorking(true);
    setError("");
    try {
      const hadPendingDraft = draftDirty;
      if (hadPendingDraft) {
        await savePublicationDraft(client, document.publication.id, draftTitle, draftEditorial);
        setDraftDirty(false);
      }
      await setPublicationCover(client, document.publication.id, mediaId);
      await openPublication(document.publication.id);
      if (hadPendingDraft) setDraftStatus("Chapter draft saved");
    } catch {
      setError("The cover could not be updated. Your chapter draft remains available.");
    } finally {
      setWorking(false);
    }
  }

  async function uploadCover(file: File) {
    if (!document) return;
    setWorking(true);
    setError("");
    try {
      const hadPendingDraft = draftDirty;
      if (hadPendingDraft) {
        await savePublicationDraft(client, document.publication.id, draftTitle, draftEditorial);
        setDraftDirty(false);
      }
      await uploadPublicationCover(client, document.publication.id, await preparePublicationCover(file));
      await openPublication(document.publication.id);
      if (hadPendingDraft) setDraftStatus("Chapter draft saved");
    } catch {
      setError("The cover image could not be uploaded. Your chapter draft remains available.");
    } finally {
      setWorking(false);
    }
  }

  async function removeCover() {
    if (!document) return;
    if (document.publication.coverSource !== "upload") {
      await changeCover(null);
      return;
    }
    setWorking(true);
    setError("");
    try {
      await removePublicationCoverUpload(client, document.publication.id);
      await openPublication(document.publication.id);
    } catch {
      setError("The cover could not be removed. Your chapter draft remains available.");
    } finally {
      setWorking(false);
    }
  }

  async function removeGeneratedOutput() {
    if (!document || !window.confirm("Delete this generated chapter? Your source entries and photos will not be deleted.")) return;
    setWorking(true);
    try {
      await deletePublication(client, document.publication.id);
      setDocument(null);
      await refreshLibrary();
    } catch {
      setError("The generated chapter could not be deleted.");
    } finally {
      setWorking(false);
    }
  }

  const aiDisclosure = aiMonth && <div className="fixed inset-0 z-[70] grid place-items-end bg-black/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-6" onMouseDown={() => setAiMonth(null)}><section ref={aiDialogRef} tabIndex={-1} data-nested-modal role="dialog" aria-modal="true" aria-labelledby="ai-disclosure-title" className="w-full max-w-xl rounded-t-[2rem] bg-[var(--paper)] p-6 shadow-2xl outline-none sm:rounded-[2rem] sm:p-8" onMouseDown={(event) => event.stopPropagation()}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">AI processing disclosure</p><h3 id="ai-disclosure-title" className="mt-2 font-serif text-3xl">Create {monthLabel(aiMonth.monthStart)} with OpenAI?</h3><p className="mt-4 text-sm leading-6 text-[var(--muted)]">365x100 will send only this month’s entry dates, titles and authoritative plain text to OpenAI for editorial analysis. Photographs, rich-format JSON, filenames, URLs, account IDs and email addresses are excluded. OpenAI may retain API data for abuse monitoring for up to 30 days. Your original journal is never rewritten.</p><label className="mt-5 flex gap-3 rounded-xl border border-[var(--line)] bg-white/55 p-4 text-sm font-semibold"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--accent)]" />I understand and consent to AI processing for {monthLabel(aiMonth.monthStart)}.</label><div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={!aiConsent || working} onClick={() => void createAiChapter()} className="min-h-11 rounded-full bg-[var(--ink)] px-5 text-sm font-bold text-white disabled:opacity-40">{working ? "Creating privately…" : "Create AI-edited chapter"}</button><button type="button" onClick={() => setAiMonth(null)} className="min-h-11 rounded-full border border-[var(--line)] px-5 text-sm font-bold">Cancel</button></div></section></div>;

  if (!online) return <section role="tabpanel" className="mt-7 rounded-2xl bg-white/55 p-6"><h3 className="font-serif text-3xl">Books need a connection.</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Reconnect to create or preview complete chapters. Cached writing remains available offline.</p></section>;
  if (loading) return <p role="status" className="mt-7 text-sm font-semibold text-[var(--muted)]">Loading your books…</p>;
  if (!library) return <p role="alert" className="mt-7 rounded-2xl bg-red-50 p-5 text-sm text-red-900">{error}</p>;

  if (document) {
    const model = buildPublicationPageModel({ ...document, editorial: draftEditorial, publication: { ...document.publication, title: draftTitle } });
    const coverOptions = document.entries.flatMap((entry) => entry.media ? [{ date: entry.entryDate, id: entry.media.id }] : []);
    const aiDownloadBlocked = document.publication.mode === "ai" && (document.publication.state !== "ready" || document.publication.staleReason !== null);
    return <section role="tabpanel" className="mt-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => setDocument(null)} className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">← All chapters</button><span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{document.publication.mode === "ai" ? "AI-edited" : "Original entries"} · {document.publication.state}</span></div>
      {document.publication.state === "stale" && <div className="mb-5 rounded-2xl border border-amber-800/20 bg-amber-50 p-5" role="alert"><p className="font-bold">Your journal changed after this AI draft was created.</p><p className="mt-1 text-sm leading-6">The last approved editorial layer remains available, but AI PDF download is paused. Regenerate the chapter or switch to original-only mode.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={working} onClick={() => void regenerate("full")} className="min-h-11 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-white">Regenerate chapter</button><button type="button" disabled={working} onClick={() => void createOriginal({ eligible: true, ended: true, entryCount: document.entries.length, monthEnd: document.publication.periodEnd, monthStart: document.publication.periodStart, publication: document.publication, words: model.totalWords, writingDays: model.writingDays })} className="min-h-11 rounded-full border border-[var(--ink)] px-4 text-sm font-bold">Use original entries</button></div></div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
        <PublicationPreview client={client} document={document} model={model} />
        <aside className="space-y-3 rounded-[1.5rem] border border-[var(--line)] bg-white/55 p-4 lg:sticky lg:top-4">
          <details className="border-b border-[var(--line)] pb-3"><summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Details</summary><div className="mt-4 space-y-3"><label className="block text-xs font-bold">Title<input value={draftTitle} maxLength={120} onChange={(event) => { setDraftTitle(event.target.value); setDraftDirty(true); }} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--line)] bg-white px-2 font-serif text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" /></label><label className="block text-xs font-bold">Cover<select value={document.publication.coverSource === "entry" ? document.publication.coverMediaId ?? "" : document.publication.coverSource === "upload" ? "__upload" : ""} disabled={working} onChange={(event) => { if (event.target.value !== "__upload") void changeCover(event.target.value || null); }} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--line)] bg-white px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"><option value="">Default artwork</option>{document.publication.coverSource === "upload" && <option value="__upload">Uploaded cover</option>}{coverOptions.map((option) => <option key={option.id} value={option.id}>{option.date}</option>)}</select></label><label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full border border-[var(--ink)] px-3 text-sm font-bold">Add image<input type="file" accept="image/*" disabled={working} className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadCover(file); }} /></label>{document.publication.coverSource !== "default" && <button type="button" disabled={working} onClick={() => void removeCover()} className="text-xs font-bold text-[var(--muted)] underline underline-offset-4">Remove cover</button>}{document.publication.mode === "ai" && document.publication.state === "ready" && <fieldset><legend className="text-xs font-bold">Accuracy</legend><div className="mt-2 flex flex-wrap gap-1">{(["accurate", "needs-review", "invented-fact"] as PublicationFeedback[]).map((verdict) => <button type="button" key={verdict} onClick={() => void recordPublicationFeedback(client, document.publication.id, verdict)} className="rounded-full border border-[var(--line)] px-2 py-1 text-[0.65rem] font-bold">{verdict.replaceAll("-", " ")}</button>)}</div></fieldset>}</div></details>
          {document.publication.mode === "ai" && <button type="button" disabled={working} onClick={() => void regenerate("review")} className="min-h-10 w-full rounded-full border border-[var(--ink)] px-3 text-sm font-bold">Regenerate</button>}
          {document.publication.mode === "original" && (library.aiEntitled
            ? <button type="button" disabled={working} onClick={() => openAiDisclosure({ eligible: true, ended: true, entryCount: document.entries.length, monthEnd: document.publication.periodEnd, monthStart: document.publication.periodStart, publication: document.publication, words: model.totalWords, writingDays: model.writingDays })} className="min-h-10 w-full rounded-full border border-[var(--ink)] px-3 text-sm font-bold">Create AI</button>
            : <p className="text-xs leading-5 text-[var(--muted)]">AI is unavailable for this account.</p>)}
          <button type="button" disabled={working || document.publication.state === "stale"} onClick={() => void approve()} className="min-h-10 w-full rounded-full bg-[var(--accent)] px-3 text-sm font-bold text-white disabled:opacity-40">Approve</button>
          <PublicationPdfButton client={client} document={document} disabled={working || aiDownloadBlocked} model={model} />
          <p className="text-xs font-semibold text-[var(--muted)]" role="status">{draftStatus}</p>
          <button type="button" disabled={working} onClick={() => void removeGeneratedOutput()} className="min-h-10 w-full rounded-full border border-red-900/30 px-3 text-sm font-bold text-red-900">Delete</button>
        </aside>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-900" role="alert">{error}</p>}
      {aiDisclosure}
    </section>;
  }

  return <section role="tabpanel" className="mt-7">
    <div className="rounded-[1.5rem] bg-[var(--ink)] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Monthly chapters</p><h3 className="mt-2 font-serif text-4xl tracking-[-0.04em]">Turn a month of memories into a book.</h3><p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">Ended months with at least 10 writing days can become a chronological original-entry chapter. AI editing is optional and requires your consent for each chapter.</p></div>
    {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-900" role="alert">{error}</p>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{library.items.map((month) => <article key={month.monthStart} className="rounded-2xl border border-[var(--line)] bg-white/55 p-5"><div className="flex items-start justify-between gap-3"><div><h4 className="font-serif text-2xl">{monthLabel(month.monthStart)}</h4><p className="mt-1 text-sm text-[var(--muted)]">{month.writingDays} writing days · {month.words.toLocaleString()} words</p></div><span className="rounded-full bg-[var(--sage)]/35 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider">{stateLabel(month)}</span></div>{month.publication ? <button type="button" disabled={working} onClick={() => void openPublication(month.publication!.id)} className="mt-5 min-h-11 rounded-full bg-[var(--ink)] px-5 text-sm font-bold text-white">Open chapter</button> : month.eligible ? <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={working} onClick={() => void createOriginal(month)} className="min-h-11 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-white">Create original chapter</button>{library.aiEntitled ? <button type="button" disabled={working} onClick={() => openAiDisclosure(month)} className="min-h-11 rounded-full border border-[var(--ink)] px-4 text-sm font-bold">Create AI-edited chapter</button> : <p className="text-sm leading-6 text-[var(--muted)]">AI chapters are not available for this account.</p>}</div> : <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{month.ended ? "This month remains in your journal but did not reach 10 writing days." : `${Math.max(0, 10 - month.writingDays)} more writing days will qualify this month.`}</p>}</article>)}</div>
    {library.items.length === 0 && <div className="mt-5 rounded-2xl border border-dashed border-[var(--line)] p-7 text-center"><h4 className="font-serif text-3xl">Your first chapter begins with your first memory.</h4><p className="mt-2 text-sm text-[var(--muted)]">Monthly chapters become available after an eligible calendar month ends.</p></div>}
    {aiDisclosure}
  </section>;
}
