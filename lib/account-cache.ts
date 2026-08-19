import { isValidTimeZone } from "@/lib/timezone";
import type { LegalAcceptanceStatus } from "@/types/beta";
import type { Profile } from "@/types/cloud";

const ACCOUNT_CACHE_PREFIX = "365x100:cloud:";
const ACCOUNT_CACHE_VERSION = 1;

export interface AccountBootstrapCacheV1 {
  cachedAt: string;
  legalAcceptance: LegalAcceptanceStatus & {
    accepted: true;
    authenticated: true;
    privacyVersion: string;
    termsVersion: string;
  };
  profile: Profile;
  userId: string;
  version: 1;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getAccountCacheKey(userId: string): string {
  return `${ACCOUNT_CACHE_PREFIX}${userId}:account:v${ACCOUNT_CACHE_VERSION}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProfile(value: unknown, userId: string): value is Profile {
  if (!isRecord(value)) return false;
  return value.userId === userId
    && typeof value.timezone === "string"
    && isValidTimeZone(value.timezone)
    && typeof value.dailyPromptsEnabled === "boolean"
    && typeof value.habitOnboardingCompleted === "boolean"
    && (value.lastWelcomeBackDate === null || typeof value.lastWelcomeBackDate === "string")
    && Number.isInteger(value.weeklyReviewDay)
    && Number(value.weeklyReviewDay) >= 1
    && Number(value.weeklyReviewDay) <= 7
    && typeof value.weeklyReviewEnabled === "boolean"
    && typeof value.weeklyReviewTime === "string"
    && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(value.weeklyReviewTime)
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}

function isAcceptedLegalStatus(value: unknown): value is AccountBootstrapCacheV1["legalAcceptance"] {
  if (!isRecord(value)) return false;
  return value.accepted === true
    && value.authenticated === true
    && typeof value.privacyVersion === "string"
    && value.privacyVersion.length > 0
    && typeof value.termsVersion === "string"
    && value.termsVersion.length > 0;
}

export function loadAccountBootstrapCache(
  userId: string,
  storage: Storage | null = getStorage(),
): AccountBootstrapCacheV1 | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(getAccountCacheKey(userId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value)
      || value.version !== ACCOUNT_CACHE_VERSION
      || value.userId !== userId
      || typeof value.cachedAt !== "string"
      || !isAcceptedLegalStatus(value.legalAcceptance)
      || !isProfile(value.profile, userId)
    ) {
      return null;
    }
    return value as unknown as AccountBootstrapCacheV1;
  } catch {
    return null;
  }
}

export function saveAccountBootstrapCache(
  userId: string,
  legalAcceptance: LegalAcceptanceStatus,
  profile: Profile,
  storage: Storage | null = getStorage(),
): boolean {
  if (
    !storage
    || profile.userId !== userId
    || !isProfile(profile, userId)
    || !isAcceptedLegalStatus(legalAcceptance)
  ) {
    return false;
  }
  const cache: AccountBootstrapCacheV1 = {
    cachedAt: new Date().toISOString(),
    legalAcceptance,
    profile,
    userId,
    version: ACCOUNT_CACHE_VERSION,
  };
  try {
    storage.setItem(getAccountCacheKey(userId), JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

export function updateCachedProfile(
  userId: string,
  profile: Profile,
  storage: Storage | null = getStorage(),
): boolean {
  const current = loadAccountBootstrapCache(userId, storage);
  if (!current) return false;
  return saveAccountBootstrapCache(userId, current.legalAcceptance, profile, storage);
}

export function removeAccountBootstrapCache(
  userId: string,
  storage: Storage | null = getStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(getAccountCacheKey(userId));
  } catch {
    // Account deletion is still complete remotely when browser storage is unavailable.
  }
}
