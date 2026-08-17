import Link from "next/link";

const externalTabText = <span className="sr-only"> (opens in a new tab)</span>;

const footerLinkClass = "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-[var(--muted)] outline-none transition hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-[var(--line)] bg-[var(--paper)]/80 px-4 pb-28 pt-7 backdrop-blur-sm sm:px-8 sm:pb-10 sm:pt-8">
      <div className="mx-auto max-w-6xl text-center">
        <nav aria-label="Legal and social links" className="flex flex-wrap items-center justify-center gap-1 sm:gap-3">
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
            Privacy Policy{externalTabText}
          </Link>
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
            Terms of Use{externalTabText}
          </Link>
          <a
            href="https://www.instagram.com/365x100daily/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="365x100daily on Instagram (opens in a new tab)"
            className="grid h-11 w-11 place-items-center rounded-full text-[var(--muted)] outline-none transition hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4.1" />
              <circle cx="17.4" cy="6.7" r="0.9" className="fill-current stroke-none" />
            </svg>
          </a>
        </nav>
        <p className="mt-3 text-xs text-[var(--muted)]">© 2026 365x100. All rights reserved.</p>
      </div>
    </footer>
  );
}
