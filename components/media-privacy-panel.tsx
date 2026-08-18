"use client";

import { useEffect, useRef, useState } from "react";

interface MediaPrivacyPanelProps {
  errorMessage: string;
  onAccept: () => Promise<void>;
  onClose: () => void;
  open: boolean;
  version: string;
}

export function MediaPrivacyPanel({ errorMessage, onAccept, onClose, open, version }: MediaPrivacyPanelProps) {
  const [accepted, setAccepted] = useState(false);
  const [working, setWorking] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) {
        setAccepted(false);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    queueMicrotask(() => dialogRef.current?.focus());
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, working]);

  if (!open) return null;

  async function accept() {
    setWorking(true);
    try {
      await onAccept();
      setAccepted(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-[rgba(19,35,31,0.5)] backdrop-blur-sm sm:place-items-center sm:p-6" onMouseDown={() => { if (!working) { setAccepted(false); onClose(); } }}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="media-privacy-title" className="w-full max-w-lg rounded-t-[2rem] bg-[var(--paper)] p-6 shadow-2xl outline-none sm:rounded-[2rem] sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Private photos</p>
        <h2 id="media-privacy-title" className="mt-2 font-serif text-4xl tracking-[-0.04em]">Before adding your first photo</h2>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Photos are processed in your browser, stripped of location metadata, converted to WebP and stored privately in Supabase. They are never analysed by AI.</p>
        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-white/55 p-4 text-sm font-semibold leading-6">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
          <span>I accept the <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Privacy Policy</a> for private photo storage (version {version}).</span>
        </label>
        {errorMessage && <p className="mt-3 text-sm font-semibold text-red-800" role="alert">{errorMessage}</p>}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => { setAccepted(false); onClose(); }} disabled={working} className="min-h-11 flex-1 rounded-full border border-[var(--ink)] px-5 font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Not now</button>
          <button type="button" onClick={() => void accept()} disabled={!accepted || working} className="min-h-11 flex-1 rounded-full bg-[var(--ink)] px-5 font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-40">{working ? "Saving…" : "Accept and continue"}</button>
        </div>
      </section>
    </div>
  );
}
