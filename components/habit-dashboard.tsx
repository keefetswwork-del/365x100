"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";

import { PrivatePhoto } from "@/components/private-photo";
import type { Database } from "@/lib/database.types";
import { buildCalendarGrid, formatMonth, monthStart, shiftDate } from "@/lib/habit";
import { mergeHistoryPages } from "@/lib/history";
import { writingYearProgressPercent } from "@/lib/writing-year";
import type { WritingYearSummary } from "@/types/beta";
import type { HabitSummary } from "@/types/habit";
import type { HistoryEntrySummary, HistoryFilters, HistoryPage, JournalLibraryView } from "@/types/history";

interface HabitDashboardProps {
  client: SupabaseClient<Database> | null;
  exportBlockedReason: string | null;
  initialView: JournalLibraryView;
  loading: boolean;
  onClose: () => void;
  onCheckEntryExists: (entryDate: string) => Promise<boolean>;
  onExportAll: () => Promise<void>;
  onExportSelected: (entryDates: string[]) => Promise<void>;
  onLoadHistory: (filters: HistoryFilters, beforeDate?: string | null) => Promise<HistoryPage>;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onRhythmViewed: () => void;
  onSelectDate: (date: string) => void;
  open: boolean;
  selectedDate: string;
  summary: HabitSummary | null;
  writingYearSummary: WritingYearSummary | null;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TABS: Array<{ label: string; value: JournalLibraryView }> = [
  { label: "Progress", value: "progress" },
  { label: "Calendar", value: "calendar" },
  { label: "History", value: "history" },
];

function stateClass(state: ReturnType<typeof buildCalendarGrid>[number]["state"]): string {
  if (state === "goal") return "bg-[var(--accent)] text-white shadow-sm";
  if (state === "written") return "bg-[var(--sage)]/45 text-[var(--ink)]";
  if (state === "open") return "border border-[var(--line)] text-[var(--muted)]";
  if (state === "future" || state === "before-start") return "text-[var(--muted)]/35";
  return "text-[var(--muted)]";
}

function stateLabel(state: ReturnType<typeof buildCalendarGrid>[number]["state"]): string {
  if (state === "goal") return "100-word goal reached";
  if (state === "written") return "Memory saved";
  if (state === "open") return "No memory yet";
  if (state === "future") return "Future date";
  return "Before your first memory";
}

function historyMonth(entryDate: string): string {
  return new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC", year: "numeric" })
    .format(new Date(`${entryDate.slice(0, 7)}-01T00:00:00Z`));
}

function historyDate(entryDate: string): string {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC", weekday: "short" })
    .format(new Date(`${entryDate}T00:00:00Z`));
}

export function HabitDashboard({
  client,
  exportBlockedReason,
  initialView,
  loading,
  onClose,
  onCheckEntryExists,
  onExportAll,
  onExportSelected,
  onLoadHistory,
  onNextMonth,
  onPreviousMonth,
  onRhythmViewed,
  onSelectDate,
  open,
  selectedDate,
  summary,
  writingYearSummary,
}: HabitDashboardProps) {
  const [activeView, setActiveView] = useState<JournalLibraryView>(initialView);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [historyItems, setHistoryItems] = useState<HistoryEntrySummary[]>([]);
  const [historyPage, setHistoryPage] = useState<HistoryPage | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [exportWorking, setExportWorking] = useState(false);
  const [earlierDate, setEarlierDate] = useState("");
  const [earlierDateError, setEarlierDateError] = useState("");
  const [earlierDateExisting, setEarlierDateExisting] = useState<string | null>(null);
  const [earlierDateWorking, setEarlierDateWorking] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const dialogRef = useRef<HTMLElement>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const closeDialog = useEffectEvent(onClose);
  const loadHistory = useEffectEvent(onLoadHistory);
  const recordRhythmView = useEffectEvent(onRhythmViewed);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [initialView, open]);

  useEffect(() => {
    if (!open || activeView !== "history") return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const page = await loadHistory({ fromDate: fromDate || null, query: deferredQuery, toDate: toDate || null });
        if (cancelled) return;
        setHistoryItems(page.items);
        setHistoryPage(page);
      } catch {
        if (!cancelled) setHistoryError("History is unavailable right now. Your saved writing is still safe.");
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeView, deferredQuery, fromDate, open, toDate]);

  useEffect(() => {
    if (open && activeView === "progress") recordRhythmView();
  }, [activeView, open]);

  if (!open) return null;
  const days = summary ? buildCalendarGrid(summary) : [];
  const canMoveForward = Boolean(summary && summary.visibleMonth < `${summary.today.slice(0, 7)}-01`);

  function moveCalendarFocus(currentIndex: number, offset: number) {
    const target = days[currentIndex + offset];
    if (target) dayRefs.current.get(target.date)?.focus();
  }

  async function loadMoreHistory() {
    if (!historyPage?.nextCursor || historyLoading) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const page = await onLoadHistory(
        { fromDate: fromDate || null, query: deferredQuery, toDate: toDate || null },
        historyPage.nextCursor,
      );
      setHistoryItems((current) => mergeHistoryPages(current, page.items));
      setHistoryPage(page);
    } catch {
      setHistoryError("More history could not be loaded.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function toggleSelected(entryDate: string) {
    setSelectedEntries((current) => {
      const next = new Set(current);
      if (next.has(entryDate)) next.delete(entryDate);
      else next.add(entryDate);
      return next;
    });
  }

  async function runExport(action: () => Promise<void>) {
    setExportWorking(true);
    setHistoryError("");
    try {
      await action();
    } catch {
      setHistoryError("Export could not be completed. Nothing was downloaded.");
    } finally {
      setExportWorking(false);
    }
  }

  async function openEarlierMemory() {
    if (!summary || !earlierDate || earlierDateWorking) return;
    if (earlierDate >= summary.today || (summary.firstEntryDate && earlierDate < summary.firstEntryDate)) {
      setEarlierDateError("Choose an earlier date within your Personal Year.");
      return;
    }
    setEarlierDateError("");
    setEarlierDateWorking(true);
    try {
      const exists = await onCheckEntryExists(earlierDate);
      if (exists) {
        setEarlierDateExisting(earlierDate);
        return;
      }
      onSelectDate(earlierDate);
    } catch {
      setEarlierDateError("Reconnect before adding an earlier memory so an existing entry is never replaced.");
    } finally {
      setEarlierDateWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[rgba(19,35,31,0.45)] backdrop-blur-sm sm:place-items-center sm:p-6" onMouseDown={onClose}>
      <section ref={dialogRef} tabIndex={-1} aria-labelledby="library-title" aria-modal="true" role="dialog" className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] bg-[var(--paper)] p-5 shadow-2xl outline-none sm:rounded-[2rem] sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Your journal library</p><h2 id="library-title" className="mt-1 font-serif text-4xl tracking-[-0.04em]">A record of showing up.</h2></div>
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Close</button>
        </div>

        <div role="tablist" aria-label="Journal library views" className="mt-6 grid grid-cols-3 rounded-full border border-[var(--line)] bg-white/45 p-1">
          {TABS.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={activeView === tab.value} onClick={() => setActiveView(tab.value)} className={`min-h-11 rounded-full px-3 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${activeView === tab.value ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"}`}>{tab.label}</button>)}
        </div>

        {summary && (
          <section className="mt-4 rounded-2xl border border-[var(--line)] bg-white/45 p-4" aria-labelledby="earlier-memory-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wider text-[var(--muted)]" htmlFor="earlier-memory-date">
                <span id="earlier-memory-title">Write an earlier memory</span>
                <input id="earlier-memory-date" type="date" value={earlierDate} min={summary.firstEntryDate ?? undefined} max={shiftDate(summary.today, -1)} onChange={(event) => { setEarlierDate(event.target.value); setEarlierDateError(""); setEarlierDateExisting(null); }} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-normal tracking-normal text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" />
              </label>
              <button type="button" disabled={!earlierDate || earlierDateWorking || Boolean(summary.firstEntryDate && summary.firstEntryDate >= summary.today)} onClick={() => void openEarlierMemory()} className="min-h-11 rounded-full bg-[var(--ink)] px-5 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-40">{earlierDateWorking ? "Checking…" : "Continue"}</button>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Choose any day from the beginning of your Personal Year through yesterday.</p>
            {earlierDateError && <p className="mt-2 text-sm font-semibold text-red-900" role="alert">{earlierDateError}</p>}
            {earlierDateExisting && <div className="mt-3 rounded-xl bg-[var(--sage)]/30 p-4" role="group" aria-label="Existing entry found"><p className="text-sm font-semibold">You already preserved a memory for {historyDate(earlierDateExisting)}.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onSelectDate(earlierDateExisting)} className="min-h-11 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Open existing entry</button><button type="button" onClick={() => setEarlierDateExisting(null)} className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Cancel</button></div></div>}
          </section>
        )}

        {loading && activeView !== "history" && <p className="mt-8 text-sm font-semibold text-[var(--muted)]" role="status">Loading your progress…</p>}
        {!loading && !summary && activeView !== "history" && <p className="mt-8 rounded-2xl bg-white/55 p-5 text-sm text-[var(--muted)]" role="status">Progress is unavailable right now. Your editor and saved writing are still safe.</p>}

        {summary && activeView === "progress" && <ProgressView summary={summary} writingYearSummary={writingYearSummary} />}
        {summary && activeView === "calendar" && (
          <CalendarView
            canMoveForward={canMoveForward}
            dayRefs={dayRefs}
            days={days}
            moveCalendarFocus={moveCalendarFocus}
            onNextMonth={onNextMonth}
            onPreviousMonth={onPreviousMonth}
            onSelectDate={onSelectDate}
            selectedDate={selectedDate}
            summary={summary}
          />
        )}

        {activeView === "history" && (
          <section role="tabpanel" className="mt-7">
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/55 p-4 sm:p-5">
              <label htmlFor="history-search" className="text-sm font-bold">Search your writing</label>
              <input id="history-search" type="search" value={query} maxLength={200} onChange={(event) => setQuery(event.target.value)} placeholder="A person, place or remembered phrase…" className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-[var(--muted)]">From<input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" /></label>
                <label className="text-xs font-bold text-[var(--muted)]">To<input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" /></label>
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Search stays private to your account and is never placed in the page address or analytics.</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" aria-pressed={selectionMode} onClick={() => setSelectionMode((current) => !current)} className="min-h-11 rounded-full border border-[var(--line)] bg-white/50 px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">{selectionMode ? "Done selecting" : "Select entries"}</button>
              {(selectionMode || selectedEntries.size > 0) && <button type="button" disabled={selectedEntries.size === 0 || Boolean(exportBlockedReason) || exportWorking} onClick={() => void runExport(() => onExportSelected([...selectedEntries]))} className="min-h-11 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-40">Export selected{selectedEntries.size ? ` (${selectedEntries.size})` : ""}</button>}
              <button type="button" disabled={Boolean(exportBlockedReason) || exportWorking} onClick={() => void runExport(onExportAll)} className="min-h-11 rounded-full border border-[var(--ink)] px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-40">Export all as text</button>
              {selectedEntries.size > 0 && <button type="button" onClick={() => setSelectedEntries(new Set())} className="min-h-11 rounded-full px-3 text-sm font-bold text-[var(--muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Clear selection</button>}
            </div>
            {exportBlockedReason && <p className="mt-2 text-xs font-semibold text-[var(--muted)]" role="status">{exportBlockedReason}</p>}
            {historyError && <p className="mt-4 rounded-2xl border border-red-900/15 bg-red-50/60 p-4 text-sm text-red-900" role="alert">{historyError}</p>}
            {historyLoading && historyItems.length === 0 && <p className="mt-6 text-sm font-semibold text-[var(--muted)]" role="status">Searching your journal…</p>}
            {!historyLoading && !historyError && historyItems.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-[var(--line)] p-7 text-center"><p className="font-serif text-2xl">No entries found.</p><p className="mt-2 text-sm text-[var(--muted)]">Try another phrase or clear the date filters.</p></div>}

            <div className="mt-5 space-y-3">
              {historyItems.map((entry, index) => {
                const showMonth = index === 0 || historyMonth(historyItems[index - 1].entryDate) !== historyMonth(entry.entryDate);
                const selected = selectedEntries.has(entry.entryDate);
                return <div key={entry.entryDate}>
                  {showMonth && <h3 className="mb-2 mt-6 font-serif text-2xl">{historyMonth(entry.entryDate)}</h3>}
                  <article className={`flex gap-3 rounded-2xl border bg-white/60 p-3 transition ${selected ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--line)]"}`}>
                    {selectionMode && <label className="grid h-11 w-11 shrink-0 place-items-center"><input type="checkbox" checked={selected} onChange={() => toggleSelected(entry.entryDate)} aria-label={`Select entry for ${historyDate(entry.entryDate)}`} className="h-5 w-5 accent-[var(--accent)]" /></label>}
                    {client && entry.media && <PrivatePhoto client={client} media={entry.media} alt={`Photo for ${historyDate(entry.entryDate)}`} className="h-24 w-24 shrink-0 rounded-xl object-cover" />}
                    <button type="button" onClick={() => onSelectDate(entry.entryDate)} className="min-w-0 flex-1 rounded-xl px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
                      <span className="flex flex-wrap items-center justify-between gap-2"><strong>{historyDate(entry.entryDate)}</strong><span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider ${entry.completed ? "bg-[var(--accent)] text-white" : "bg-[var(--sage)]/45 text-[var(--ink)]"}`}>{entry.completed ? "100-word goal" : "Memory saved"}</span></span>
                      <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">{entry.wordCount} {entry.wordCount === 1 ? "word" : "words"}</span>
                      <span className="mt-2 line-clamp-2 block text-sm leading-6 text-[var(--muted)]">{entry.excerpt || "This entry has no words yet."}</span>
                    </button>
                  </article>
                </div>;
              })}
            </div>
            {historyPage?.hasMore && <button type="button" disabled={historyLoading} onClick={() => void loadMoreHistory()} className="mt-5 min-h-11 w-full rounded-full border border-[var(--line)] bg-white/50 px-5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50">{historyLoading ? "Loading…" : "Load older entries"}</button>}
          </section>
        )}
      </section>
    </div>
  );
}

function formatWritingYearDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

function ProgressView({ summary, writingYearSummary }: { summary: HabitSummary; writingYearSummary: WritingYearSummary | null }) {
  const recentDate = summary.mostRecentWritingDate ? historyDate(summary.mostRecentWritingDate) : "Your first memory awaits";
  const currentMonth = formatMonth(monthStart(summary.today));
  return <div role="tabpanel" className="mt-7">
    <section aria-labelledby="writing-rhythm-title">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Writing Rhythm</p>
      <h3 id="writing-rhythm-title" className="mt-2 font-serif text-3xl tracking-[-0.03em]">Every memory keeps your story moving.</h3>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <article className="rounded-2xl bg-[var(--ink)] p-4 text-white"><p className="text-xs font-bold uppercase tracking-wider text-white/65">Last 7 days</p><p className="mt-1 font-serif text-3xl">{summary.lastSevenWritingDays}</p><p className="text-sm text-white/75">writing days</p></article>
        <article className="rounded-2xl border border-[var(--line)] bg-white/55 p-4"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">This month</p><p className="mt-1 font-serif text-3xl">{summary.monthWritingDays}</p><p className="text-sm text-[var(--muted)]">memories · {summary.monthWords} words</p></article>
        <article className="rounded-2xl border border-[var(--line)] bg-white/55 p-4"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Calendar year</p><p className="mt-1 font-serif text-3xl">{summary.yearWritingDays}</p><p className="text-sm text-[var(--muted)]">writing days · {summary.yearWords} words</p></article>
        <article className="rounded-2xl border border-[var(--line)] bg-white/55 p-4"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Words preserved</p><p className="mt-1 font-serif text-3xl">{summary.totalWords.toLocaleString()}</p><p className="text-sm text-[var(--muted)]">across your journal</p></article>
        <article className="rounded-2xl border border-[var(--line)] bg-white/55 p-4"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Most recent</p><p className="mt-2 text-base font-bold leading-5">{recentDate}</p><p className="mt-1 text-sm text-[var(--muted)]">Your story is still here.</p></article>
      </div>
    </section>
    <section className="mt-5 overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/60 p-5 sm:p-6" aria-labelledby="writing-year-title">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Your personal writing year</p>
      {!writingYearSummary && <p className="mt-3 text-sm text-[var(--muted)]">Writing-year progress is unavailable right now. Your saved entries are unaffected.</p>}
      {writingYearSummary && !writingYearSummary.hasWritingYear && <div className="mt-3"><h3 id="writing-year-title" className="font-serif text-3xl tracking-[-0.03em]">Your year begins with your first saved entry.</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">That date becomes Day 1 and stays fixed, even when you miss a day.</p></div>}
      {writingYearSummary?.hasWritingYear && <div className="mt-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h3 id="writing-year-title" className="font-serif text-4xl tracking-[-0.04em]">Day {writingYearSummary.dayNumber} of 365</h3><p className="mt-2 text-sm font-semibold text-[var(--muted)]">Writing year {writingYearSummary.yearNumber} · {formatWritingYearDate(writingYearSummary.startDate)} to {formatWritingYearDate(writingYearSummary.endDate)}</p></div>
          <div className="text-left sm:text-right"><p className="font-serif text-3xl">{writingYearSummary.writingDays}</p><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">writing days preserved</p></div>
        </div>
        <progress className="writing-progress mt-5 block" max={100} value={writingYearProgressPercent(writingYearSummary.dayNumber)} aria-label={`Day ${writingYearSummary.dayNumber} of 365`} />
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Your date range stays fixed, while every memory you add becomes part of your Personal Year.</p>
      </div>}
    </section>
    <section className="mt-5 rounded-[1.5rem] border border-[var(--line)] bg-white/55 p-5 sm:p-6" aria-labelledby="monthly-chapter-progress"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">{currentMonth} chapter</p><h3 id="monthly-chapter-progress" className="mt-2 font-serif text-3xl">{summary.monthlyChapterEligible ? "This month has qualified." : `${summary.monthWritingDays} of 10 writing days`}</h3><progress className="writing-progress mt-4 block" max={10} value={Math.min(summary.monthWritingDays, 10)} aria-label={`${summary.monthWritingDays} of 10 writing days for the monthly chapter`} /><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{summary.monthlyChapterEligible ? "Your chapter can be created after the calendar month ends in a future release." : `${summary.monthlyChapterDaysRemaining} more ${summary.monthlyChapterDaysRemaining === 1 ? "day" : "days"} will qualify this month. Every entry remains safely in your journal either way.`}</p></section>
    {writingYearSummary?.hasWritingYear && <section className="mt-5 rounded-[1.5rem] border border-[var(--line)] bg-white/55 p-5 sm:p-6" aria-labelledby="annual-book-progress"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Annual Book eligibility</p><h3 id="annual-book-progress" className="mt-2 font-serif text-3xl">{writingYearSummary.annualBookEligible ? "Your year can become a book." : `${writingYearSummary.writingDays} of 60 writing days`}</h3><progress className="writing-progress mt-4 block" max={60} value={Math.min(writingYearSummary.writingDays, 60)} aria-label={`${writingYearSummary.writingDays} of 60 writing days for Annual Book eligibility`} /><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{writingYearSummary.annualBookEligible ? "Your Annual Book can be generated after Day 365 ends in a future release." : `${writingYearSummary.annualBookDaysRemaining} more ${writingYearSummary.annualBookDaysRemaining === 1 ? "day" : "days"} will qualify this Personal Year. Monthly chapter eligibility does not affect this progress.`}</p></section>}
    <details className="mt-5 rounded-2xl border border-[var(--line)] bg-white/40 p-4"><summary className="cursor-pointer rounded-sm text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Optional streak and 100-word statistics</summary><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><p><strong className="block font-serif text-2xl">{summary.currentStreak}</strong><span className="text-xs text-[var(--muted)]">current streak</span></p><p><strong className="block font-serif text-2xl">{summary.longestStreak}</strong><span className="text-xs text-[var(--muted)]">longest streak</span></p><p><strong className="block font-serif text-2xl">{summary.monthCompletedDays}</strong><span className="text-xs text-[var(--muted)]">100-word goals this month</span></p><p><strong className="block font-serif text-2xl">{summary.yearCompletedDays}</strong><span className="text-xs text-[var(--muted)]">100-word goals this calendar year</span></p></div></details>
    <section className="mt-5 overflow-hidden rounded-[1.5rem] bg-[var(--ink)] p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Your book in progress</p><h3 className="mt-2 font-serif text-3xl tracking-[-0.03em]">These memories are becoming your year.</h3><p className="mt-2 max-w-xl text-sm leading-6 text-white/65">You have preserved {summary.yearWords.toLocaleString()} words across {summary.yearWritingDays} writing days this calendar year.</p></div>
      <span className="mt-4 inline-flex shrink-0 rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white/75 sm:mt-0">Digital and hardcopy books · coming later</span>
    </section>
  </div>;
}

interface CalendarViewProps {
  canMoveForward: boolean;
  dayRefs: React.RefObject<Map<string, HTMLButtonElement>>;
  days: ReturnType<typeof buildCalendarGrid>;
  moveCalendarFocus: (index: number, offset: number) => void;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onSelectDate: (date: string) => void;
  selectedDate: string;
  summary: HabitSummary;
}

function CalendarView({ canMoveForward, dayRefs, days, moveCalendarFocus, onNextMonth, onPreviousMonth, onSelectDate, selectedDate, summary }: CalendarViewProps) {
  return <section role="tabpanel" className="mt-7 rounded-[1.5rem] border border-[var(--line)] bg-white/55 p-4 sm:p-6">
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={onPreviousMonth} aria-label="Previous month" className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">←</button><h3 className="font-serif text-2xl">{formatMonth(summary.visibleMonth)}</h3><button type="button" onClick={onNextMonth} disabled={!canMoveForward} aria-label="Next month" className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-30">→</button></div>
    <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[0.68rem] font-bold uppercase tracking-wider text-[var(--muted)] sm:gap-2">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
    <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">{days.map((day, index) => {
      const selectable = day.inVisibleMonth && day.state !== "future" && day.state !== "before-start";
      const selected = day.date === selectedDate;
      return <button key={day.date} ref={(node) => { if (node) dayRefs.current.set(day.date, node); else dayRefs.current.delete(day.date); }} type="button" disabled={!selectable} onClick={() => onSelectDate(day.date)} onKeyDown={(event) => {
        const offsets: Partial<Record<string, number>> = { ArrowDown: 7, ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7 };
        const offset = offsets[event.key];
        if (!offset) return;
        event.preventDefault();
        moveCalendarFocus(index, offset);
      }} aria-current={day.isToday ? "date" : undefined} aria-pressed={selected} aria-label={`${day.date}: ${stateLabel(day.state)}${day.wordCount ? `, ${day.wordCount} words` : ""}${day.hasPhoto ? ", photo attached" : ""}`} className={`relative aspect-square rounded-xl text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${stateClass(day.state)} ${selected ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--paper)]" : day.isToday ? "ring-2 ring-[var(--sage)] ring-offset-2 ring-offset-[var(--paper)]" : ""} ${day.inVisibleMonth ? "" : "opacity-30"}`}>{day.dayOfMonth}{day.hasPhoto && <span aria-hidden="true" className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-current opacity-70" />}</button>;
    })}</div>
    <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold text-[var(--muted)]"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />100-word goal reached</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[var(--sage)]/60" />Memory saved</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-[var(--line)]" />No memory yet</span></div>
  </section>;
}
