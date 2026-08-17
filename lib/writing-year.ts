import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/database.types";
import type { WritingYearSummary } from "@/types/beta";

type Client = SupabaseClient<Database>;

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredNumber(value: Json | undefined, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Writing-year ${name} is invalid.`);
  }
  return value;
}

function parseCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Writing-year date is invalid.");

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) {
    throw new Error("Writing-year date is invalid.");
  }
  return date;
}

function formatCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function writingYearForDate(anchorDate: string, entryDate: string): {
  dayNumber: number;
  endDate: string;
  startDate: string;
  yearNumber: number;
} {
  const anchor = parseCalendarDate(anchorDate);
  const entry = parseCalendarDate(entryDate);
  const elapsedDays = Math.floor((entry.getTime() - anchor.getTime()) / 86_400_000);
  if (elapsedDays < 0) throw new Error("Entry date cannot precede the writing-year anchor.");

  const yearOffset = Math.floor(elapsedDays / 365);
  const start = new Date(anchor.getTime() + yearOffset * 365 * 86_400_000);
  const end = new Date(start.getTime() + 364 * 86_400_000);

  return {
    dayNumber: (elapsedDays % 365) + 1,
    endDate: formatCalendarDate(end),
    startDate: formatCalendarDate(start),
    yearNumber: yearOffset + 1,
  };
}

export function parseWritingYearSummary(value: Json): WritingYearSummary {
  if (!isRecord(value) || typeof value.hasWritingYear !== "boolean" || typeof value.today !== "string") {
    throw new Error("Writing-year progress is invalid.");
  }

  if (!value.hasWritingYear) {
    return { hasWritingYear: false, today: value.today };
  }

  if (typeof value.startDate !== "string" || typeof value.endDate !== "string") {
    throw new Error("Writing-year dates are invalid.");
  }

  return {
    completedDays: requiredNumber(value.completedDays, "completed days"),
    dayNumber: requiredNumber(value.dayNumber, "day number"),
    endDate: value.endDate,
    hasWritingYear: true,
    startDate: value.startDate,
    today: value.today,
    totalEntries: requiredNumber(value.totalEntries, "entry total"),
    totalWords: requiredNumber(value.totalWords, "word total"),
    yearNumber: requiredNumber(value.yearNumber, "number"),
  };
}

export async function fetchWritingYearSummary(client: Client): Promise<WritingYearSummary> {
  const { data, error } = await client.rpc("get_writing_year_dashboard");
  if (error || !data) throw new Error("Writing-year progress could not be loaded.");
  return parseWritingYearSummary(data);
}

export function writingYearProgressPercent(dayNumber: number): number {
  return Math.min(100, Math.max(0, (dayNumber / 365) * 100));
}
