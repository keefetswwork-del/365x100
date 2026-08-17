"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { AccountPanel } from "@/components/account-panel";
import { AuthPanel } from "@/components/auth-panel";
import { BrandWordmark } from "@/components/brand-wordmark";
import { ConflictPanel } from "@/components/conflict-panel";
import { HabitDashboard } from "@/components/habit-dashboard";
import { HabitOnboarding } from "@/components/habit-onboarding";
import { LegalConsentPanel } from "@/components/legal-consent-panel";
import { ProductStoryPanel } from "@/components/product-story-panel";
import { RichJournalEditor } from "@/components/rich-journal-editor";
import { TimezonePanel } from "@/components/timezone-panel";
import {
  acceptCurrentLegalDocuments,
  clearPendingLegalConsent,
  fetchLegalAcceptanceStatus,
  hasPendingLegalConsent,
  recordOperationalEvent,
} from "@/lib/beta-operations";
import {
  cacheFromCloudEntry,
  loadCloudCache,
  removeUserCloudCaches,
  saveCloudCache,
} from "@/lib/cloud-cache";
import {
  fetchAllCloudEntries,
  fetchCloudEntriesByDates,
  fetchCloudEntry,
  fetchProfile,
  mapProfileRow,
  saveCloudEntry,
  saveProfileTimezone,
} from "@/lib/cloud-entry";
import type { Database } from "@/lib/database.types";
import {
  buildPortableArchive,
  downloadTextFile,
  serializePlainTextEntries,
} from "@/lib/entry-export";
import {
  migrateAnonymousEntries,
  reconcileDirtyCaches,
} from "@/lib/draft-migration";
import {
  loadEntry,
  loadRichEntry,
  removeEntry,
  saveEntry,
  saveRichEntry,
} from "@/lib/entry-storage";
import { getLocalDateString } from "@/lib/local-date";
import { fetchEntryHistory } from "@/lib/history";
import {
  fetchDailyPrompt,
  fetchHabitSummary,
  formatStreakLabel,
  markWelcomeBack,
  missedDayMessage,
  monthStart,
  saveHabitPreferences,
  shiftDate,
  shiftMonth,
} from "@/lib/habit";
import {
  consumeSignupStarted,
  markSignupStarted,
  recordProductEvent,
} from "@/lib/product-analytics";
import { CloudSaveQueue } from "@/lib/save-queue";
import { getSupabaseClient } from "@/lib/supabase";
import {
  formatDateInTimeZone,
  getBrowserTimeZone,
  getDateInTimeZone,
} from "@/lib/timezone";
import { countWords } from "@/lib/word-count";
import { fetchWritingYearSummary } from "@/lib/writing-year";
import {
  plainTextFromRichDocument,
  richDocumentsEqual,
  type RichEntryDocument,
} from "@/lib/rich-text";
import type {
  WritingYearSummary,
} from "@/types/beta";
import type {
  CloudSaveStatus,
  MigrationConflict,
  Profile,
} from "@/types/cloud";
import type { DailyPrompt, HabitPreferences, HabitSummary } from "@/types/habit";
import type {
  HistoryFilters,
  HistoryPage,
  JournalLibraryView,
} from "@/types/history";

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

function formatEntryDate(entryDate: string, compact = false): string {
  if (!entryDate) return "Today";
  const [year, month, day] = entryDate.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: compact ? "short" : "long",
    timeZone: "UTC",
    weekday: compact ? "short" : "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return label;
}

function preferencesFromProfile(profile: Profile): HabitPreferences {
  return {
    dailyPromptsEnabled: profile.dailyPromptsEnabled,
    onboardingCompleted: profile.habitOnboardingCompleted,
    weeklyReview: {
      day: profile.weeklyReviewDay,
      enabled: profile.weeklyReviewEnabled,
      time: profile.weeklyReviewTime,
    },
  };
}

export function JournalEditor() {
  const [entry, setEntry] = useState("");
  const [richEntry, setRichEntry] = useState<RichEntryDocument | null>(null);
  const [editorLoadKey, setEditorLoadKey] = useState(0);
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
  const [habitOpen, setHabitOpen] = useState(false);
  const [habitInitialView, setHabitInitialView] = useState<JournalLibraryView>("calendar");
  const [habitLoading, setHabitLoading] = useState(false);
  const [habitSummary, setHabitSummary] = useState<HabitSummary | null>(null);
  const [writingYearSummary, setWritingYearSummary] = useState<WritingYearSummary | null>(null);
  const [todayDate, setTodayDate] = useState("");
  const [dailyPrompt, setDailyPrompt] = useState<DailyPrompt | null>(null);
  const [promptWorking, setPromptWorking] = useState(false);
  const [pastEntryUnavailable, setPastEntryUnavailable] = useState(false);
  const [dateNavigationWorking, setDateNavigationWorking] = useState(false);
  const [welcomeBackVisible, setWelcomeBackVisible] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [legalAcceptanceRequired, setLegalAcceptanceRequired] = useState(false);
  const [legalAcceptanceError, setLegalAcceptanceError] = useState("");

  const entryRef = useRef(entry);
  const richEntryRef = useRef<RichEntryDocument | null>(richEntry);
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
  const habitMonthRef = useRef("");
  const habitSummaryRef = useRef<HabitSummary | null>(null);
  const todayDateRef = useRef("");
  const analyticsStartedRef = useRef(false);
  const dateNavigationWorkingRef = useRef(false);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const editorSectionRef = useRef<HTMLElement>(null);
  const focusEditorAfterLoadRef = useRef(false);
  const pastEntryUnavailableRef = useRef(false);
  const intentionalSignOutRef = useRef(false);

  const wordCount = countWords(entry);
  const progress = Math.min(wordCount, WORD_TARGET);

  function restoreEditorDocument(
    content: string,
    richContent: RichEntryDocument | null,
  ) {
    entryRef.current = content;
    richEntryRef.current = richContent;
    setEntry(content);
    setRichEntry(richContent);
    setEditorLoadKey((value) => value + 1);
  }

  function setConflictList(next: MigrationConflict[]) {
    conflictsRef.current = next;
    setConflicts(next);
    if (next.length > 0) {
      setSaveStatus("conflict");
    }
  }

  async function refreshHabitDashboard(month = habitMonthRef.current) {
    const activeClient = client ?? getSupabaseClient();
    const activeProfile = profileRef.current;
    if (!activeClient || !activeProfile) return;
    const requestedMonth = month || monthStart(todayDateRef.current || getDateInTimeZone(new Date(), activeProfile.timezone));
    habitMonthRef.current = requestedMonth;
    setHabitLoading(true);
    try {
      const summary = await fetchHabitSummary(activeClient, requestedMonth);
      habitSummaryRef.current = summary;
      todayDateRef.current = summary.today;
      setTodayDate(summary.today);
      setHabitSummary(summary);
      try {
        setWritingYearSummary(await fetchWritingYearSummary(activeClient));
      } catch {
        setWritingYearSummary(null);
        void recordOperationalEvent(activeClient, "writing-year", "writing-year-load-failed");
      }
      if (summary.firstEntryDate && summary.firstEntryDate < summary.today) {
        void recordProductEvent(activeClient, "returned_next_day", summary.today);
      }
      if (summary.totalCompletedDays >= 7) {
        void recordProductEvent(activeClient, "seven_days_completed", summary.today);
      }
    } catch {
      setHabitSummary(null);
    } finally {
      setHabitLoading(false);
    }
  }

  async function loadPromptForDate(
    activeClient: Client,
    entryDate: string,
    refresh = false,
  ) {
    setPromptWorking(refresh);
    try {
      setDailyPrompt(await fetchDailyPrompt(activeClient, entryDate, refresh));
    } catch {
      if (!refresh) setDailyPrompt(null);
    } finally {
      setPromptWorking(false);
    }
  }

  function restoreAnonymousDate(date = new Date()) {
    const today = getLocalDateString(date);
    const restoredEntry = loadEntry(today);
    const storedRichEntry = loadRichEntry(today);
    const restoredRichEntry =
      storedRichEntry && plainTextFromRichDocument(storedRichEntry) === restoredEntry
        ? storedRichEntry
        : null;
    const restoredWordCount = countWords(restoredEntry);

    entryRef.current = restoredEntry;
    richEntryRef.current = restoredRichEntry;
    localDateRef.current = today;
    todayDateRef.current = today;
    previousWordCountRef.current = restoredWordCount;
    versionRef.current = 0;
    hasEditedRef.current = false;
    analyticsStartedRef.current = false;
    startTransition(() => {
      setEntry(restoredEntry);
      setRichEntry(restoredRichEntry);
      setEditorLoadKey((value) => value + 1);
      setLocalDate(today);
      setTodayDate(today);
      setDateLabel(formatEntryDate(today));
      setDailyPrompt(null);
      pastEntryUnavailableRef.current = false;
      setPastEntryUnavailable(false);
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
                localRichContent: input.richContent,
                remote: result.remote,
              },
            ]),
          );
        },
        onError() {
          setSaveStatus(navigator.onLine ? "error" : "offline");
          void recordOperationalEvent(activeClient, "entry-save", "save-retry-exhausted");
        },
        onRetry() {
          setSaveStatus(navigator.onLine ? "retrying" : "offline");
        },
        onSaved(result) {
          const saved = result.entry;
          const isCurrent = saved.entryDate === localDateRef.current;
          const currentContent = entryRef.current;
          const currentRichContent = richEntryRef.current;

          if (isCurrent) {
            versionRef.current = saved.version;
          }

          if (
            isCurrent &&
            (currentContent !== saved.content ||
              !richDocumentsEqual(currentRichContent, saved.richContent))
          ) {
            saveCloudCache(userId, {
              content: currentContent,
              dirty: true,
              entryDate: saved.entryDate,
              richContent: currentRichContent,
              updatedAt: new Date().toISOString(),
              version: saved.version,
              wordCount: countWords(currentContent),
            });
            setSaveStatus("saving-cloud");
            return;
          }

          saveCloudCache(userId, cacheFromCloudEntry(saved));
          setSaveStatus("saved-cloud");
          void refreshHabitDashboard();
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
    pastEntryUnavailableRef.current = false;
    setPastEntryUnavailable(false);
    setWelcomeBackVisible(false);
    setDailyPrompt(null);
    analyticsStartedRef.current = false;
    localDateRef.current = entryDate;
    setLocalDate(entryDate);
    setDateLabel(formatEntryDate(entryDate));
    const conflict = knownConflicts.find((item) => item.entryDate === entryDate);
    if (conflict) {
      const restoredCount = countWords(conflict.localContent);
      richEntryRef.current = conflict.localRichContent;
      versionRef.current = conflict.remote.version;
      previousWordCountRef.current = restoredCount;
      restoreEditorDocument(conflict.localContent, conflict.localRichContent);
      setHasCompleted(restoredCount >= WORD_TARGET);
      setSaveStatus("conflict");
      setIsReady(true);
      void loadPromptForDate(activeClient, entryDate);
      return;
    }

    const cache = loadCloudCache(activeSession.user.id, entryDate);
    if (!navigator.onLine) {
      if (!cache && entryDate !== todayDateRef.current) {
        pastEntryUnavailableRef.current = true;
        setPastEntryUnavailable(true);
        setSaveStatus("offline");
        return;
      }
      const restored = cache?.content ?? "";
      const restoredRich = cache?.richContent ?? null;
      const restoredCount = countWords(restored);
      richEntryRef.current = restoredRich;
      versionRef.current = cache?.version ?? 0;
      previousWordCountRef.current = restoredCount;
      hasEditedRef.current = false;
      restoreEditorDocument(restored, restoredRich);
      setHasCompleted(restoredCount >= WORD_TARGET);
      setSaveStatus("offline");
      setIsReady(true);
      return;
    }
    try {
      const remote = await fetchCloudEntry(activeClient, entryDate);
      const restored = remote?.content ?? cache?.content ?? "";
      const restoredRich = remote?.richContent ?? cache?.richContent ?? null;
      const restoredCount = countWords(restored);
      versionRef.current = remote?.version ?? cache?.version ?? 0;
      richEntryRef.current = restoredRich;
      previousWordCountRef.current = restoredCount;
      hasEditedRef.current = false;

      if (remote) {
        saveCloudCache(activeSession.user.id, cacheFromCloudEntry(remote));
      }

      startTransition(() => {
        restoreEditorDocument(restored, restoredRich);
        setHasCompleted(restoredCount >= WORD_TARGET);
        setSaveStatus("saved-cloud");
        setIsReady(true);
      });
      void loadPromptForDate(activeClient, entryDate);
    } catch {
      void recordOperationalEvent(activeClient, "entry-load", "entry-load-failed");
      if (!cache && entryDate !== todayDateRef.current) {
        pastEntryUnavailableRef.current = true;
        setPastEntryUnavailable(true);
        setSaveStatus(navigator.onLine ? "error" : "offline");
        return;
      }
      const restored = cache?.content ?? "";
      const restoredRich = cache?.richContent ?? null;
      richEntryRef.current = restoredRich;
      versionRef.current = cache?.version ?? 0;
      previousWordCountRef.current = countWords(restored);
      restoreEditorDocument(restored, restoredRich);
      setHasCompleted(previousWordCountRef.current >= WORD_TARGET);
      setSaveStatus(navigator.onLine ? "error" : "offline");
      setIsReady(true);
      void loadPromptForDate(activeClient, entryDate);
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

    let migrated: MigrationConflict[];
    let dirty: MigrationConflict[];
    try {
      migrated = await migrateAnonymousEntries(activeClient, activeSession.user.id);
      dirty = await reconcileDirtyCaches(activeClient, activeSession.user.id);
    } catch (error) {
      void recordOperationalEvent(activeClient, "migration", "migration-failed");
      throw error;
    }
    const nextConflicts = mergeConflicts(conflictsRef.current, [...migrated, ...dirty]);
    setConflictList(nextConflicts);

    const now = new Date();
    const today = getDateInTimeZone(now, activeProfile.timezone);
    todayDateRef.current = today;
    setTodayDate(today);
    const currentMonth = monthStart(today);
    habitMonthRef.current = currentMonth;
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
    void refreshHabitDashboard(currentMonth);
  }

  const bootstrapCloudFromEffect = useEffectEvent(bootstrapCloud);
  const loadSignedInDateFromEffect = useEffectEvent(loadSignedInDate);
  const refreshHabitFromEffect = useEffectEvent(refreshHabitDashboard);

  function persistCurrentImmediately() {
    const currentDate = localDateRef.current;
    if (!currentDate || pastEntryUnavailableRef.current) {
      return;
    }

    const currentSession = sessionRef.current;
    const currentProfile = profileRef.current;
    if (currentSession && currentProfile && cloudReadyRef.current) {
      const content = entryRef.current;
      const richContent = richEntryRef.current;
      const currentWordCount = countWords(content);
      saveCloudCache(currentSession.user.id, {
        content,
        dirty: true,
        entryDate: currentDate,
        richContent,
        updatedAt: new Date().toISOString(),
        version: versionRef.current,
        wordCount: currentWordCount,
      });
      queueRef.current?.enqueue({
        content,
        entryDate: currentDate,
        expectedVersion: versionRef.current,
        richContent,
        wordCount: currentWordCount,
      });
      return;
    }

    saveEntry(currentDate, entryRef.current);
    saveRichEntry(currentDate, richEntryRef.current);
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
      if (data.session && consumeSignupStarted()) {
        void recordProductEvent(activeClient, "signup_completed", getLocalDateString());
      }
      setAuthResolved(true);
    });

    const { data: listener } = activeClient.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) {
        return;
      }
      const previousSession = sessionRef.current;
      if (event === "SIGNED_OUT" && previousSession && !intentionalSignOutRef.current) {
        const currentDate = localDateRef.current;
        if (currentDate) {
          saveEntry(currentDate, entryRef.current);
          saveRichEntry(currentDate, richEntryRef.current);
        }
        void recordOperationalEvent(activeClient, "auth", "session-expired");
      }
      sessionRef.current = nextSession;
      setSession(nextSession);
      if (nextSession && consumeSignupStarted()) {
        void recordProductEvent(activeClient, "signup_completed", getLocalDateString());
      }
      setAuthResolved(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      queueRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    function updateOnlineState() {
      setOnline(navigator.onLine);
    }
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
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
        setHabitSummary(null);
        setWritingYearSummary(null);
        setHabitOpen(false);
        setDailyPrompt(null);
        setWelcomeBackVisible(false);
        setConflictList([]);
        setLegalAcceptanceRequired(false);
        setLegalAcceptanceError("");
        restoreAnonymousDate();
      });
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        let legalStatus = await fetchLegalAcceptanceStatus(client);
        if (!legalStatus.accepted && hasPendingLegalConsent()) {
          legalStatus = await acceptCurrentLegalDocuments(client);
          if (legalStatus.accepted) clearPendingLegalConsent();
        }
        if (cancelled) return;
        if (!legalStatus.accepted) {
          setLegalAcceptanceRequired(true);
          setLegalAcceptanceError("");
          setSaveStatus("saved-local");
          return;
        }
        setLegalAcceptanceRequired(false);
        setLegalAcceptanceError("");
      } catch {
        if (cancelled) return;
        setLegalAcceptanceRequired(true);
        setLegalAcceptanceError("Acceptance could not be checked. Your draft remains on this device; please try again.");
        setSaveStatus(navigator.onLine ? "error" : "offline");
        return;
      }

      try {
        const existingProfile = await fetchProfile(client);
        if (cancelled) return;
        if (!existingProfile) {
          setTimezoneRequired(true);
          setSaveStatus("saved-local");
          return;
        }
        await bootstrapCloudFromEffect(client, session, existingProfile);
      } catch {
        if (!cancelled) {
          void recordOperationalEvent(client, "profile", "profile-load-failed");
          setSaveStatus(navigator.onLine ? "error" : "offline");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // bootstrapRetry intentionally re-runs failed cloud initialization.
  }, [authResolved, bootstrapRetry, client, session]);

  useEffect(() => {
    entryRef.current = entry;
    richEntryRef.current = richEntry;

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
          richContent: richEntryRef.current,
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
            richContent: richEntryRef.current,
            wordCount: currentWordCount,
          });
        }
      } else {
        saveEntry(localDate, entryRef.current);
        saveRichEntry(localDate, richEntryRef.current);
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
  }, [entry, isReady, localDate, richEntry]);

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
            richContent: dirtyCache.richContent,
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

      const previousToday = todayDateRef.current;
      if (!previousToday || nextDate === previousToday) {
        return;
      }

      todayDateRef.current = nextDate;
      setTodayDate(nextDate);
      const nextMonth = monthStart(nextDate);
      habitMonthRef.current = nextMonth;

      if (activeProfile && activeSession && client && cloudReadyRef.current) {
        if (localDateRef.current === previousToday) {
          persistCurrentImmediately();
          hasEditedRef.current = false;
          await loadSignedInDateFromEffect(client, activeSession, activeProfile, nextDate);
        }
        await refreshHabitFromEffect(nextMonth);
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

  function handleEntryChange(
    nextEntry: string,
    nextRichEntry: RichEntryDocument,
  ) {
    const nextWordCount = countWords(nextEntry);

    if (!analyticsStartedRef.current) {
      analyticsStartedRef.current = true;
      void recordProductEvent(client, "editor_started", localDateRef.current);
    }
    if (previousWordCountRef.current < 25 && nextWordCount >= 25) {
      void recordProductEvent(client, "twenty_five_words_reached", localDateRef.current);
    }

    if (
      previousWordCountRef.current < WORD_TARGET &&
      nextWordCount >= WORD_TARGET
    ) {
      setIsCelebrating(true);
      window.setTimeout(() => setIsCelebrating(false), 1000);
      void recordProductEvent(client, "hundred_words_reached", localDateRef.current);
    }

    const summary = habitSummaryRef.current;
    if (
      client && sessionRef.current && summary && localDateRef.current === todayDateRef.current &&
      summary.missedDays >= 3 && summary.lastWelcomeBackDate !== summary.today
    ) {
      setWelcomeBackVisible(true);
      const updated = { ...summary, lastWelcomeBackDate: summary.today };
      habitSummaryRef.current = updated;
      setHabitSummary(updated);
      void markWelcomeBack(client, summary.today);
    }

    previousWordCountRef.current = nextWordCount;
    entryRef.current = nextEntry;
    richEntryRef.current = nextRichEntry;
    hasEditedRef.current = true;
    setEntry(nextEntry);
    setRichEntry(nextRichEntry);
    setHasCompleted(nextWordCount >= WORD_TARGET);
  }

  async function confirmTimezone(timezone: string) {
    if (!client || !session) {
      throw new Error("Authentication required");
    }
    const savedProfile = await saveProfileTimezone(client, timezone);
    await bootstrapCloud(client, session, savedProfile);
  }

  async function completeLegalAcceptance() {
    if (!client || !session) throw new Error("Authentication required");
    try {
      const status = await acceptCurrentLegalDocuments(client);
      if (!status.accepted) throw new Error("Acceptance is incomplete");
      clearPendingLegalConsent();
      setLegalAcceptanceError("");
      setLegalAcceptanceRequired(false);
      setBootstrapRetry((value) => value + 1);
    } catch {
      setLegalAcceptanceError("Acceptance could not be recorded. Your writing is still safe on this device.");
      throw new Error("Legal acceptance failed");
    }
  }

  function openAuthPanel() {
    markSignupStarted();
    void recordProductEvent(client, "signup_started", localDateRef.current);
    setAuthOpen(true);
  }

  function openHabitDashboard(view: JournalLibraryView = "calendar") {
    setHabitInitialView(view);
    const visibleDate = localDateRef.current || todayDateRef.current;
    if (visibleDate) {
      const selectedMonth = monthStart(visibleDate);
      habitMonthRef.current = selectedMonth;
      if (habitSummaryRef.current?.visibleMonth !== selectedMonth) {
        void refreshHabitDashboard(selectedMonth);
      }
    } else if (!habitSummaryRef.current) {
      void refreshHabitDashboard();
    }
    setHabitOpen(true);
  }

  function closeHabitDashboard() {
    setHabitOpen(false);
    window.requestAnimationFrame(() => dateTriggerRef.current?.focus());
  }

  async function changeHabitMonth(offset: number) {
    const nextMonth = shiftMonth(habitMonthRef.current, offset);
    await refreshHabitDashboard(nextMonth);
  }

  function focusEntryEditor() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const editable = editorSectionRef.current?.querySelector<HTMLElement>('[contenteditable="true"]');
        (editable ?? editorSectionRef.current)?.focus();
      });
    });
  }

  async function loadHistory(
    filters: HistoryFilters,
    beforeDate: string | null = null,
  ): Promise<HistoryPage> {
    if (!client || !session || !navigator.onLine) {
      throw new Error("History requires a connection.");
    }
    return fetchEntryHistory(client, filters, beforeDate);
  }

  async function flushBeforeExport() {
    if (!client || !session || !profile || !navigator.onLine) {
      throw new Error("Export requires a connection.");
    }
    if (conflictsRef.current.length > 0) {
      throw new Error("Review versions before exporting.");
    }
    persistCurrentImmediately();
    await queueRef.current?.whenIdle();
  }

  async function exportEntries(entryDates?: string[]) {
    if (!client) throw new Error("Authentication required.");
    try {
      await flushBeforeExport();
      const entries = entryDates
        ? await fetchCloudEntriesByDates(client, entryDates)
        : await fetchAllCloudEntries(client);
      if (entryDates && entries.length !== new Set(entryDates).size) {
        throw new Error("Not every selected entry could be loaded.");
      }
      const today = todayDateRef.current || getLocalDateString();
      downloadTextFile(
        `365x100-journal-${today}.txt`,
        serializePlainTextEntries(entries),
        "text/plain",
      );
    } catch (error) {
      void recordOperationalEvent(client, "export", "export-failed");
      throw error;
    }
  }

  async function downloadPortableData() {
    if (!client || !session || !profile) throw new Error("Authentication required.");
    try {
      await flushBeforeExport();
      const archive = await buildPortableArchive(client, {
        email: session.user.email ?? "",
        entries: await fetchAllCloudEntries(client),
        preferences: preferencesFromProfile(profile),
        profile,
      });
      const today = todayDateRef.current || getLocalDateString();
      downloadTextFile(
        `365x100-data-${today}.json`,
        JSON.stringify(archive, null, 2),
        "application/json",
      );
    } catch (error) {
      void recordOperationalEvent(client, "export", "export-failed");
      throw error;
    }
  }

  useEffect(() => {
    if (!isReady || !focusEditorAfterLoadRef.current) return;
    focusEditorAfterLoadRef.current = false;
    focusEntryEditor();
  }, [editorLoadKey, isReady]);

  async function navigateToEntryDate(entryDate: string) {
    if (
      !client ||
      !session ||
      !profile ||
      dateNavigationWorkingRef.current ||
      entryDate > todayDateRef.current
    ) return;

    setHabitOpen(false);
    if (entryDate === localDateRef.current) {
      focusEntryEditor();
      return;
    }

    dateNavigationWorkingRef.current = true;
    setDateNavigationWorking(true);
    persistCurrentImmediately();
    hasEditedRef.current = false;
    focusEditorAfterLoadRef.current = true;
    try {
      await loadSignedInDate(client, session, profile, entryDate);
    } finally {
      dateNavigationWorkingRef.current = false;
      setDateNavigationWorking(false);
    }
  }

  async function selectEntryDate(entryDate: string) {
    await navigateToEntryDate(entryDate);
  }

  async function returnToToday() {
    if (localDateRef.current === todayDateRef.current) return;
    await navigateToEntryDate(todayDateRef.current);
  }

  async function navigateByDay(offset: number) {
    const targetDate = shiftDate(localDateRef.current, offset);
    await navigateToEntryDate(targetDate);
  }

  async function updateHabitPreferences(preferences: HabitPreferences) {
    if (!client || !session) throw new Error("Authentication required");
    const row = await saveHabitPreferences(client, preferences);
    const savedProfile = mapProfileRow(row);
    profileRef.current = savedProfile;
    setProfile(savedProfile);
    if (savedProfile.dailyPromptsEnabled || dailyPrompt) {
      await loadPromptForDate(client, localDateRef.current);
    }
  }

  async function refreshPrompt() {
    if (!client || localDateRef.current !== todayDateRef.current) return;
    await loadPromptForDate(client, localDateRef.current, true);
  }

  async function signOut() {
    if (!client) {
      return;
    }
    persistCurrentImmediately();
    intentionalSignOutRef.current = true;
    try {
      await client.auth.signOut();
      setAuthOpen(false);
      setAccountOpen(false);
    } finally {
      intentionalSignOutRef.current = false;
    }
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
    intentionalSignOutRef.current = true;
    try {
      await client.auth.signOut({ scope: "local" });
    } finally {
      intentionalSignOutRef.current = false;
    }
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
      versionRef.current = conflict.remote.version;
      previousWordCountRef.current = conflict.remote.wordCount;
      restoreEditorDocument(conflict.remote.content, conflict.remote.richContent);
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
        richContent: conflict.localRichContent,
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
    error: "Save failed — your latest draft remains on this device",
    offline: "Offline — saved on this device",
    restoring: "Restoring…",
    retrying: "Retrying cloud save…",
    "saved-cloud": "Saved to cloud",
    "saved-local": "Saved on this device",
    "saving-cloud": "Saving to cloud…",
    "saving-local": "Saving locally…",
  };

  const signedIn = Boolean(session);
  const isToday = !todayDate || localDate === todayDate;
  const compactDateLabel = formatEntryDate(localDate, true);
  const canNavigatePrevious = Boolean(
    habitSummary?.firstEntryDate && localDate > habitSummary.firstEntryDate,
  );
  const canNavigateNext = Boolean(todayDate && localDate < todayDate);
  const promptHeading = dailyPrompt?.body ?? (isToday ? "What happened today?" : "What happened on this day?");
  const gapMessage = isToday && habitSummary ? missedDayMessage(habitSummary.missedDays) : null;
  const habitPreferences = profile ? preferencesFromProfile(profile) : null;
  const exportBlockedReason = !online
    ? "Reconnect to create a complete export."
    : conflicts.length > 0
      ? "Review versions before exporting."
      : saveStatus === "error"
        ? "Resolve the cloud save before exporting."
        : null;

  return (
    <>
      <main className={`journal-shell relative min-h-screen overflow-hidden px-4 py-5 sm:px-8 sm:py-8 lg:px-12 ${signedIn ? "pb-24 sm:pb-8" : ""}`}>
        <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col sm:min-h-[calc(100vh-4rem)]">
          <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <a href="#editor" className="shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--paper)]">
                <BrandWordmark className="text-2xl" />
              </a>
              <span className="rounded-full border border-[var(--line)] px-2 py-1 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)] sm:text-[0.62rem]" aria-label="Private Beta">Private Beta</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-5">
              <button type="button" onClick={() => setAboutOpen(true)} className="rounded-full px-1 py-2 text-[0.65rem] font-bold text-[var(--muted)] outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:px-2 sm:text-xs"><span className="sm:hidden">About</span><span className="hidden sm:inline">About 365x100</span></button>
              <p className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] sm:text-xs sm:tracking-[0.16em]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${saveStatus === "error" || saveStatus === "conflict" ? "bg-red-700" : saveStatus.startsWith("saving") || saveStatus === "retrying" ? "bg-[var(--accent)]" : "bg-[var(--sage)]"}`} aria-hidden="true" />
                <span aria-live="polite">{statusLabel[saveStatus]}</span>
              </p>
              <button
                type="button"
                disabled={!authResolved}
                onClick={() => signedIn ? setAccountOpen(true) : openAuthPanel()}
                className="rounded-full border border-[var(--line)] bg-white/40 px-3 py-2 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50 sm:px-4 sm:text-sm"
              >
                {signedIn ? "Account" : "Sign in"}
              </button>
            </div>
          </header>

          <section aria-label={signedIn ? "Entry date navigation" : "Entry date"} className="flex flex-col items-center pt-7 text-center sm:pt-9">
            {signedIn && (
              <p className="min-h-5 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]" aria-live="polite">
                {habitSummary ? formatStreakLabel(habitSummary.currentStreak) : "Loading your streak…"}
              </p>
            )}
            <div className={`${signedIn ? "mt-2" : ""} grid grid-cols-[2.75rem_minmax(0,auto)_2.75rem] items-center gap-1 sm:gap-3`}>
              {signedIn ? (
                <button type="button" aria-label="Previous day" disabled={!canNavigatePrevious || dateNavigationWorking} onClick={() => void navigateByDay(-1)} className="grid h-11 w-11 place-items-center rounded-full text-2xl text-[var(--ink)] outline-none transition hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-25">←</button>
              ) : <span aria-hidden="true" />}
              {signedIn ? (
                <button ref={dateTriggerRef} type="button" disabled={!profile || dateNavigationWorking} onClick={() => openHabitDashboard("calendar")} aria-label={`Open calendar for ${dateLabel}`} className="group flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-bold uppercase tracking-[0.12em] text-[var(--accent-dark)] outline-none transition hover:bg-white/50 focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50 sm:px-5 sm:tracking-[0.17em]">
                  <time dateTime={localDate || undefined}><span className="sm:hidden">{compactDateLabel}</span><span className="hidden sm:inline">{dateLabel}</span></time>
                  <span aria-hidden="true" className="text-base transition-transform group-hover:translate-y-0.5">▾</span>
                </button>
              ) : (
                <time dateTime={localDate || undefined} className="min-h-11 content-center px-3 text-sm font-bold uppercase tracking-[0.12em] text-[var(--accent-dark)] sm:px-5 sm:tracking-[0.17em]"><span className="sm:hidden">{compactDateLabel}</span><span className="hidden sm:inline">{dateLabel}</span></time>
              )}
              {signedIn ? (
                <button type="button" aria-label="Next day" disabled={!canNavigateNext || dateNavigationWorking} onClick={() => void navigateByDay(1)} className="grid h-11 w-11 place-items-center rounded-full text-2xl text-[var(--ink)] outline-none transition hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-25">→</button>
              ) : <span aria-hidden="true" />}
            </div>
            {!isToday && (
              <div className="mt-2 flex items-center gap-3 text-xs font-bold">
                <span className="uppercase tracking-[0.14em] text-[var(--muted)]">Past entry</span>
                <button type="button" disabled={dateNavigationWorking} onClick={() => void returnToToday()} className="rounded-full border border-[var(--line)] bg-white/40 px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50">Return to today</button>
              </div>
            )}
          </section>

          <div className="grid flex-1 gap-7 py-7 md:gap-10 md:py-10 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] lg:gap-16 lg:py-12">
            <section className="min-w-0 flex flex-col justify-between gap-6 lg:py-3">
              <div>
                <h1 className="max-w-xl break-words font-serif text-[clamp(2.7rem,8vw,5.5rem)] leading-[0.91] font-medium tracking-[-0.055em] text-balance text-[var(--ink)] lg:max-w-full lg:text-[4.25rem]">{promptHeading}</h1>
                {dailyPrompt && isToday && profile?.dailyPromptsEnabled && (
                  <button type="button" disabled={promptWorking} onClick={() => void refreshPrompt()} className="mt-4 rounded-full border border-[var(--line)] bg-white/40 px-4 py-2 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50">{promptWorking ? "Finding another…" : "Try another prompt"}</button>
                )}
                <p className="mt-5 max-w-md text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
                  {signedIn ? "Your words save here first, then safely sync to your account." : "One honest detail is enough to begin. This draft stays private in this browser."}
                </p>
                {gapMessage && !welcomeBackVisible && <p className="mt-5 max-w-md rounded-2xl border border-[var(--sage)]/45 bg-white/45 p-4 text-sm leading-6 text-[var(--ink)]">{gapMessage}</p>}
                {welcomeBackVisible && <p className="mt-5 max-w-md rounded-2xl bg-[var(--sage)]/35 p-4 text-sm font-semibold leading-6 text-[var(--ink)]" role="status">Welcome back. Today counts because you returned, not because the gap disappeared.</p>}
              </div>
              <p className="hidden max-w-xs border-l-2 border-[var(--sage)] pl-4 text-sm leading-6 text-[var(--muted)] lg:block">Write past one hundred if the day has more to say.</p>
            </section>

            <section ref={editorSectionRef} tabIndex={-1} id="editor" className="flex min-h-[31rem] min-w-0 w-full flex-col rounded-[1.6rem] border border-white/70 bg-white/65 p-4 shadow-[0_24px_80px_rgba(40,55,48,0.11)] outline-none backdrop-blur-sm sm:min-h-[37rem] sm:rounded-[2rem] sm:p-6 lg:min-h-0 lg:p-8">
              {pastEntryUnavailable ? (
                <div className="grid flex-1 place-items-center px-6 text-center">
                  <div><p className="font-serif text-3xl">This entry is not available offline.</p><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Reconnect before editing so an unseen cloud version is never replaced.</p><button type="button" onClick={() => void returnToToday()} className="mt-5 rounded-full bg-[var(--ink)] px-5 py-3 font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Return to today</button></div>
                </div>
              ) : (
                <>
                  <RichJournalEditor
                    key={editorLoadKey}
                    describedBy="entry-progress"
                    disabled={!isReady}
                    label={isToday ? "Your entry for today" : `Your entry for ${dateLabel}`}
                    onChange={handleEntryChange}
                    placeholder={isReady ? "Start with a moment you want to remember…" : "Restoring this draft…"}
                    plainContent={entry}
                    richContent={richEntry}
                  />
                  <div id="entry-progress" className="mt-5 border-t border-[var(--line)] pt-5">
                    <div className="mb-3 flex items-baseline justify-between gap-4">
                      <p className="text-sm font-bold tabular-nums text-[var(--ink)]" aria-live="polite">{wordCount} / {WORD_TARGET} words</p>
                      <p className="text-xs font-semibold text-[var(--muted)]">{wordCount >= WORD_TARGET ? "Goal reached — keep writing" : `${WORD_TARGET - wordCount} to go`}</p>
                    </div>
                    <progress className="writing-progress block" max={WORD_TARGET} value={progress} aria-label={`${progress} of ${WORD_TARGET} word goal`} />
                  </div>
                </>
              )}
            </section>
          </div>

          {hasCompleted && (
            <section className={`${isCelebrating ? "completion-card" : ""} relative mb-4 overflow-hidden rounded-[1.6rem] bg-[var(--ink)] px-5 py-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-8 sm:py-7`} aria-labelledby="completion-title">
              <div className="flex items-start gap-4">
                <span className={`${isCelebrating ? "completion-mark" : ""} grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xl font-bold`} aria-hidden="true">✓</span>
                <div>
                  <h2 id="completion-title" className="font-serif text-3xl leading-none tracking-[-0.03em]">{isToday ? "Today is complete." : "This day is complete."}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/65">You showed up. Today’s page is now part of the story your month and year are becoming.</p>
                </div>
              </div>
              <div className="mt-5 sm:mt-0 sm:text-right">
                <button type="button" onClick={() => signedIn ? openHabitDashboard("progress") : openAuthPanel()} className="w-full rounded-full bg-[var(--paper)] px-5 py-3 text-sm font-bold text-[var(--ink)] outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--ink)] sm:w-auto">
                  {signedIn ? "View your progress" : "Save your entry and begin your year"}
                </button>
              </div>
            </section>
          )}
        </div>
        {signedIn && (
          <nav aria-label="Writing navigation" className="fixed inset-x-4 bottom-4 z-40 grid grid-cols-3 rounded-full border border-white/70 bg-[var(--paper)]/95 p-1.5 shadow-xl backdrop-blur sm:hidden">
            <button type="button" onClick={() => void returnToToday()} className={`rounded-full px-3 py-2.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${isToday ? "bg-[var(--ink)] text-white" : ""}`}>Today</button>
            <button type="button" onClick={() => openHabitDashboard("history")} className="rounded-full px-3 py-2.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Library</button>
            <button type="button" onClick={() => setAccountOpen(true)} className="rounded-full px-3 py-2.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">Account</button>
          </nav>
        )}
      </main>

      <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={() => setAuthOpen(false)} />
      <ProductStoryPanel open={aboutOpen} onClose={() => setAboutOpen(false)} />
      {session && <LegalConsentPanel errorMessage={legalAcceptanceError} open={legalAcceptanceRequired} onAccept={completeLegalAcceptance} onSignOut={signOut} />}
      {timezoneRequired && session && !legalAcceptanceRequired && <TimezonePanel detectedTimezone={detectedTimezone} onSave={confirmTimezone} onSignOut={signOut} />}
      {profile && session && !profile.habitOnboardingCompleted && !timezoneRequired && !legalAcceptanceRequired && <HabitOnboarding onSave={updateHabitPreferences} />}
      <HabitDashboard key={`${habitOpen}-${habitInitialView}`} exportBlockedReason={exportBlockedReason} initialView={habitInitialView} loading={habitLoading} onClose={closeHabitDashboard} onExportAll={() => exportEntries()} onExportSelected={exportEntries} onLoadHistory={loadHistory} onNextMonth={() => void changeHabitMonth(1)} onPreviousMonth={() => void changeHabitMonth(-1)} onSelectDate={(date) => void selectEntryDate(date)} open={habitOpen} selectedDate={localDate} summary={habitSummary} writingYearSummary={writingYearSummary} />
      {profile && session && (
        <AccountPanel key={profile.userId} dataDownloadBlockedReason={exportBlockedReason} email={session.user.email ?? "Your account"} habitPreferences={habitPreferences!} open={accountOpen} timezone={profile.timezone} onClose={() => setAccountOpen(false)} onDelete={deleteAccount} onDownloadData={downloadPortableData} onSaveHabitPreferences={updateHabitPreferences} onSaveTimezone={updateTimezone} onSignOut={signOut} />
      )}
      <ConflictPanel conflict={conflicts[0] ?? null} isWorking={conflictWorking} onKeepCloud={() => void keepCloudVersion()} onKeepLocal={() => void keepLocalVersion()} />
    </>
  );
}
