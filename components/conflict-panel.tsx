"use client";

import type { MigrationConflict } from "@/types/cloud";

interface ConflictPanelProps {
  conflict: MigrationConflict | null;
  isWorking: boolean;
  onKeepCloud: () => void;
  onKeepLocal: () => void;
}

export function ConflictPanel({ conflict, isWorking, onKeepCloud, onKeepLocal }: ConflictPanelProps) {
  if (!conflict) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[rgba(19,35,31,0.56)] p-5 backdrop-blur-sm">
      <section
        aria-labelledby="conflict-title"
        aria-modal="true"
        className="my-auto w-full max-w-4xl rounded-[2rem] bg-[var(--paper)] p-6 shadow-2xl sm:p-8"
        role="dialog"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Two versions found · {conflict.entryDate}</p>
        <h2 id="conflict-title" className="mt-2 font-serif text-4xl tracking-[-0.04em]">Choose the version to keep.</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Nothing will be replaced until you decide. Review both versions below.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-[var(--line)] bg-white/65 p-4">
            <h3 className="font-bold">This browser</h3>
            <textarea readOnly value={conflict.localContent} aria-label="Browser version" className="mt-3 h-56 w-full resize-none rounded-xl bg-white/70 p-3 font-serif text-lg outline-none" />
            <button type="button" disabled={isWorking} onClick={onKeepLocal} className="mt-3 w-full rounded-full bg-[var(--accent)] px-4 py-3 font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dark)] disabled:opacity-60">Keep browser version</button>
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-white/65 p-4">
            <h3 className="font-bold">Cloud version</h3>
            <textarea readOnly value={conflict.remote.content} aria-label="Cloud version" className="mt-3 h-56 w-full resize-none rounded-xl bg-white/70 p-3 font-serif text-lg outline-none" />
            <button type="button" disabled={isWorking} onClick={onKeepCloud} className="mt-3 w-full rounded-full bg-[var(--ink)] px-4 py-3 font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60">Keep cloud version</button>
          </article>
        </div>
      </section>
    </div>
  );
}
