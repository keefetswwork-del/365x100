import { expect, test } from "@playwright/test";

import {
  parseWritingYearSummary,
  writingYearForDate,
  writingYearProgressPercent,
} from "../../lib/writing-year";

test("keeps Day 1 through Day 365 in the first fixed writing year", () => {
  expect(writingYearForDate("2026-08-17", "2026-08-17")).toEqual({
    dayNumber: 1,
    endDate: "2027-08-16",
    startDate: "2026-08-17",
    yearNumber: 1,
  });
  expect(writingYearForDate("2026-08-17", "2027-08-16").dayNumber).toBe(365);
});

test("starts Year 2 on the next calendar day without extending for missed days", () => {
  expect(writingYearForDate("2026-08-17", "2027-08-17")).toEqual({
    dayNumber: 1,
    endDate: "2028-08-15",
    startDate: "2027-08-17",
    yearNumber: 2,
  });
  expect(writingYearForDate("2026-08-17", "2029-08-15").yearNumber).toBe(3);
});

test("uses elapsed calendar days for leap-day anchors", () => {
  expect(writingYearForDate("2028-02-29", "2029-02-27")).toMatchObject({
    dayNumber: 365,
    yearNumber: 1,
  });
  expect(writingYearForDate("2028-02-29", "2029-02-28")).toEqual({
    dayNumber: 1,
    endDate: "2030-02-27",
    startDate: "2029-02-28",
    yearNumber: 2,
  });
});

test("rejects malformed dates and dates before the permanent anchor", () => {
  expect(() => writingYearForDate("2026-02-30", "2026-08-17")).toThrow("invalid");
  expect(() => writingYearForDate("2026-08-17", "2026-08-16")).toThrow("cannot precede");
});

test("parses empty and active writing-year dashboard responses", () => {
  expect(parseWritingYearSummary({
    hasWritingYear: false,
    today: "2026-08-17",
  })).toEqual({ hasWritingYear: false, today: "2026-08-17" });

  expect(parseWritingYearSummary({
    annualBookDaysRemaining: 50,
    annualBookEligible: false,
    completedDays: 10,
    dayNumber: 20,
    endDate: "2027-08-16",
    hasWritingYear: true,
    startDate: "2026-08-17",
    today: "2026-09-05",
    totalEntries: 12,
    totalWords: 1400,
    writingDays: 10,
    yearNumber: 1,
  })).toMatchObject({ annualBookDaysRemaining: 50, completedDays: 10, dayNumber: 20, totalEntries: 12, writingDays: 10 });
});

test("rejects malformed writing-year responses and clamps progress", () => {
  expect(() => parseWritingYearSummary({ hasWritingYear: true, today: "2026-08-17" })).toThrow();
  expect(writingYearProgressPercent(-1)).toBe(0);
  expect(writingYearProgressPercent(365)).toBe(100);
  expect(writingYearProgressPercent(500)).toBe(100);
});
