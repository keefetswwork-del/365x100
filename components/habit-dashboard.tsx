"use client";

import { buildCalendarGrid, formatMonth } from "@/lib/habit";
import type { HabitSummary } from "@/types/habit";

interface HabitDashboardProps {
  loading: boolean;
  onClose: () => void;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onSelectDate: (date: string) => void;
  open: boolean;
  summary: HabitSummary | null;
}
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function stateClass(state: ReturnType<typeof buildCalendarGrid>[number]["state"]): string {
  if (state === "complete") return "bg-[var(--accent)] text-white shadow-sm";
  if (state === "started") return "bg-[var(--sage)]/45 text-[var(--ink)]";
  if (state === "missed") return "border border-[var(--line)] text-[var(--muted)]";
  if (state === "future" || state === "before-start") return "text-[var(--muted)]/35";
  return "text-[var(--muted)]";
}

export function HabitDashboard({
  loading,
  onClose,
  onNextMonth,
  onPreviousMonth,
  onSelectDate,
  open,
  summary,
}: HabitDashboardProps) {
  if (!open) return null;
  const days = summary ? buildCalendarGrid(summary) : [];
  const canMoveForward = Boolean(summary && summary.visibleMonth < summary.today.slice(0, 7) + "-01");

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[rgba(19,35,31,0.45)] backdrop-blur-sm sm:place-items-center sm:p-6">
      <section aria-labelledby="habit-title" aria-modal="true" role="dialog" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] bg-[var(--paper)] p-5 shadow-2xl sm:rounded-[2rem] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Your year so far</p>
            <h2 id="habit-title" className="mt-1 font-serif text-4xl tracking-[-0.04em]">A record of showing up.</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Close</button>
        </div>

        {loading && <p className="mt-8 text-sm font-semibold text-[var(--muted)]" role="status">Loading your progress…</p>}
        {!loading && !summary && <p className="mt-8 rounded-2xl bg-white/55 p-5 text-sm text-[var(--muted)]" role="status">Progress is unavailable right now. Your editor and saved writing are still safe.</p>}

        {summary && (
          <>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <article className="rounded-2xl bg-[var(--ink)] p-4 text-white"><p className="text-xs font-bold uppercase tracking-wider text-white/65">Current</p><p className="mt-1 font-serif text-3xl">{summary.currentStreak}</p><p className="text-sm text-white/75">day streak</p></article>
              <article className="rounded-2xl border border-[var(--line)] bg-white/55 p-4"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Longest</p><p className="mt-1 font-serif text-3xl">{summary.longestStreak}</p><p className="text-sm text-[var(--muted)]">days</p></article>
              <article className="rounded-2xl border border-[var(--line)] bg-white/55 p-4"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">This month</p><p className="mt-1 font-serif text-3xl">{summary.monthCompletedDays}</p><p className="text-sm text-[var(--muted)]">days · {summary.monthWords} words</p></article>
              <article className="rounded-2xl border border-[var(--line)] bg-white/55 p-4"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">This year</p><p className="mt-1 font-serif text-3xl">{summary.yearCompletedDays}</p><p className="text-sm text-[var(--muted)]">days · {summary.yearWords} words</p></article>
            </div>

            <section className="mt-5 overflow-hidden rounded-[1.5rem] bg-[var(--ink)] p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Your book in progress</p>
                <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em]">These pages are becoming your year.</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">You have written {summary.yearWords.toLocaleString()} words across {summary.yearCompletedDays} completed days this year.</p>
              </div>
              <span className="mt-4 inline-flex shrink-0 rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white/75 sm:mt-0">Digital and hardcopy books · coming later</span>
            </section>

            <section className="mt-7 rounded-[1.5rem] border border-[var(--line)] bg-white/55 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={onPreviousMonth} aria-label="Previous month" className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] text-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">←</button>
                <h3 className="font-serif text-2xl">{formatMonth(summary.visibleMonth)}</h3>
                <button type="button" onClick={onNextMonth} disabled={!canMoveForward} aria-label="Next month" className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] text-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-30">→</button>
              </div>
              <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[0.68rem] font-bold uppercase tracking-wider text-[var(--muted)] sm:gap-2">
                {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
                {days.map((day) => {
                  const selectable = day.inVisibleMonth && day.state !== "future" && day.state !== "before-start";
                  return (
                    <button
                      key={day.date}
                      type="button"
                      disabled={!selectable}
                      onClick={() => onSelectDate(day.date)}
                      aria-label={`${day.date}: ${day.state}${day.wordCount ? `, ${day.wordCount} words` : ""}`}
                      className={`aspect-square rounded-xl text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${stateClass(day.state)} ${day.isToday ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--paper)]" : ""} ${day.inVisibleMonth ? "" : "opacity-30"}`}
                    >
                      {day.dayOfMonth}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold text-[var(--muted)]">
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />Complete</span>
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[var(--sage)]/60" />Started</span>
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-[var(--line)]" />Missed</span>
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  );
}
