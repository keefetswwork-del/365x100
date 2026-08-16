import { expect, test } from "@playwright/test";

import { decideAnonymousMigration } from "../../lib/draft-migration";

test("uploads a draft when the cloud has no dated entry", () => {
  expect(decideAnonymousMigration("local words", null)).toBe("upload");
});

test("treats identical local and cloud content as already migrated", () => {
  expect(decideAnonymousMigration("same words", "same words")).toBe("confirmed");
  expect(decideAnonymousMigration("", "")).toBe("confirmed");
});

test("requires review when local and cloud versions differ", () => {
  expect(decideAnonymousMigration("local words", "cloud words")).toBe("conflict");
});
