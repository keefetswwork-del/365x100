"use client";

import { useState, type FormEvent } from "react";

import type { HabitPreferences } from "@/types/habit";

interface HabitOnboardingProps {
  onSave: (preferences: HabitPreferences) => Promise<void>;
}
const DAYS = [
  [1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"],
  [5, "Friday"], [6, "Saturday"], [7, "Sunday"],
] as const;

export function HabitOnboarding({ onSave }: HabitOnboardingProps) {
  const [enabled, setEnabled] = useState(false);
  const [day, setDay] = useState(7);
  const [time, setTime] = useState("19:00");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      await onSave({
        dailyPromptsEnabled: false,
        onboardingCompleted: true,
        weeklyReview: { day, enabled, time },
      });
    } catch {
      setMessage("Those settings could not be saved. Your writing is still safe.");
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[rgba(19,35,31,0.45)] backdrop-blur-sm sm:place-items-center sm:p-6">
      <section aria-labelledby="habit-onboarding-title" aria-modal="true" role="dialog" className="w-full max-w-lg rounded-t-[2rem] bg-[var(--paper)] p-6 shadow-2xl sm:rounded-[2rem] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">A gentle weekly rhythm</p>
        <h2 id="habit-onboarding-title" className="mt-2 font-serif text-4xl tracking-[-0.04em]">See the week you wrote.</h2>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">An optional review can show your writing rhythm and words preserved. It never includes journal text.</p>

        <form onSubmit={submit} className="mt-6">
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/55 p-4 font-bold">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
            Email my weekly review
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-sm font-bold">Day<select value={day} disabled={!enabled} onChange={(event) => setDay(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50">{DAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm font-bold">Time<input type="time" value={time} disabled={!enabled} onChange={(event) => setTime(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50" /></label>
          </div>
          <button type="submit" disabled={working} className="mt-5 w-full rounded-full bg-[var(--ink)] px-5 py-3.5 font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 disabled:opacity-60">{working ? "Saving…" : enabled ? "Save weekly review" : "Not now"}</button>
        </form>
        {message && <p className="mt-4 text-sm font-semibold text-red-800" role="alert">{message}</p>}
      </section>
    </div>
  );
}
