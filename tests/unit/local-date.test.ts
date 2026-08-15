import { expect, test } from "@playwright/test";

import { getLocalDateString } from "../../lib/local-date";

test("formats the supplied date using local calendar fields", () => {
  const localEvening = new Date(2026, 0, 2, 23, 59, 59);

  expect(getLocalDateString(localEvening)).toBe("2026-01-02");
});

test("zero-pads single-digit months and days", () => {
  expect(getLocalDateString(new Date(2026, 8, 7, 12))).toBe("2026-09-07");
});

test("handles local year boundaries", () => {
  expect(getLocalDateString(new Date(2027, 0, 1, 0, 0, 1))).toBe(
    "2027-01-01",
  );
});
