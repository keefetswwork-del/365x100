import { expect, test } from "@playwright/test";

import {
  getAccountCacheKey,
  loadAccountBootstrapCache,
  removeAccountBootstrapCache,
  saveAccountBootstrapCache,
  updateCachedProfile,
} from "../../lib/account-cache";
import type { Profile } from "../../types/cloud";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function profile(userId = "user-a"): Profile {
  return {
    createdAt: "2026-08-17T00:00:00Z",
    dailyPromptsEnabled: false,
    habitOnboardingCompleted: true,
    lastWelcomeBackDate: null,
    timezone: "Asia/Singapore",
    updatedAt: "2026-08-19T00:00:00Z",
    userId,
    weeklyReviewDay: 7,
    weeklyReviewEnabled: false,
    weeklyReviewTime: "19:00:00",
  };
}

const accepted = {
  accepted: true as const,
  authenticated: true as const,
  privacyVersion: "2026-08-18",
  termsVersion: "2026-08-17",
};

test("stores a server-confirmed account bootstrap cache for only its user", () => {
  const storage = memoryStorage();
  expect(saveAccountBootstrapCache("user-a", accepted, profile(), storage)).toBe(true);
  expect(loadAccountBootstrapCache("user-a", storage)).toMatchObject({
    legalAcceptance: accepted,
    profile: { timezone: "Asia/Singapore", userId: "user-a" },
    userId: "user-a",
    version: 1,
  });
  expect(loadAccountBootstrapCache("user-b", storage)).toBeNull();
});

test("rejects malformed, unaccepted and cross-user account caches", () => {
  const storage = memoryStorage();
  storage.setItem(getAccountCacheKey("user-a"), JSON.stringify({ version: 1, userId: "user-a" }));
  expect(loadAccountBootstrapCache("user-a", storage)).toBeNull();
  expect(saveAccountBootstrapCache("user-a", { ...accepted, accepted: false }, profile(), storage)).toBe(false);
  expect(saveAccountBootstrapCache("user-a", accepted, profile("user-b"), storage)).toBe(false);
});

test("updates profile settings without changing accepted legal versions", () => {
  const storage = memoryStorage();
  saveAccountBootstrapCache("user-a", accepted, profile(), storage);
  expect(updateCachedProfile("user-a", {
    ...profile(),
    dailyPromptsEnabled: true,
    timezone: "Australia/Sydney",
  }, storage)).toBe(true);
  const cached = loadAccountBootstrapCache("user-a", storage);
  expect(cached?.legalAcceptance).toEqual(accepted);
  expect(cached?.profile).toMatchObject({
    dailyPromptsEnabled: true,
    timezone: "Australia/Sydney",
  });
});

test("removes cached account metadata during permanent deletion", () => {
  const storage = memoryStorage();
  saveAccountBootstrapCache("user-a", accepted, profile(), storage);
  removeAccountBootstrapCache("user-a", storage);
  expect(loadAccountBootstrapCache("user-a", storage)).toBeNull();
});
