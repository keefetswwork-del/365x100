"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
  markLegalConsentPending,
  recordOperationalEvent,
} from "@/lib/beta-operations";
import { getSiteUrl, getSupabaseClient } from "@/lib/supabase";

interface AuthPanelProps {
  open: boolean;
  onAuthenticated: () => void;
  onClose: () => void;
}

export function AuthPanel({ open, onAuthenticated, onClose }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  if (!open) {
    return null;
  }

  const client = getSupabaseClient();
  const consentReady = privacyAccepted && termsAccepted;

  async function continueWithGoogle() {
    if (!client) {
      setErrorMessage("Accounts are temporarily unavailable. Your draft is still saved here.");
      return;
    }

    setIsWorking(true);
    setErrorMessage("");
    markLegalConsentPending();
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${getSiteUrl()}/auth/callback` },
    });
    if (error) {
      void recordOperationalEvent(client, "auth", "auth-callback-failed");
      setErrorMessage("Google sign-in could not start. Please try again.");
      setIsWorking(false);
    }
  }

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) {
      setErrorMessage("Accounts are temporarily unavailable. Your draft is still saved here.");
      return;
    }

    setIsWorking(true);
    setErrorMessage("");
    markLegalConsentPending();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setIsWorking(false);

    if (error) {
      void recordOperationalEvent(client, "auth", "otp-send-failed");
      setErrorMessage("The sign-in code could not be sent. Please check the email and try again.");
      return;
    }

    setStep("code");
    setResendSeconds(60);
  }

  async function resendCode() {
    if (!client || resendSeconds > 0) return;
    setIsWorking(true);
    setErrorMessage("");
    markLegalConsentPending();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setIsWorking(false);
    if (error) {
      void recordOperationalEvent(client, "auth", "otp-send-failed");
      setErrorMessage("A new code could not be sent yet. Please wait and try again.");
      return;
    }
    setResendSeconds(60);
    setErrorMessage("A new six-digit code has been sent.");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) {
      return;
    }

    setIsWorking(true);
    setErrorMessage("");
    const { error } = await client.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setIsWorking(false);

    if (error) {
      void recordOperationalEvent(client, "auth", "otp-verify-failed");
      setErrorMessage("That code is invalid or expired. Request a new one and try again.");
      return;
    }

    onAuthenticated();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[rgba(19,35,31,0.45)] p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
      <section
        aria-labelledby="auth-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-t-[2rem] bg-[var(--paper)] p-6 shadow-2xl sm:rounded-[2rem] sm:p-8"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-dark)]">
              Your writing is ready
            </p>
            <h2 id="auth-title" className="mt-2 font-serif text-4xl tracking-[-0.04em]">
              Begin your year.
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Close
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          Create an account without losing a word. Your browser draft stays in place until its cloud copy is confirmed.
        </p>

        <div className="mt-5 space-y-3">
          <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-white/55 p-3 text-sm font-bold">
            <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
            <span>I accept the <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--accent)] decoration-2 underline-offset-4">Privacy Policy<span className="sr-only"> (opens in a new tab)</span></Link>.</span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-white/55 p-3 text-sm font-bold">
            <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
            <span>I accept the <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--accent)] decoration-2 underline-offset-4">Terms of Use<span className="sr-only"> (opens in a new tab)</span></Link>.</span>
          </label>
        </div>

        <button
          type="button"
          disabled={isWorking || !consentReady}
          onClick={continueWithGoogle}
          className="mt-6 w-full rounded-full bg-[var(--ink)] px-5 py-3.5 font-bold text-white outline-none transition hover:bg-[var(--accent-dark)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          <span className="h-px flex-1 bg-[var(--line)]" /> or use email <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        {step === "email" ? (
          <form onSubmit={requestCode} className="space-y-3">
            <label htmlFor="auth-email" className="block text-sm font-bold">
              Email address
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-white/75 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              placeholder="you@example.com"
            />
            <button
              type="submit"
              disabled={isWorking || !consentReady}
              className="w-full rounded-full border border-[var(--ink)] px-5 py-3 font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
            >
              {isWorking ? "Sending code…" : "Email me a six-digit code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <label htmlFor="auth-code" className="block text-sm font-bold">
              Code sent to {email}
            </label>
            <input
              id="auth-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-[var(--line)] bg-white/75 px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              placeholder="000000"
            />
            <button
              type="submit"
              disabled={isWorking || code.length !== 6}
              className="w-full rounded-full bg-[var(--accent)] px-5 py-3 font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dark)] focus-visible:ring-offset-4 disabled:opacity-60"
            >
              {isWorking ? "Checking…" : "Verify and save my writing"}
            </button>
            <button
              type="button"
              disabled={isWorking || resendSeconds > 0}
              onClick={() => void resendCode()}
              className="w-full rounded-full border border-[var(--line)] px-5 py-2 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"
            >
              {resendSeconds > 0 ? `Send another code in ${resendSeconds}s` : "Send another code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setErrorMessage("");
              }}
              className="w-full rounded-full px-5 py-2 text-sm font-bold text-[var(--muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Use a different email
            </button>
          </form>
        )}

        {errorMessage && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
            {errorMessage}
          </p>
        )}
      </section>
    </div>
  );
}
