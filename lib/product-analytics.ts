import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { ProductEventName } from "@/types/habit";

const SESSION_KEY = "365x100:analytics-session";
const SIGNUP_KEY = "365x100:signup-started";

function sessionId(): string | null {
  if (typeof window === "undefined") return null;
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, created);
  return created;
}
export function markSignupStarted(): void {
  if (typeof window !== "undefined") window.sessionStorage.setItem(SIGNUP_KEY, "true");
}

export function consumeSignupStarted(): boolean {
  if (typeof window === "undefined") return false;
  const started = window.sessionStorage.getItem(SIGNUP_KEY) === "true";
  if (started) window.sessionStorage.removeItem(SIGNUP_KEY);
  return started;
}

export async function recordProductEvent(
  client: SupabaseClient<Database> | null,
  eventName: ProductEventName,
  entryDate?: string,
): Promise<void> {
  if (!client) return;
  const id = sessionId();
  if (!id) return;
  await client.rpc("record_product_event", {
    p_entry_date: entryDate,
    p_event_name: eventName,
    p_session_id: id,
  }).then(() => undefined, () => undefined);
}
