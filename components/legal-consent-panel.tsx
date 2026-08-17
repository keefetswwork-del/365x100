"use client";

import Link from "next/link";
import { useState } from "react";

interface LegalConsentPanelProps {
  errorMessage: string;
  open: boolean;
  onAccept: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function LegalConsentPanel({ errorMessage, open, onAccept, onSignOut }: LegalConsentPanelProps) {
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [working, setWorking] = useState(false);

  if (!open) return null;

  async function accept() {
    setWorking(true);
    try {
      await onAccept();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-[rgba(19,35,31,0.5)] backdrop-blur-sm sm:place-items-center sm:p-6">
      <section aria-labelledby="legal-consent-title" aria-modal="true" role="dialog" className="w-full max-w-lg rounded-t-[2rem] bg-[var(--paper)] p-6 shadow-2xl sm:rounded-[2rem] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Private Beta</p>
        <h2 id="legal-consent-title" className="mt-2 font-serif text-4xl tracking-[-0.04em]">Before cloud saving continues.</h2>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Your writing remains saved on this device. Please review and accept the current documents once to continue using your account.</p>

        <label className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-white/55 p-4 font-bold">
          <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
          <span>I have read and accept the <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--accent)] decoration-2 underline-offset-4">Privacy Policy<span className="sr-only"> (opens in a new tab)</span></Link>.</span>
        </label>
        <label className="mt-3 flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-white/55 p-4 font-bold">
          <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
          <span>I have read and accept the <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--accent)] decoration-2 underline-offset-4">Terms of Use<span className="sr-only"> (opens in a new tab)</span></Link>.</span>
        </label>

        <button type="button" disabled={working || !privacyAccepted || !termsAccepted} onClick={() => void accept()} className="mt-6 w-full rounded-full bg-[var(--ink)] px-5 py-3.5 font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 disabled:opacity-40">{working ? "Recording acceptance…" : "Accept and continue"}</button>
        <button type="button" disabled={working} onClick={() => void onSignOut()} className="mt-2 w-full rounded-full px-5 py-3 text-sm font-bold text-[var(--muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50">Sign out instead</button>
        {errorMessage && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{errorMessage}</p>}
      </section>
    </div>
  );
}
