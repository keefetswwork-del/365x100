import { expect, test } from "@playwright/test";

import {
  buildCalendarGrid,
  formatStreakLabel,
  missedDayMessage,
  parseHabitSummary,
  shiftDate,
  shiftMonth,
} from "../../lib/habit";
import type { HabitSummary } from "../../types/habit";

function summary(overrides: Partial<HabitSummary> = {}): HabitSummary {
  return {
    calendar: [],
    currentStreak: 0,
    firstEntryDate: null,
    lastCompletedDate: null,
    lastWelcomeBackDate: null,
    longestStreak: 0,
    missedDays: 0,
    monthCompletedDays: 0,
    monthElapsedDays: 16,
    monthWords: 0,
    today: "2026-08-16",
    totalCompletedDays: 0,
    totalWords: 0,
    visibleMonth: "2026-08-01",
    yearCompletedDays: 0,
    yearElapsedDays: 228,
    yearWords: 0,
    ...overrides,
  };
}

test("builds a Monday-first calendar with writing states", () => {
  const grid = buildCalendarGrid(summary({
    calendar: [
      { completed: true, entryDate: "2026-08-10", wordCount: 100 },
      { completed: false, entryDate: "2026-08-11", wordCount: 42 },
    ],
    firstEntryDate: "2026-08-10",
  }));

  expect(grid).toHaveLength(42);
  expect(grid[0].date).toBe("2026-07-27");
  expect(grid.find((day) => day.date === "2026-08-09")?.state).toBe("before-start");
  expect(grid.find((day) => day.date === "2026-08-10")?.state).toBe("complete");
  expect(grid.find((day) => day.date === "2026-08-11")?.state).toBe("started");
  expect(grid.find((day) => day.date === "2026-08-12")?.state).toBe("missed");
  expect(grid.find((day) => day.date === "2026-08-17")?.state).toBe("future");
});
test("handles leap-year and year-boundary month navigation", () => {
  expect(shiftMonth("2024-01-01", -1)).toBe("2023-12-01");
  expect(shiftMonth("2024-02-01", 1)).toBe("2024-03-01");
  const february = buildCalendarGrid(summary({ today: "2024-02-29", visibleMonth: "2024-02-01" }));
  expect(february.some((day) => day.date === "2024-02-29")).toBe(true);
});

test("shifts calendar dates across month, year, and leap-day boundaries", () => {
  expect(shiftDate("2024-02-28", 1)).toBe("2024-02-29");
  expect(shiftDate("2024-02-29", 1)).toBe("2024-03-01");
  expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
});

test("formats encouraging streak labels", () => {
  expect(formatStreakLabel(0)).toBe("Your streak starts today");
  expect(formatStreakLabel(1)).toBe("1-day streak");
  expect(formatStreakLabel(12)).toBe("12-day streak");
});

test("uses supportive messages only at the selected thresholds", () => {
  expect(missedDayMessage(2)).toBeNull();
  expect(missedDayMessage(3)).toContain("few days");
  expect(missedDayMessage(7)).toContain("Welcome back");
});

test("parses progress totals without accepting journal content", () => {
  const parsed = parseHabitSummary({
    calendar: [{ completed: true, entryDate: "2026-08-16", wordCount: 130 }],
    currentStreak: 2,
    firstEntryDate: "2026-08-15",
    lastCompletedDate: "2026-08-16",
    lastWelcomeBackDate: null,
    longestStreak: 2,
    missedDays: 0,
    monthCompletedDays: 2,
    monthElapsedDays: 16,
    monthWords: 250,
    today: "2026-08-16",
    totalCompletedDays: 2,
    totalWords: 250,
    visibleMonth: "2026-08-01",
    yearCompletedDays: 2,
    yearElapsedDays: 228,
    yearWords: 250,
  });
  expect(parsed.currentStreak).toBe(2);
  expect(parsed.calendar[0]).toEqual({ completed: true, entryDate: "2026-08-16", wordCount: 130 });
  expect(JSON.stringify(parsed)).not.toContain("content");
});
