import type { SupabaseClient } from "@supabase/supabase-js";

import { PrivatePhoto } from "@/components/private-photo";
import type { Database } from "@/lib/database.types";
import { displayPublicationDate, type PublicationPageModel } from "@/lib/publication-document";
import type { PublicationDocument } from "@/types/publication";

export function PublicationPreview({ client, document, model }: {
  client: SupabaseClient<Database>;
  document: PublicationDocument;
  model: PublicationPageModel;
}) {
  const media = new Map(document.entries.flatMap((entry) => entry.media ? [[entry.media.id, entry.media] as const] : []));
  const cover = model.coverMediaId ? media.get(model.coverMediaId) : null;
  return <article className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white shadow-sm" aria-label="Chapter preview">
    <header className="relative grid min-h-72 place-items-end overflow-hidden bg-[var(--ink)] p-7 text-white sm:min-h-96 sm:p-10">
      {cover && <PrivatePhoto client={client} media={cover} alt="Selected chapter cover" className="absolute inset-0 h-full w-full object-cover opacity-55" />}
      <div className="relative z-10 w-full"><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">365x100 monthly chapter</p><h3 className="mt-3 max-w-2xl font-serif text-5xl leading-none tracking-[-0.05em] sm:text-6xl">{model.title}</h3><p className="mt-4 text-sm text-white/75">{displayPublicationDate(model.periodStart)} – {displayPublicationDate(model.periodEnd)}</p></div>
    </header>
    <div className="space-y-10 p-6 sm:p-10">
      {model.mode === "ai" && model.editorial && <section className="space-y-7 border-b border-[var(--line)] pb-10">
        {model.editorial.review && <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Chapter</p><div className="mt-3 space-y-5 font-serif text-2xl leading-relaxed">{model.editorial.review.split(/\n\s*\n/).map((paragraph, index) => paragraph.trim() && <p key={index}>{paragraph.trim()}</p>)}</div></div>}
        {model.editorial.themes.length > 0 && <div><h4 className="font-bold">Themes</h4><ul className="mt-2 flex flex-wrap gap-2">{model.editorial.themes.map((theme) => <li key={theme} className="rounded-full bg-[var(--sage)]/40 px-3 py-1.5 text-sm">{theme}</li>)}</ul></div>}
        {model.editorial.moments.length > 0 && <div><h4 className="font-bold">Moments</h4><div className="mt-3 grid gap-3 sm:grid-cols-2">{model.editorial.moments.map((moment) => <blockquote key={`${moment.sourceRef}-${moment.text}`} className="rounded-xl bg-[var(--paper)] p-4 text-sm leading-6"><strong className="block text-xs text-[var(--muted)]">{displayPublicationDate(moment.date)}</strong>{moment.text}</blockquote>)}</div></div>}
        {model.editorial.quotations.length > 0 && <div><h4 className="font-bold">In your words</h4>{model.editorial.quotations.map((quote) => <blockquote key={`${quote.sourceRef}-${quote.quote}`} className="mt-3 border-l-2 border-[var(--accent)] pl-4 font-serif text-xl">“{quote.quote}”</blockquote>)}</div>}
      </section>}
      {model.entries.map((entry) => {
        const photo = entry.mediaId ? media.get(entry.mediaId) : null;
        return <section key={entry.date} className="break-inside-avoid border-b border-[var(--line)] pb-10 last:border-0">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--accent-dark)]">{displayPublicationDate(entry.date)}</p>
          {entry.title && <h4 className="mt-2 font-serif text-3xl tracking-[-0.03em]">{entry.title}</h4>}
          {photo && <PrivatePhoto client={client} media={photo} alt={`Photo for ${displayPublicationDate(entry.date)}`} className="mt-5 max-h-[32rem] w-full rounded-xl object-contain bg-[var(--paper)]" />}
          <div className="mt-5 space-y-3">{entry.blocks.map((block, index) => {
            const content = block.spans.map((span, spanIndex) => <span key={spanIndex} style={{ fontWeight: span.bold ? 700 : undefined, fontStyle: span.italic ? "italic" : undefined, textDecoration: [span.underline ? "underline" : "", span.strike ? "line-through" : ""].filter(Boolean).join(" ") || undefined }}>{span.link ? <a href={span.link} target="_blank" rel="noopener noreferrer" className="underline">{span.text}</a> : span.text}</span>);
            if (block.kind === "heading") return <h5 key={index} className="font-serif text-2xl" style={{ textAlign: block.align }}>{content}</h5>;
            if (block.kind === "quote") return <blockquote key={index} className="border-l-2 border-[var(--sage)] pl-4 font-serif text-xl" style={{ textAlign: block.align }}>{content}</blockquote>;
            if (block.kind === "list-item") return <p key={index} className="pl-5 leading-7" style={{ textAlign: block.align }}>{block.ordered ? `${index + 1}. ` : "• "}{content}</p>;
            return <p key={index} className="whitespace-pre-wrap leading-7" style={{ textAlign: block.align }}>{content}</p>;
          })}</div>
        </section>;
      })}
      <footer className="flex flex-wrap justify-between gap-3 border-t border-[var(--line)] pt-5 text-xs font-semibold text-[var(--muted)]"><span>{model.entries.length} entries</span><span>{model.totalWords.toLocaleString()} words preserved</span></footer>
    </div>
  </article>;
}
