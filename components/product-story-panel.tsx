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
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[var(--accent-dark)]">365 days. 100 words a day. Your year in writing.</p>
            <h2 id="about-title" className="mt-2 max-w-lg font-serif text-4xl leading-[0.98] tracking-[-0.04em] sm:text-5xl">Write at least 100 words every day and preserve the story of your year.</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Close</button>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl bg-white/60 p-5"><p className="font-serif text-3xl text-[var(--accent)]">01</p><h3 className="mt-3 font-bold">Write today</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">No fixed agenda. Write about anything, reach 100 words, or keep going when the day has more to say.</p></article>
          <article className="rounded-2xl bg-[var(--sage)]/25 p-5"><div className="flex items-start justify-between gap-2"><p className="font-serif text-3xl text-[var(--accent)]">30</p><span className="rounded-full border border-[var(--line)] px-2 py-1 text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">In development</span></div><h3 className="mt-3 font-bold">Gather a month</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Daily pages become a monthly digital storybook of moments, turning points, and people worth remembering.</p></article>
          <article className="rounded-2xl bg-[var(--ink)] p-5 text-white"><div className="flex items-start justify-between gap-2"><p className="font-serif text-3xl text-[var(--accent)]">365</p><span className="rounded-full border border-white/20 px-2 py-1 text-[0.58rem] font-bold uppercase tracking-[0.1em] text-white/65">In development</span></div><h3 className="mt-3 font-bold">Hold a year</h3><p className="mt-2 text-sm leading-6 text-white/70">The vision is an annual digital book, with an optional hardcopy you can keep or share.</p></article>
        </div>

        <section aria-labelledby="how-it-works-title" className="mt-10 border-t border-[var(--line)] pt-8">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[var(--accent-dark)]">How it works</p>
          <h3 id="how-it-works-title" className="mt-2 font-serif text-3xl tracking-[-0.03em]">Start with today.</h3>
          <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
            <p>Write about what happened, what mattered, or whatever is on your mind. Your draft saves as you write. Reach 100 words to complete the day - or keep going if you have more to say.</p>
            <p>Come back tomorrow and write another page. Over time, those ordinary pages become a record of your month and, eventually, the story of your year.</p>
          </div>
        </section>

        <section aria-labelledby="about-books-title" className="mt-10 border-t border-[var(--line)] pt-8">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[var(--accent-dark)]">About your books</p>
          <h3 id="about-books-title" className="sr-only">Planned monthly and annual books</h3>
          <div className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            <article className="grid gap-3 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
              <div>
                <h4 className="font-bold">Monthly</h4>
                <p className="mt-2 inline-flex rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Target: end Q2 2027</p>
              </div>
              <div className="space-y-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
                <p>Monthly digital chapters are in development. At the end of each calendar month, a chapter will be created when you have completed at least 10 daily entries of 100 words or more.</p>
                <p>Months with fewer than 10 completed entries remain in your journal but do not generate a monthly chapter.</p>
              </div>
            </article>
            <article className="grid gap-3 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
              <div>
                <h4 className="font-bold">Annual</h4>
                <p className="mt-2 inline-flex rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Target: end Q4 2027</p>
              </div>
              <p className="text-sm leading-7 text-[var(--muted)] sm:text-base">Your annual book will follow your personal writing year: 365 days beginning with your first saved entry, rather than January to December.</p>
            </article>
          </div>
        </section>
      </section>
    </div>
  );
}
