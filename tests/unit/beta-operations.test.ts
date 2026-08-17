import { expect, test } from "@playwright/test";

import {
  clearPendingLegalConsent,
  hasPendingLegalConsent,
  markLegalConsentPending,
  parseLegalAcceptanceStatus,
} from "../../lib/beta-operations";

test("parses accepted and pending legal states without additional data", () => {
  expect(parseLegalAcceptanceStatus({
    accepted: true,
    authenticated: true,
    privacyVersion: "2026-08-17",
    termsVersion: "2026-08-17",
  })).toEqual({
    accepted: true,
    authenticated: true,
    privacyVersion: "2026-08-17",
    termsVersion: "2026-08-17",
  });

  expect(parseLegalAcceptanceStatus({ accepted: false, authenticated: false })).toEqual({
    accepted: false,
    authenticated: false,
    privacyVersion: null,
    termsVersion: null,
  });
});

test("rejects malformed legal acceptance state", () => {
  expect(() => parseLegalAcceptanceStatus({ accepted: "yes", authenticated: true })).toThrow();
  expect(() => parseLegalAcceptanceStatus([])).toThrow();
});

test("keeps pending OAuth consent only for the current browser session", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });

  try {
    expect(hasPendingLegalConsent()).toBe(false);
    markLegalConsentPending();
    expect(hasPendingLegalConsent()).toBe(true);
    clearPendingLegalConsent();
    expect(hasPendingLegalConsent()).toBe(false);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
