import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/database.types";
import type {
  CalendarDay,
  CalendarGridDay,
  DailyPrompt,
  HabitPreferences,
  HabitSummary,
} from "@/types/habit";

type Client = SupabaseClient<Database>;

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringOrNull(value: Json | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: Json | undefined): number {
  return typeof value === "number" ? value : 0;
}

function parseCalendar(value: Json | undefined): CalendarDay[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.entryDate !== "string") return [];
    const wordCount = numberValue(item.wordCount);
    return [{
      completed: item.completed === true,
      entryDate: item.entryDate,
      hasWriting: item.hasWriting === true || wordCount > 0,
      wordCount,
    }];
  });
}

export function parseHabitSummary(value: Json): HabitSummary {
  if (!isRecord(value) || typeof value.today !== "string" || typeof value.visibleMonth !== "string") {
    throw new Error("Habit dashboard returned an invalid response.");
  }
  return {
    calendar: parseCalendar(value.calendar),
    currentStreak: numberValue(value.currentStreak),
    daysSinceLastWriting: numberValue(value.daysSinceLastWriting),
    firstEntryDate: stringOrNull(value.firstEntryDate),
    lastSevenWritingDays: numberValue(value.lastSevenWritingDays),
    lastCompletedDate: stringOrNull(value.lastCompletedDate),
    lastWelcomeBackDate: stringOrNull(value.lastWelcomeBackDate),
    longestStreak: numberValue(value.longestStreak),
    missedDays: numberValue(value.missedDays),
    monthlyChapterDaysRemaining: numberValue(value.monthlyChapterDaysRemaining),
    monthlyChapterEligible: value.monthlyChapterEligible === true,
    monthCompletedDays: numberValue(value.monthCompletedDays),
    monthElapsedDays: numberValue(value.monthElapsedDays),
    monthWritingDays: numberValue(value.monthWritingDays),
    monthWords: numberValue(value.monthWords),
    mostRecentWritingDate: stringOrNull(value.mostRecentWritingDate),
    today: value.today,
    totalCompletedDays: numberValue(value.totalCompletedDays),
    totalWritingDays: numberValue(value.totalWritingDays),
    totalWords: numberValue(value.totalWords),
    visibleMonth: value.visibleMonth,
    yearCompletedDays: numberValue(value.yearCompletedDays),
    yearElapsedDays: numberValue(value.yearElapsedDays),
    yearWritingDays: numberValue(value.yearWritingDays),
    yearWords: numberValue(value.yearWords),
  };
}

export async function fetchHabitSummary(client: Client, month: string): Promise<HabitSummary> {
  const { data, error } = await client.rpc("get_habit_dashboard", { p_month: month });
  if (error || !data) throw new Error("Habit progress could not be loaded.");
  return parseHabitSummary(data);
}

export async function fetchDailyPrompt(
  client: Client,
  entryDate: string,
  refresh = false,
): Promise<DailyPrompt | null> {
  const { data, error } = await client.rpc("get_daily_prompt", {
    p_entry_date: entryDate,
    p_refresh: refresh,
  });
  if (error) throw new Error("The writing prompt could not be loaded.");
  if (!data) return null;
  return { body: data.body, category: data.category, id: data.id };
}

export async function saveHabitPreferences(
  client: Client,
  preferences: HabitPreferences,
) {
  const { data, error } = await client.rpc("set_habit_preferences", {
    p_daily_prompts_enabled: preferences.dailyPromptsEnabled,
    p_habit_onboarding_completed: preferences.onboardingCompleted,
    p_weekly_review_day: preferences.weeklyReview.day,
    p_weekly_review_enabled: preferences.weeklyReview.enabled,
    p_weekly_review_time: preferences.weeklyReview.time,
  });
  if (error || !data) throw new Error("Habit preferences could not be saved.");
  return data;
}

export async function markWelcomeBack(client: Client, entryDate: string): Promise<void> {
  const { error } = await client.rpc("mark_welcome_back", { p_entry_date: entryDate });
  if (error) throw new Error("Welcome-back state could not be saved.");
}

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

export function monthStart(date: string): string {
  const { year, month } = parseDate(date);
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
}

export function shiftMonth(month: string, offset: number): string {
  const { year, month: monthNumber } = parseDate(month);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${shifted.getUTCFullYear().toString().padStart(4, "0")}-${(shifted.getUTCMonth() + 1).toString().padStart(2, "0")}-01`;
}

export function shiftDate(date: string, offset: number): string {
  const { year, month, day } = parseDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + offset));
  return `${shifted.getUTCFullYear().toString().padStart(4, "0")}-${(shifted.getUTCMonth() + 1).toString().padStart(2, "0")}-${shifted.getUTCDate().toString().padStart(2, "0")}`;
}

export function formatRhythmLabel(writingDays: number): string {
  return `You wrote on ${writingDays} of the last 7 days`;
}

export function formatMonth(month: string): string {
  const { year, month: monthNumber } = parseDate(month);
  return new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC", year: "numeric" })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function buildCalendarGrid(summary: HabitSummary): CalendarGridDay[] {
  const { year, month } = parseDate(summary.visibleMonth);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const mondayOffset = (firstWeekday + 6) % 7;
  const gridStart = new Date(Date.UTC(year, month - 1, 1 - mondayOffset));
  const entries = new Map(summary.calendar.map((entry) => [entry.entryDate, entry]));

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(gridStart);
    current.setUTCDate(gridStart.getUTCDate() + index);
    const date = `${current.getUTCFullYear().toString().padStart(4, "0")}-${(current.getUTCMonth() + 1).toString().padStart(2, "0")}-${current.getUTCDate().toString().padStart(2, "0")}`;
    const entry = entries.get(date);
    const beforeStart = Boolean(summary.firstEntryDate && date < summary.firstEntryDate);
    const future = date > summary.today;
    let state: CalendarGridDay["state"] = "open";
    if (future) state = "future";
    else if (beforeStart) state = "before-start";
    else if (entry?.completed) state = "goal";
    else if (entry?.hasWriting) state = "written";

    return {
      date,
      dayOfMonth: current.getUTCDate(),
      inVisibleMonth: current.getUTCMonth() === month - 1,
      isToday: date === summary.today,
      state,
      wordCount: entry?.wordCount ?? 0,
    };
  });
}

export function returnMessage(daysSinceWriting: number): string | null {
  if (daysSinceWriting >= 7) return "Welcome back. Your story is still here whenever you’re ready.";
  if (daysSinceWriting >= 3) return "Welcome back. What would you like to remember?";
  return null;
}
