import { expect, test } from "@playwright/test";

import {
  getDateInTimeZone,
  isValidTimeZone,
} from "../../lib/timezone";

test("assigns one instant to the correct calendar date in different timezones", () => {
  const instant = new Date("2026-08-16T16:30:00.000Z");

  expect(getDateInTimeZone(instant, "Asia/Singapore")).toBe("2026-08-17");
  expect(getDateInTimeZone(instant, "America/Los_Angeles")).toBe("2026-08-16");
});

test("changes dates exactly across local midnight", () => {
  const beforeMidnight = new Date("2026-08-16T15:59:59.999Z");
  const atMidnight = new Date("2026-08-16T16:00:00.000Z");

  expect(getDateInTimeZone(beforeMidnight, "Asia/Singapore")).toBe("2026-08-16");
  expect(getDateInTimeZone(atMidnight, "Asia/Singapore")).toBe("2026-08-17");
});

test("validates IANA timezone names", () => {
  expect(isValidTimeZone("Asia/Singapore")).toBe(true);
  expect(isValidTimeZone("Not/A_Timezone")).toBe(false);
});
