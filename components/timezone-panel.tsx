"use client";

import { useState, type FormEvent } from "react";

import { getSupportedTimeZones, isValidTimeZone } from "@/lib/timezone";

interface TimezonePanelProps {
  detectedTimezone: string;
  onSave: (timezone: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function TimezonePanel({ detectedTimezone, onSave, onSignOut }: TimezonePanelProps) {
  const [timezone, setTimezone] = useState(detectedTimezone);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const timezones = getSupportedTimeZones();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidTimeZone(timezone)) {
      setErrorMessage("Choose a valid IANA timezone, such as Asia/Singapore.");
      return;
    }

    setIsWorking(true);
    setErrorMessage("");
    try {
      await onSave(timezone);
    } catch {
      setErrorMessage("Your timezone could not be saved. Your draft remains safe in this browser.");
      setIsWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(19,35,31,0.5)] p-5 backdrop-blur-sm">
      <section
        aria-labelledby="timezone-title"
        aria-modal="true"
        className="w-full max-w-md rounded-[2rem] bg-[var(--paper)] p-7 shadow-2xl"
        role="dialog"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">One last detail</p>
        <h2 id="timezone-title" className="mt-2 font-serif text-4xl tracking-[-0.04em]">
          When does your day end?
        </h2>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          We use this timezone to keep writing around midnight on the correct calendar day.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label htmlFor="timezone" className="block text-sm font-bold">Timezone</label>
          <input
            id="timezone"
            list="timezone-options"
            required
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-white/75 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          />
          <datalist id="timezone-options">
            {timezones.map((option) => <option key={option} value={option} />)}
          </datalist>
          <button
            type="submit"
            disabled={isWorking}
            className="w-full rounded-full bg-[var(--ink)] px-5 py-3 font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 disabled:opacity-60"
          >
            {isWorking ? "Saving…" : `Use ${timezone}`}
          </button>
        </form>
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="mt-3 w-full rounded-full px-5 py-2 text-sm font-bold text-[var(--muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Sign out instead
        </button>
        {errorMessage && <p className="mt-4 text-sm font-semibold text-red-800" role="alert">{errorMessage}</p>}
      </section>
    </div>
  );
}
