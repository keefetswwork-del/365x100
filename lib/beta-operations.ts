import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/database.types";
import type {
  LegalAcceptanceStatus,
  OperationalErrorCode,
  OperationalFeatureArea,
} from "@/types/beta";

type Client = SupabaseClient<Database>;

const LEGAL_CONSENT_PENDING_KEY = "365x100:legal-consent-pending";
const OPERATIONS_SESSION_KEY = "365x100:operations-session";

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseLegalAcceptanceStatus(value: Json): LegalAcceptanceStatus {
  if (!isRecord(value) || typeof value.accepted !== "boolean" || typeof value.authenticated !== "boolean") {
    throw new Error("Legal acceptance status is invalid.");
  }

  return {
    accepted: value.accepted,
    authenticated: value.authenticated,
    privacyVersion: typeof value.privacyVersion === "string" ? value.privacyVersion : null,
    termsVersion: typeof value.termsVersion === "string" ? value.termsVersion : null,
  };
}

export async function fetchLegalAcceptanceStatus(client: Client): Promise<LegalAcceptanceStatus> {
  const { data, error } = await client.rpc("get_current_legal_status");
  if (error || !data) throw new Error("Legal acceptance could not be checked.");
  return parseLegalAcceptanceStatus(data);
}

export async function acceptCurrentLegalDocuments(client: Client): Promise<LegalAcceptanceStatus> {
  const { data, error } = await client.rpc("accept_current_legal_documents");
  if (error || !data) throw new Error("Legal acceptance could not be saved.");
  return parseLegalAcceptanceStatus(data);
}

export function markLegalConsentPending(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LEGAL_CONSENT_PENDING_KEY, "true");
}

export function hasPendingLegalConsent(): boolean {
  return typeof window !== "undefined"
    && window.sessionStorage.getItem(LEGAL_CONSENT_PENDING_KEY) === "true";
}

export function clearPendingLegalConsent(): void {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(LEGAL_CONSENT_PENDING_KEY);
}

function operationalSessionId(): string | null {
  if (typeof window === "undefined") return null;
  const existing = window.sessionStorage.getItem(OPERATIONS_SESSION_KEY);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(OPERATIONS_SESSION_KEY, created);
  return created;
}

export async function recordOperationalEvent(
  client: Client | null,
  featureArea: OperationalFeatureArea,
  errorCode: OperationalErrorCode,
): Promise<void> {
  if (!client) return;
  const sessionId = operationalSessionId();
  if (!sessionId) return;
  await client.rpc("record_operational_event", {
    p_error_code: errorCode,
    p_feature_area: featureArea,
    p_session_id: sessionId,
  }).then(() => undefined, () => undefined);
}
