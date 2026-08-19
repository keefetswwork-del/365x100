"use client";

interface OfflineAccountPanelProps {
  onSignOut: () => Promise<void>;
}

export function OfflineAccountPanel({ onSignOut }: OfflineAccountPanelProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(19,35,31,0.5)] p-5 backdrop-blur-sm">
      <section
        aria-labelledby="offline-account-title"
        aria-modal="true"
        className="w-full max-w-md rounded-[2rem] bg-[var(--paper)] p-7 shadow-2xl"
        role="dialog"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">Offline</p>
        <h2 id="offline-account-title" className="mt-2 font-serif text-4xl tracking-[-0.04em]">
          Connect once to finish loading this account.
        </h2>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          This device does not yet have the account details needed to place writing on the correct calendar day. Reconnect and we will continue automatically.
        </p>
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="mt-5 w-full rounded-full px-5 py-3 text-sm font-bold text-[var(--muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Sign out instead
        </button>
      </section>
    </div>
  );
}
