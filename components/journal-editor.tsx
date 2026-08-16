"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { ChangeEvent } from "react";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { AccountPanel } from "@/components/account-panel";
import { AuthPanel } from "@/components/auth-panel";
import { ConflictPanel } from "@/components/conflict-panel";
import { TimezonePanel } from "@/components/timezone-panel";
import {
  cacheFromCloudEntry,
  loadCloudCache,
  removeUserCloudCaches,
  saveCloudCache,
} from "@/lib/cloud-cache";
import {
  fetchCloudEntry,
  fetchProfile,
  saveCloudEntry,
  saveProfileTimezone,
} from "@/lib/cloud-entry";
import type { Database } from "@/lib/database.types";
import {
  migrateAnonymousEntries,
  reconcileDirtyCaches,
} from "@/lib/draft-migration";
import { loadEntry, removeEntry, saveEntry } from "@/lib/entry-storage";
import { formatLocalDate, getLocalDateString } from "@/lib/local-date";
import { CloudSaveQueue } from "@/lib/save-queue";
import { getSupabaseClient } from "@/lib/supabase";
import {
  formatDateInTimeZone,
  getBrowserTimeZone,
  getDateInTimeZone,
} from "@/lib/timezone";
import { countWords } from "@/lib/word-count";
import type {
  CloudSaveStatus,
  MigrationConflict,
  Profile,
} from "@/types/cloud";

const WORD_TARGET = 100;
const SAVE_DELAY_MS = 300;

type Client = SupabaseClient<Database>;

function mergeConflicts(
  current: MigrationConflict[],
  incoming: MigrationConflict[],
): MigrationConflict[] {
  const byDate = new Map(current.map((conflict) => [conflict.entryDate, conflict]));
  incoming.forEach((conflict) => byDate.set(conflict.entryDate, conflict));
  return [...byDate.values()].sort((left, right) =>
    left.entryDate.localeCompare(right.entryDate),
  );
}

export function JournalEditor() {
  const [entry, setEntry] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [dateLabel, setDateLabel] = useState("Today");
  const [saveStatus, setSaveStatus] = useState<CloudSaveStatus>("restoring");
  const [isReady, setIsReady] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timezoneRequired, setTimezoneRequired] = useState(false);
  const [detectedTimezone] = useState(getBrowserTimeZone);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [conflicts, setConflicts] = useState<MigrationConflict[]>([]);
  const [conflictWorking, setConflictWorking] = useState(false);
  const [bootstrapRetry, setBootstrapRetry] = useState(0);

  const entryRef = useRef(entry);
  const localDateRef = useRef(localDate);
  const previousWordCountRef = useRef(0);
  const versionRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEditedRef = useRef(false);
  const queueRef = useRef<CloudSaveQueue | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const cloudReadyRef = useRef(false);
  const conflictsRef = useRef<MigrationConflict[]>([]);

  const wordCount = countWords(entry);
  const progress = Math.min(wordCount, WORD_TARGET);

  function setConflictList(next: MigrationConflict[]) {
    conflictsRef.current = next;
    setConflicts(next);
    if (next.length > 0) {
      setSaveStatus("conflict");
    }
  }

  function restoreAnonymousDate(date = new Date()) {
    const today = getLocalDateString(date);
    const restoredEntry = loadEntry(today);
    const restoredWordCount = countWords(restoredEntry);

    entryRef.current = restoredEntry;
    localDateRef.current = today;
    previousWordCountRef.current = restoredWordCount;
    versionRef.current = 0;
    hasEditedRef.current = false;
    startTransition(() => {
      setEntry(restoredEntry);
      setLocalDate(today);
      setDateLabel(formatLocalDate(date));
      setHasCompleted(restoredWordCount >= WORD_TARGET);
      setSaveStatus("saved-local");
      setIsReady(true);
    });
  }

  function createSaveQueue(activeClient: Client, userId: string) {
    queueRef.current?.stop();
    queueRef.current = new CloudSaveQueue(
      (input) => saveCloudEntry(activeClient, input),
      {
        onConflict(input, result) {
          if (!result.remote) {
            setSaveStatus("error");
            return;
          }

          setConflictList(
            mergeConflicts(conflictsRef.current, [
              {
                entryDate: input.entryDate,
                localContent: input.content,
                remote: result.remote,
              },
            ]),
          );
        },
        onError() {
          setSaveStatus(navigator.onLine ? "error" : "offline");
        },
        onRetry() {
          setSaveStatus(navigator.onLine ? "retrying" : "offline");
        },
        onSaved(result) {
          const saved = result.entry;
          const isCurrent = saved.entryDate === localDateRef.current;
          const currentContent = entryRef.current;

          if (isCurrent) {
            versionRef.current = saved.version;
          }

          if (isCurrent && currentContent !== saved.content) {
            saveCloudCache(userId, {
              content: currentContent,
              dirty: true,
              entryDate: saved.entryDate,
              updatedAt: new Date().toISOString(),
              version: saved.version,
              wordCount: countWords(currentContent),
            });
            setSaveStatus("saving-cloud");
            return;
          }

          saveCloudCache(userId, cacheFromCloudEntry(saved));
          setSaveStatus("saved-cloud");
        },
        onSaving() {
          setSaveStatus("saving-cloud");
        },
      },
    );
  }

  async function loadSignedInDate(
    activeClient: Client,
    activeSession: Session,
    activeProfile: Profile,
    entryDate: string,
    knownConflicts = conflictsRef.current,
  ) {
    setIsReady(false);
    localDateRef.current = entryDate;
    setLocalDate(entryDate);
    setDateLabel(formatDateInTimeZone(new Date(), activeProfile.timezone));
    const conflict = knownConflicts.find((item) => item.entryDate === entryDate);
    if (conflict) {
      const restoredCount = countWords(conflict.localContent);
      entryRef.current = conflict.localContent;
      versionRef.current = conflict.remote.version;
      previousWordCountRef.current = restoredCount;
      setEntry(conflict.localContent);
      setHasCompleted(restoredCount >= WORD_TARGET);
      setSaveStatus("conflict");
      setIsReady(true);
      return;
    }

    const cache = loadCloudCache(activeSession.user.id, entryDate);
    try {
      const remote = await fetchCloudEntry(activeClient, entryDate);
      const restored = remote?.content ?? cache?.content ?? "";
      const restoredCount = countWords(restored);
      versionRef.current = remote?.version ?? cache?.version ?? 0;
      entryRef.current = restored;
      previousWordCountRef.current = restoredCount;
      hasEditedRef.current = false;

      if (remote) {
        saveCloudCache(activeSession.user.id, cacheFromCloudEntry(remote));
      }

      startTransition(() => {
        setEntry(restored);
        setHasCompleted(restoredCount >= WORD_TARGET);
        setSaveStatus("saved-cloud");
        setIsReady(true);
      });
    } catch {
      const restored = cache?.content ?? "";
      entryRef.current = restored;
      versionRef.current = cache?.version ?? 0;
      previousWordCountRef.current = countWords(restored);
      setEntry(restored);
      setHasCompleted(previousWordCountRef.current >= WORD_TARGET);
      setSaveStatus(navigator.onLine ? "error" : "offline");
      setIsReady(true);
    }

  }

  async function bootstrapCloud(
    activeClient: Client,
    activeSession: Session,
    activeProfile: Profile,
  ) {
    cloudReadyRef.current = false;
    profileRef.current = activeProfile;
    setProfile(activeProfile);
    setTimezoneRequired(false);
    createSaveQueue(activeClient, activeSession.user.id);

    const migrated = await migrateAnonymousEntries(activeClient, activeSession.user.id);
    const dirty = await reconcileDirtyCaches(activeClient, activeSession.user.id);
    const nextConflicts = mergeConflicts(conflictsRef.current, [...migrated, ...dirty]);
    setConflictList(nextConflicts);

    const now = new Date();
    const today = getDateInTimeZone(now, activeProfile.timezone);
    localDateRef.current = today;
    setLocalDate(today);
    setDateLabel(formatDateInTimeZone(now, activeProfile.timezone));
    await loadSignedInDate(
      activeClient,
      activeSession,
      activeProfile,
      today,
      nextConflicts,
    );
    cloudReadyRef.current = true;
  }

  const bootstrapCloudFromEffect = useEffectEvent(bootstrapCloud);

  function persistCurrentImmediately() {
    const currentDate = localDateRef.current;
    if (!currentDate) {
      return;
    }

    const currentSession = sessionRef.current;
    const currentProfile = profileRef.current;
    if (currentSession && currentProfile && cloudReadyRef.current) {
      const content = entryRef.current;
      const currentWordCount = countWords(content);
      saveCloudCache(currentSession.user.id, {
        content,
        dirty: true,
        entryDate: currentDate,
        updatedAt: new Date().toISOString(),
        version: versionRef.current,
        wordCount: currentWordCount,
      });
      queueRef.current?.enqueue({
        content,
        entryDate: currentDate,
        expectedVersion: versionRef.current,
        wordCount: currentWordCount,
      });
      return;
    }

    saveEntry(currentDate, entryRef.current);
  }

  useEffect(() => {
    restoreAnonymousDate();
    const activeClient = getSupabaseClient();
    if (!activeClient) {
      queueMicrotask(() => {
        setClient(null);
        setAuthResolved(true);
      });
      return;
    }

    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        setClient(activeClient);
      }
    });
    void activeClient.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }
      sessionRef.current = data.session;
      setSession(data.session);
      setAuthResolved(true);
    });

    const { data: listener } = activeClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return;
      }
      sessionRef.current = nextSession;
      setSession(nextSession);
      setAuthResolved(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      queueRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!authResolved || !client) {
      return;
    }

    if (!session) {
      queueRef.current?.stop();
      queueRef.current = null;
      profileRef.current = null;
      cloudReadyRef.current = false;
      queueMicrotask(() => {
        setProfile(null);
        setTimezoneRequired(false);
        setConflictList([]);
        restoreAnonymousDate();
      });
      return;
    }

    let cancelled = false;
    void fetchProfile(client)
      .then(async (existingProfile) => {
        if (cancelled) {
          return;
        }
        if (!existingProfile) {
          setTimezoneRequired(true);
          setSaveStatus("saved-local");
          return;
        }
        await bootstrapCloudFromEffect(client, session, existingProfile);
      })
      .catch(() => {
        if (!cancelled) {
          setSaveStatus(navigator.onLine ? "error" : "offline");
        }
      });

    return () => {
      cancelled = true;
    };
    // bootstrapRetry intentionally re-runs failed cloud initialization.
  }, [authResolved, bootstrapRetry, client, session]);

  useEffect(() => {
    entryRef.current = entry;

    if (!isReady || !localDate || !hasEditedRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    setSaveStatus("saving-local");
    saveTimerRef.current = setTimeout(() => {
      const activeSession = sessionRef.current;
      const activeProfile = profileRef.current;
      if (activeSession && activeProfile && cloudReadyRef.current) {
        const currentWordCount = countWords(entryRef.current);
        saveCloudCache(activeSession.user.id, {
          content: entryRef.current,
          dirty: true,
          entryDate: localDate,
          updatedAt: new Date().toISOString(),
          version: versionRef.current,
          wordCount: currentWordCount,
        });

        if (!navigator.onLine) {
          setSaveStatus("offline");
        } else {
          queueRef.current?.enqueue({
            content: entryRef.current,
            entryDate: localDate,
            expectedVersion: versionRef.current,
            wordCount: currentWordCount,
          });
        }
      } else {
        saveEntry(localDate, entryRef.current);
        setSaveStatus("saved-local");
      }
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
      if (document.visibilityState !== "hidden") {
        return;
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      persistCurrentImmediately();
    }

    function retryCloud() {
      queueRef.current?.retryNow();
      const activeSession = sessionRef.current;
      const currentDate = localDateRef.current;
      if (
        navigator.onLine &&
        activeSession &&
        currentDate &&
        cloudReadyRef.current
      ) {
        const dirtyCache = loadCloudCache(activeSession.user.id, currentDate);
        if (dirtyCache?.dirty) {
          queueRef.current?.enqueue({
            content: dirtyCache.content,
            entryDate: dirtyCache.entryDate,
            expectedVersion: dirtyCache.version,
            wordCount: dirtyCache.wordCount,
          });
        }
      }
      if (sessionRef.current && !cloudReadyRef.current) {
        setBootstrapRetry((value) => value + 1);
      }
    }

    function retryWhenVisible() {
      if (document.visibilityState === "visible") {
        retryCloud();
      }
    }

    document.addEventListener("visibilitychange", saveWhenHidden);
    window.addEventListener("online", retryCloud);
    window.addEventListener("focus", retryCloud);
    document.addEventListener("visibilitychange", retryWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", saveWhenHidden);
      window.removeEventListener("online", retryCloud);
      window.removeEventListener("focus", retryCloud);
      document.removeEventListener("visibilitychange", retryWhenVisible);
    };
  }, []);

  useEffect(() => {
    async function checkDate() {
      const activeProfile = profileRef.current;
      const activeSession = sessionRef.current;
      const now = new Date();
      const nextDate = activeProfile
        ? getDateInTimeZone(now, activeProfile.timezone)
        : getLocalDateString(now);

      if (!localDateRef.current || nextDate === localDateRef.current) {
        return;
      }

      persistCurrentImmediately();
      localDateRef.current = nextDate;
      hasEditedRef.current = false;

      if (activeProfile && activeSession && client && cloudReadyRef.current) {
        await loadSignedInDate(client, activeSession, activeProfile, nextDate);
      } else {
        restoreAnonymousDate(now);
      }
    }

    function checkVisibleDate() {
      if (document.visibilityState === "visible") {
        void checkDate();
      }
    }

    const timer = window.setInterval(() => void checkDate(), 60000);
    window.addEventListener("focus", checkVisibleDate);
    document.addEventListener("visibilitychange", checkVisibleDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", checkVisibleDate);
      document.removeEventListener("visibilitychange", checkVisibleDate);
    };
  }, [client]);

  function handleEntryChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextEntry = event.target.value;
    const nextWordCount = countWords(nextEntry);

    if (
      previousWordCountRef.current < WORD_TARGET &&
      nextWordCount >= WORD_TARGET
    ) {
      setIsCelebrating(true);
      window.setTimeout(() => setIsCelebrating(false), 1000);
    }

    previousWordCountRef.current = nextWordCount;
    entryRef.current = nextEntry;
    hasEditedRef.current = true;
    setEntry(nextEntry);
    setHasCompleted(nextWordCount >= WORD_TARGET);
  }

  async function confirmTimezone(timezone: string) {
    if (!client || !session) {
      throw new Error("Authentication required");
    }
    const savedProfile = await saveProfileTimezone(client, timezone);
    await bootstrapCloud(client, session, savedProfile);
  }

  async function signOut() {
    if (!client) {
      return;
    }
    persistCurrentImmediately();
    await client.auth.signOut();
    setAuthOpen(false);
    setAccountOpen(false);
  }

  async function updateTimezone(timezone: string) {
    if (!client || !session) {
      throw new Error("Authentication required");
    }
    persistCurrentImmediately();
    const savedProfile = await saveProfileTimezone(client, timezone);
    await bootstrapCloud(client, session, savedProfile);
  }

  async function deleteAccount() {
    if (!client || !session) {
      throw new Error("Authentication required");
    }

    persistCurrentImmediately();
    const { error } = await client.functions.invoke("delete-account", {
      body: { confirmation: "DELETE" },
    });
    if (error) {
      throw new Error("Deletion failed");
    }

    removeUserCloudCaches(session.user.id);
    queueRef.current?.stop();
    await client.auth.signOut({ scope: "local" });
    sessionRef.current = null;
    setSession(null);
    setAccountOpen(false);
  }

  async function keepCloudVersion() {
    const conflict = conflictsRef.current[0];
    if (!conflict || !session) {
      return;
    }

    setConflictWorking(true);
    saveCloudCache(session.user.id, cacheFromCloudEntry(conflict.remote));
    removeEntry(conflict.entryDate);
    if (conflict.entryDate === localDateRef.current) {
      entryRef.current = conflict.remote.content;
      versionRef.current = conflict.remote.version;
      previousWordCountRef.current = conflict.remote.wordCount;
      setEntry(conflict.remote.content);
      setHasCompleted(conflict.remote.wordCount >= WORD_TARGET);
    }
    const remaining = conflictsRef.current.slice(1);
    setConflictList(remaining);
    if (remaining.length === 0) {
      setSaveStatus("saved-cloud");
    }
    setConflictWorking(false);
  }

  async function keepLocalVersion() {
    const conflict = conflictsRef.current[0];
    if (!conflict || !session || !client) {
      return;
    }

    setConflictWorking(true);
    try {
      const result = await saveCloudEntry(client, {
        content: conflict.localContent,
        entryDate: conflict.entryDate,
        expectedVersion: conflict.remote.version,
        wordCount: countWords(conflict.localContent),
      });

      if (result.status === "conflict" && result.remote) {
        const updated = [...conflictsRef.current];
        updated[0] = { ...conflict, remote: result.remote };
        setConflictList(updated);
        return;
      }

      if (result.status === "saved") {
        saveCloudCache(session.user.id, cacheFromCloudEntry(result.entry));
        removeEntry(conflict.entryDate);
        if (conflict.entryDate === localDateRef.current) {
          versionRef.current = result.entry.version;
        }
        const remaining = conflictsRef.current.slice(1);
        setConflictList(remaining);
        if (remaining.length === 0) {
          setSaveStatus("saved-cloud");
        }
      }
    } finally {
      setConflictWorking(false);
    }
  }

  const statusLabel: Record<CloudSaveStatus, string> = {
    conflict: "Review versions",
    error: "Cloud save needs attention",
    offline: "Offline — saved on this device",
    restoring: "Restoring…",
    retrying: "Retrying cloud save…",
    "saved-cloud": "Saved to cloud",
    "saved-local": "Saved on this device",
    "saving-cloud": "Saving to cloud…",
    "saving-local": "Saving locally…",
  };

  const signedIn = Boolean(session);

  return (
    <>
      <main className="journal-shell relative min-h-screen overflow-hidden px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
        <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col sm:min-h-[calc(100vh-4rem)]">
          <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
            <a href="#editor" className="rounded-sm font-serif text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--paper)]">
              365 <span className="text-[var(--accent)]">×</span> 100
            </a>
            <div className="flex items-center gap-3 sm:gap-5">
              <p className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] sm:text-xs sm:tracking-[0.16em]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${saveStatus === "error" || saveStatus === "conflict" ? "bg-red-700" : saveStatus.startsWith("saving") || saveStatus === "retrying" ? "bg-[var(--accent)]" : "bg-[var(--sage)]"}`} aria-hidden="true" />
                <span aria-live="polite">{statusLabel[saveStatus]}</span>
              </p>
              <button
                type="button"
                disabled={!authResolved}
                onClick={() => signedIn ? setAccountOpen(true) : setAuthOpen(true)}
                className="rounded-full border border-[var(--line)] bg-white/40 px-3 py-2 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50 sm:px-4 sm:text-sm"
              >
                {signedIn ? "Account" : "Sign in"}
              </button>
            </div>
          </header>

          <div className="grid flex-1 gap-7 py-7 md:gap-10 md:py-10 lg:grid-cols-[0.38fr_0.62fr] lg:gap-16 lg:py-14">
            <section className="flex flex-col justify-between gap-6 lg:py-3">
              <div>
                <time dateTime={localDate || undefined} className="text-sm font-bold uppercase tracking-[0.17em] text-[var(--accent-dark)]">{dateLabel}</time>
                <h1 className="mt-4 max-w-xl font-serif text-[clamp(2.7rem,8vw,5.5rem)] leading-[0.91] font-medium tracking-[-0.055em] text-[var(--ink)]">What happened today?</h1>
                <p className="mt-5 max-w-md text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
                  {signedIn ? "Your words save here first, then safely sync to your account." : "One honest detail is enough to begin. This draft stays private in this browser."}
                </p>
              </div>
              <p className="hidden max-w-xs border-l-2 border-[var(--sage)] pl-4 text-sm leading-6 text-[var(--muted)] lg:block">Write past one hundred if the day has more to say.</p>
            </section>

            <section id="editor" className="flex min-h-[31rem] flex-col rounded-[1.6rem] border border-white/70 bg-white/65 p-4 shadow-[0_24px_80px_rgba(40,55,48,0.11)] backdrop-blur-sm sm:min-h-[37rem] sm:rounded-[2rem] sm:p-6 lg:min-h-0 lg:p-8">
              <label htmlFor="daily-entry" className="sr-only">Your entry for today</label>
              <textarea id="daily-entry" value={entry} onChange={handleEntryChange} disabled={!isReady} placeholder={isReady ? "Start with a moment you want to remember…" : "Restoring today’s draft…"} spellCheck="true" className="entry-textarea min-h-[23rem] w-full flex-1 resize-none rounded-xl border-0 bg-transparent px-2 py-1 font-serif text-[1.45rem] leading-8 text-[var(--ink)] outline-none placeholder:text-[var(--muted)]/45 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-white/70 disabled:cursor-wait sm:min-h-[27rem] sm:px-3 sm:text-[1.65rem]" aria-describedby="entry-progress" />
              <div id="entry-progress" className="mt-5 border-t border-[var(--line)] pt-5">
                <div className="mb-3 flex items-baseline justify-between gap-4">
                  <p className="text-sm font-bold tabular-nums text-[var(--ink)]" aria-live="polite">{wordCount} / {WORD_TARGET} words</p>
                  <p className="text-xs font-semibold text-[var(--muted)]">{wordCount >= WORD_TARGET ? "Goal reached — keep writing" : `${WORD_TARGET - wordCount} to go`}</p>
                </div>
                <progress className="writing-progress block" max={WORD_TARGET} value={progress} aria-label={`${progress} of ${WORD_TARGET} word goal`} />
              </div>
            </section>
          </div>

          {hasCompleted && (
            <section className={`${isCelebrating ? "completion-card" : ""} relative mb-4 overflow-hidden rounded-[1.6rem] bg-[var(--ink)] px-5 py-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-8 sm:py-7`} aria-labelledby="completion-title">
              <div className="flex items-start gap-4">
                <span className={`${isCelebrating ? "completion-mark" : ""} grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xl font-bold`} aria-hidden="true">✓</span>
                <div>
                  <h2 id="completion-title" className="font-serif text-3xl leading-none tracking-[-0.03em]">Today is complete.</h2>
                  <p className="mt-2 text-sm leading-6 text-white/65">You showed up. Keep writing, or leave the rest for tomorrow.</p>
                </div>
              </div>
              <div className="mt-5 sm:mt-0 sm:text-right">
                <button type="button" onClick={() => signedIn ? setAccountOpen(true) : setAuthOpen(true)} className="w-full rounded-full bg-[var(--paper)] px-5 py-3 text-sm font-bold text-[var(--ink)] outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--ink)] sm:w-auto">
                  {signedIn ? "Saved to your year" : "Save your entry and begin your year"}
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => setAuthOpen(false)} />
      {timezoneRequired && session && <TimezonePanel detectedTimezone={detectedTimezone} onSave={confirmTimezone} onSignOut={signOut} />}
      {profile && session && (
        <AccountPanel key={profile.timezone} email={session.user.email ?? "Your account"} open={accountOpen} timezone={profile.timezone} onClose={() => setAccountOpen(false)} onDelete={deleteAccount} onSaveTimezone={updateTimezone} onSignOut={signOut} />
      )}
      <ConflictPanel conflict={conflicts[0] ?? null} isWorking={conflictWorking} onKeepCloud={() => void keepCloudVersion()} onKeepLocal={() => void keepLocalVersion()} />
    </>
  );
}
