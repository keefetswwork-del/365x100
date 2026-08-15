import { expect, test } from "@playwright/test";

import { countWords } from "../../lib/word-count";

test("counts empty and whitespace-only text as zero", () => {
  expect(countWords("")).toBe(0);
  expect(countWords("   \n\t  ")).toBe(0);
});

test("treats multiple spaces and line breaks as separators", () => {
  expect(countWords("one   two\nthree\r\n\tfour")).toBe(4);
});

test("ignores surrounding punctuation", () => {
  expect(countWords('Hello, world! “Today”... happened?')).toBe(4);
});

test("keeps apostrophes and hyphenated terms together", () => {
  expect(countWords("I can't forget the well-lit room.")).toBe(6);
  expect(countWords("It’s a once-in-a-lifetime day.")).toBe(4);
});

test("counts pasted multi-line content consistently", () => {
  const pasted = "First paragraph, with words.\n\nSecond paragraph—still here.";
  expect(countWords(pasted)).toBe(8);
});

test("does not count standalone emojis as words", () => {
  expect(countWords("A bright day ☀️ 🌿")).toBe(3);
  expect(countWords("🎉🎉🎉")).toBe(0);
});
