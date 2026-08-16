"use client";

import { useEffect, useEffectEvent, useRef } from "react";

interface ProductStoryPanelProps {
  onClose: () => void;
  open: boolean;
}

export function ProductStoryPanel({ onClose, open }: ProductStoryPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closePanel = useEffectEvent(onClose);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-[rgba(19,35,31,0.48)] backdrop-blur-sm sm:place-items-center sm:p-6" onMouseDown={onClose}>
      <section aria-labelledby="about-title" aria-modal="true" role="dialog" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-[var(--paper)] p-6 shadow-2xl sm:rounded-[2rem] sm:p-9" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[var(--accent-dark)]">A life, one page at a time</p>
            <h2 id="about-title" className="mt-2 max-w-lg font-serif text-4xl leading-[0.98] tracking-[-0.04em] sm:text-5xl">One hundred words makes today rememberable.</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Close</button>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl bg-white/60 p-5"><p className="font-serif text-3xl text-[var(--accent)]">01</p><h3 className="mt-3 font-bold">Write today</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Begin with one honest detail. Reach 100 words, or keep going when the day has more to say.</p></article>
          <article className="rounded-2xl bg-[var(--sage)]/25 p-5"><p className="font-serif text-3xl text-[var(--accent)]">30</p><h3 className="mt-3 font-bold">Gather a month</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Daily pages become a chapter of ordinary moments, turning points and people worth remembering.</p></article>
          <article className="rounded-2xl bg-[var(--ink)] p-5 text-white"><p className="font-serif text-3xl text-[var(--accent)]">365</p><h3 className="mt-3 font-bold">Hold a year</h3><p className="mt-2 text-sm leading-6 text-white/70">The long-term vision is an annual digital book, with an optional hardcopy you can keep or share.</p></article>
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--line)] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)]">Coming later</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Monthly and annual digital books, downloads and optional printing are part of the product roadmap. They are not available for purchase or generation yet. Your writing and progress come first.</p>
        </div>
      </section>
    </div>
  );
}
