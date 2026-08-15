"use client";

import type { ChangeEvent } from "react";
import { startTransition, useEffect, useRef, useState } from "react";

import { loadEntry, saveEntry } from "@/lib/entry-storage";
import { formatLocalDate, getLocalDateString } from "@/lib/local-date";
import { countWords } from "@/lib/word-count";

const WORD_TARGET = 100;
const SAVE_DELAY_MS = 300;

type SaveStatus = "restoring" | "saving" | "saved";

export function JournalEditor() {
  const [entry, setEntry] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [dateLabel, setDateLabel] = useState("Today");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("restoring");
  const [isReady, setIsReady] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [showAccountMessage, setShowAccountMessage] = useState(false);

  const entryRef = useRef(entry);
  const localDateRef = useRef(localDate);
  const previousWordCountRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEditedRef = useRef(false);

  const wordCount = countWords(entry);
  const progress = Math.min(wordCount, WORD_TARGET);

  useEffect(() => {
    const now = new Date();
    const today = getLocalDateString(now);
    const restoredEntry = loadEntry(today);
    const restoredWordCount = countWords(restoredEntry);

    entryRef.current = restoredEntry;
    localDateRef.current = today;
    previousWordCountRef.current = restoredWordCount;
    startTransition(() => {
      setEntry(restoredEntry);
      setLocalDate(today);
      setDateLabel(formatLocalDate(now));
      setHasCompleted(restoredWordCount >= WORD_TARGET);
      setSaveStatus("saved");
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    entryRef.current = entry;

    if (!isReady || !localDate || !hasEditedRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      saveEntry(localDate, entryRef.current);
      setSaveStatus("saved");
      saveTimerRef.current = null;
    }, SAVE_DELAY_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [entry, isReady, localDate]);

  useEffect(() => {
    function saveWhenHidden() {
      if (document.visibilityState !== "hidden" || !localDateRef.current) {
        return;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      saveEntry(localDateRef.current, entryRef.current);
      setSaveStatus("saved");
    }

    document.addEventListener("visibilitychange", saveWhenHidden);

    return () => {
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, []);

  function handleEntryChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextEntry = event.target.value;
    const nextWordCount = countWords(nextEntry);

    if (
      previousWordCountRef.current < WORD_TARGET &&
      nextWordCount >= WORD_TARGET
    ) {
      setHasCompleted(true);
      setIsCelebrating(true);
    }

    previousWordCountRef.current = nextWordCount;
    entryRef.current = nextEntry;
    hasEditedRef.current = true;
    setEntry(nextEntry);
    setShowAccountMessage(false);
  }

  const statusLabel =
    saveStatus === "restoring"
      ? "Restoring…"
      : saveStatus === "saving"
        ? "Saving…"
        : "Saved";

  return (
    <main className="journal-shell relative min-h-screen overflow-hidden px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col sm:min-h-[calc(100vh-4rem)]">
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <a
            href="#editor"
            className="rounded-sm font-serif text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--paper)]"
          >
            365 <span className="text-[var(--accent)]">×</span> 100
          </a>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)] sm:text-sm">
            <span
              className={`h-2 w-2 rounded-full ${saveStatus === "saving" ? "bg-[var(--accent)]" : "bg-[var(--sage)]"}`}
              aria-hidden="true"
            />
            <span aria-live="polite">{statusLabel}</span>
          </p>
        </header>

        <div className="grid flex-1 gap-7 py-7 md:gap-10 md:py-10 lg:grid-cols-[0.38fr_0.62fr] lg:gap-16 lg:py-14">
          <section className="flex flex-col justify-between gap-6 lg:py-3">
            <div>
              <time
                dateTime={localDate || undefined}
                className="text-sm font-bold uppercase tracking-[0.17em] text-[var(--accent-dark)]"
              >
                {dateLabel}
              </time>
              <h1 className="mt-4 max-w-xl font-serif text-[clamp(2.7rem,8vw,5.5rem)] leading-[0.91] font-medium tracking-[-0.055em] text-[var(--ink)]">
                What happened today?
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
                One honest detail is enough to begin. This draft stays private in
                this browser.
              </p>
            </div>

            <p className="hidden max-w-xs border-l-2 border-[var(--sage)] pl-4 text-sm leading-6 text-[var(--muted)] lg:block">
              Write past one hundred if the day has more to say.
            </p>
          </section>

          <section
            id="editor"
            className="flex min-h-[31rem] flex-col rounded-[1.6rem] border border-white/70 bg-white/65 p-4 shadow-[0_24px_80px_rgba(40,55,48,0.11)] backdrop-blur-sm sm:min-h-[37rem] sm:rounded-[2rem] sm:p-6 lg:min-h-0 lg:p-8"
          >
            <label htmlFor="daily-entry" className="sr-only">
              Your entry for today
            </label>
            <textarea
              id="daily-entry"
              value={entry}
              onChange={handleEntryChange}
              disabled={!isReady}
              placeholder={
                isReady
                  ? "Start with a moment you want to remember…"
                  : "Restoring today’s draft…"
              }
              spellCheck="true"
              className="entry-textarea min-h-[23rem] w-full flex-1 resize-none rounded-xl border-0 bg-transparent px-2 py-1 font-serif text-[1.45rem] leading-8 text-[var(--ink)] outline-none placeholder:text-[var(--muted)]/45 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-white/70 disabled:cursor-wait sm:min-h-[27rem] sm:px-3 sm:text-[1.65rem]"
              aria-describedby="entry-progress"
            />

            <div
              id="entry-progress"
              className="mt-5 border-t border-[var(--line)] pt-5"
            >
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <p
                  className="text-sm font-bold tabular-nums text-[var(--ink)]"
                  aria-live="polite"
                >
                  {wordCount} / {WORD_TARGET} words
                </p>
                <p className="text-xs font-semibold text-[var(--muted)]">
                  {wordCount >= WORD_TARGET
                    ? "Goal reached — keep writing"
                    : `${WORD_TARGET - wordCount} to go`}
                </p>
              </div>
              <progress
                className="writing-progress block"
                max={WORD_TARGET}
                value={progress}
                aria-label={`${progress} of ${WORD_TARGET} word goal`}
              />
            </div>
          </section>
        </div>

        {hasCompleted && (
          <section
            className={`${isCelebrating ? "completion-card" : ""} relative mb-4 overflow-hidden rounded-[1.6rem] bg-[var(--ink)] px-5 py-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-8 sm:py-7`}
            aria-labelledby="completion-title"
          >
            <div className="flex items-start gap-4">
              <span
                className={`${isCelebrating ? "completion-mark" : ""} grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xl font-bold`}
                aria-hidden="true"
              >
                ✓
              </span>
              <div>
                <h2
                  id="completion-title"
                  className="font-serif text-3xl leading-none tracking-[-0.03em]"
                >
                  Today is complete.
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  You showed up. Keep writing, or leave the rest for tomorrow.
                </p>
              </div>
            </div>
            <div className="mt-5 sm:mt-0 sm:text-right">
              <button
                type="button"
                onClick={() => setShowAccountMessage(true)}
                className="w-full rounded-full bg-[var(--paper)] px-5 py-3 text-sm font-bold text-[var(--ink)] outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--ink)] sm:w-auto"
              >
                Save your entry and begin your year
              </button>
              {showAccountMessage && (
                <p className="mt-3 text-sm font-semibold text-white" role="status">
                  Accounts are coming next.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
