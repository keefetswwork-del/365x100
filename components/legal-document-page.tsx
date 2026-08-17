import Link from "next/link";

import { BrandWordmark } from "@/components/brand-wordmark";
import type { LegalBlock, LegalInline } from "@/lib/legal-markdown";
import type { LegalDocument } from "@/lib/legal-markdown";

function InlineContent({ content }: { content: LegalInline[] }) {
  return content.map((token, index) => {
    const key = `${token.kind}-${index}`;
    if (token.kind === "emphasis") return <strong key={key}>{token.text}</strong>;
    if (token.kind === "link") {
      const className = "font-semibold text-[var(--accent-dark)] underline decoration-[var(--accent)]/45 underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
      return token.href.startsWith("/")
        ? <Link key={key} href={token.href} className={className}>{token.text}</Link>
        : <a key={key} href={token.href} className={className}>{token.text}</a>;
    }
    return token.text;
  });
}

function LegalBlockView({ block, index }: { block: LegalBlock; index: number }) {
  if (block.kind === "heading") {
    return (
      <h2 id={block.id} className="scroll-mt-8 pt-7 font-serif text-3xl leading-tight tracking-[-0.03em] text-[var(--ink)] first:pt-0 sm:text-4xl">
        {block.text}
      </h2>
    );
  }
  if (block.kind === "list") {
    return (
      <ul className="ml-5 list-disc space-y-2 text-[0.98rem] leading-7 text-[var(--muted)] marker:text-[var(--accent)] sm:text-base">
        {block.items.map((item, itemIndex) => <li key={`${index}-${itemIndex}`} className="pl-1"><InlineContent content={item} /></li>)}
      </ul>
    );
  }
  return <p className="text-[0.98rem] leading-7 text-[var(--muted)] sm:text-base sm:leading-8"><InlineContent content={block.content} /></p>;
}

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <main className="relative flex-1 px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <Link href="/" aria-label="365x100 home" className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--paper)]">
            <BrandWordmark className="text-2xl" />
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white/35 px-4 text-sm font-bold outline-none transition hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            ← Back to writing
          </Link>
        </header>

        <article aria-labelledby="legal-title" className="mx-auto max-w-3xl py-10 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-[var(--accent-dark)]">Private beta legal</p>
          <h1 id="legal-title" className="mt-3 font-serif text-[clamp(2.8rem,8vw,5.25rem)] leading-[0.94] tracking-[-0.05em] text-[var(--ink)]">
            {document.title}
          </h1>
          <p className="mt-5 text-sm font-bold text-[var(--muted)]">Effective date: {document.effectiveDate}</p>

          <nav aria-label={`${document.title} sections`} className="my-9 rounded-2xl border border-[var(--line)] bg-white/45 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted)]">On this page</p>
            <ol className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {document.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold leading-5 text-[var(--ink)] outline-none hover:text-[var(--accent-dark)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
                    {section.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-5">
            {document.blocks.map((block, index) => <LegalBlockView key={`${block.kind}-${index}`} block={block} index={index} />)}
          </div>
        </article>
      </div>
    </main>
  );
}
