"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getSupabaseClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Finishing your sign-in…");

  useEffect(() => {
    const client = getSupabaseClient();
    const code = new URLSearchParams(window.location.search).get("code");

    if (!client || !code) {
      queueMicrotask(() => {
        setMessage("This sign-in link is incomplete. Return to the writing page and try again.");
      });
      return;
    }

    void client.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setMessage("Sign-in could not be completed. Return to the writing page and try again.");
        return;
      }

      window.location.replace("/");
    });
  }, []);

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="max-w-md rounded-[2rem] border border-white/70 bg-white/65 p-8 text-center shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">365 × 100</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.04em]">{message}</h1>
        <Link href="/" className="mt-6 inline-block rounded-full bg-[var(--ink)] px-5 py-3 font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Return to today’s entry</Link>
      </section>
    </main>
  );
}
