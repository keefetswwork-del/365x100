"use client";

import { useState, type FormEvent } from "react";

import { getSupportedTimeZones, isValidTimeZone } from "@/lib/timezone";

interface AccountPanelProps {
  email: string;
  open: boolean;
  timezone: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onSaveTimezone: (timezone: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function AccountPanel({
  email,
  open,
  timezone,
  onClose,
  onDelete,
  onSaveTimezone,
  onSignOut,
}: AccountPanelProps) {
  const [timezoneValue, setTimezoneValue] = useState(timezone);
  const [deleteValue, setDeleteValue] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");

  if (!open) {
    return null;
  }

  async function saveTimezone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidTimeZone(timezoneValue)) {
      setMessage("Choose a valid IANA timezone.");
      return;
    }
    setIsWorking(true);
    setMessage("");
    try {
      await onSaveTimezone(timezoneValue);
      setMessage("Timezone saved.");
    } catch {
      setMessage("Timezone could not be saved.");
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteAccount() {
    setIsWorking(true);
    setMessage("");
    try {
      await onDelete();
    } catch {
      setMessage("Account deletion could not be completed. Nothing was removed.");
      setIsWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[rgba(19,35,31,0.45)] backdrop-blur-sm sm:place-items-center sm:p-6">
      <section aria-labelledby="account-title" aria-modal="true" role="dialog" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] bg-[var(--paper)] p-6 shadow-2xl sm:rounded-[2rem] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Signed in as</p>
            <h2 id="account-title" className="mt-1 break-all font-serif text-3xl tracking-[-0.03em]">{email}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Close</button>
        </div>

        <form onSubmit={saveTimezone} className="mt-8 rounded-2xl border border-[var(--line)] bg-white/55 p-5">
          <h3 className="font-serif text-2xl">Your writing day</h3>
          <label htmlFor="account-timezone" className="mt-4 block text-sm font-bold">Timezone</label>
          <input id="account-timezone" list="account-timezones" value={timezoneValue} onChange={(event) => setTimezoneValue(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" />
          <datalist id="account-timezones">{getSupportedTimeZones().map((option) => <option key={option} value={option} />)}</datalist>
          <button type="submit" disabled={isWorking || timezoneValue === timezone} className="mt-3 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50">Save timezone</button>
        </form>

        <button type="button" disabled={isWorking} onClick={() => void onSignOut()} className="mt-6 w-full rounded-full border border-[var(--ink)] px-5 py-3 font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60">Sign out</button>

        <section className="mt-8 border-t border-red-900/15 pt-6">
          <h3 className="font-serif text-2xl text-red-900">Delete account</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">This permanently deletes your profile and every cloud entry. Type DELETE to confirm.</p>
          <label htmlFor="delete-confirmation" className="sr-only">Type DELETE to confirm account deletion</label>
          <input id="delete-confirmation" value={deleteValue} onChange={(event) => setDeleteValue(event.target.value)} className="mt-4 w-full rounded-xl border border-red-900/20 bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-red-700" placeholder="DELETE" />
          <button type="button" disabled={isWorking || deleteValue !== "DELETE"} onClick={() => void deleteAccount()} className="mt-3 w-full rounded-full bg-red-800 px-5 py-3 font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-4 disabled:opacity-40">Permanently delete my account</button>
        </section>

        {message && <p className="mt-4 text-sm font-semibold" role="status">{message}</p>}
      </section>
    </div>
  );
}
