import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

import {
  buildEditorialRequest,
  buildEditorialSynthesisRequest,
  estimateGenerationCostCeiling,
  isGenerationSection,
  mergeEditorialSection,
  sourceChunks,
  validateEditorial,
  validateSynthesis,
  type EditorialDocument,
  type GenerationSection,
  type SourceEntry,
} from "./core.ts";

const MODEL = "gpt-5.6-terra";
const PROMPT_VERSION = "monthly-editor-v1";
const MONTHLY_SPEND_LIMIT_USD = 25;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function safetyIdentifier(userId: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { hash: "SHA-256", name: "HMAC" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function outputText(response: Record<string, unknown>): string | null {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") {
        return (part as Record<string, unknown>).text as string;
      }
    }
  }
  return null;
}

async function requestOnce(
  body: ReturnType<typeof buildEditorialRequest>,
  validate: (value: unknown) => EditorialDocument | null,
): Promise<{ document: EditorialDocument; inputTokens: number; outputTokens: number }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("provider");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(response.status === 429 ? "spend-limit" : "provider");
  const result = await response.json() as Record<string, unknown>;
  const text = outputText(result);
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("invalid-output");
  }
  const document = validate(parsed);
  if (!document) throw new Error("invalid-output");
  const usage = result.usage && typeof result.usage === "object" ? result.usage as Record<string, unknown> : {};
  return {
    document,
    inputTokens: Number(usage.input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
  };
}

async function requestEditorial(
  sources: SourceEntry[],
  safetyId: string,
  section: GenerationSection,
): Promise<{ document: EditorialDocument; inputTokens: number; outputTokens: number }> {
  const chunks = sourceChunks(sources);
  if (chunks.length === 1) {
    return requestOnce(buildEditorialRequest(chunks[0], safetyId, section), (value) => validateEditorial(value, chunks[0]));
  }

  const drafts: EditorialDocument[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  for (const chunk of chunks) {
    const generated = await requestOnce(buildEditorialRequest(chunk, safetyId, section), (value) => validateEditorial(value, chunk));
    drafts.push(generated.document);
    inputTokens += generated.inputTokens;
    outputTokens += generated.outputTokens;
  }
  const synthesized = await requestOnce(
    buildEditorialSynthesisRequest(drafts, safetyId, section),
    (value) => validateSynthesis(value, sources, drafts),
  );
  return {
    document: synthesized.document,
    inputTokens: inputTokens + synthesized.inputTokens,
    outputTokens: outputTokens + synthesized.outputTokens,
  };
}

const generatePublication = withSupabase(
  { auth: "user" },
  async (request, { supabaseAdmin, userClaims }) => {
    if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
    const userId = userClaims?.id;
    if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!isUuid(body?.publicationId) || !isUuid(body?.idempotencyKey) || !isGenerationSection(body?.section)) {
      return Response.json({ error: "Invalid editorial request." }, { status: 400 });
    }

    const { data: publication } = await supabaseAdmin.from("publications").select("*")
      .eq("id", body.publicationId).eq("user_id", userId).eq("scope", "monthly").maybeSingle();
    if (!publication) return Response.json({ error: "Chapter not found." }, { status: 404 });
    const { data: entitlement } = await supabaseAdmin.from("publication_entitlements").select("*")
      .eq("user_id", userId).eq("ai_enabled", true).maybeSingle();
    if (!entitlement || (entitlement.expires_at && new Date(entitlement.expires_at) <= new Date())) {
      return Response.json({ error: "AI beta access required." }, { status: 403 });
    }
    const { data: disclosure } = await supabaseAdmin.from("ai_disclosure_versions").select("version").eq("is_current", true).single();
    const { data: consent } = await supabaseAdmin.from("ai_processing_consents").select("accepted_at")
      .eq("user_id", userId).eq("publication_id", publication.id).eq("disclosure_version", disclosure?.version ?? "").maybeSingle();
    if (!consent) return Response.json({ error: "AI processing consent required." }, { status: 428 });

    const { data: replay } = await supabaseAdmin.from("generation_jobs").select("state")
      .eq("user_id", userId).eq("idempotency_key", body.idempotencyKey).maybeSingle();
    if (replay?.state === "succeeded") return Response.json({ status: "ready" });
    const isFull = body.section === "full";
    const staleFullRegeneration = isFull && publication.state === "stale";
    if (isFull && !staleFullRegeneration && publication.generation_count >= entitlement.generation_limit) {
      return Response.json({ error: "Generation credit used." }, { status: 409 });
    }
    if (staleFullRegeneration && publication.section_regeneration_count + 5 > entitlement.section_regeneration_limit) {
      return Response.json({ error: "Section regeneration credits used." }, { status: 409 });
    }
    if (!isFull && publication.section_regeneration_count >= entitlement.section_regeneration_limit) {
      return Response.json({ error: "Section regeneration credits used." }, { status: 409 });
    }

    const { data: entries } = await supabaseAdmin.from("entries").select("id, entry_date, title, content")
      .eq("user_id", userId).gte("entry_date", publication.period_start).lte("entry_date", publication.period_end).order("entry_date");
    const sources: SourceEntry[] = (entries ?? []).map((entry: Record<string, unknown>) => ({
      content: String(entry.content ?? ""), date: String(entry.entry_date), ref: String(entry.id), title: String(entry.title ?? ""),
    }));
    if (!sources.length) return Response.json({ error: "Chapter has no source entries." }, { status: 400 });

    const monthStart = new Date().toISOString().slice(0, 7) + "-01";
    const { data: spendRows } = await supabaseAdmin.from("generation_jobs").select("estimated_cost_usd")
      .eq("state", "succeeded").gte("created_at", `${monthStart}T00:00:00Z`);
    const monthlySpend = (spendRows ?? []).reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.estimated_cost_usd ?? 0), 0);
    if (monthlySpend + estimateGenerationCostCeiling(sources) > MONTHLY_SPEND_LIMIT_USD) {
      return Response.json({ error: "Editorial beta budget reached." }, { status: 429 });
    }

    const { data: job, error: jobError } = await supabaseAdmin.from("generation_jobs").upsert({
      user_id: userId,
      publication_id: publication.id,
      idempotency_key: body.idempotencyKey,
      job_kind: body.section,
      state: "running",
      lease_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    }, { onConflict: "user_id,idempotency_key", ignoreDuplicates: true }).select("id").maybeSingle();
    if (jobError || !job) return Response.json({ error: "Editorial request is already running." }, { status: 409 });

    await supabaseAdmin.from("publication_events").insert({
      dedupe_key: `${job.id}:ai_started`,
      event_name: "ai_started",
      publication_id: publication.id,
      user_id: userId,
    });
    await supabaseAdmin.from("publications").update({ state: "generating", updated_at: new Date().toISOString() }).eq("id", publication.id);
    try {
      const salt = Deno.env.get("OPENAI_SAFETY_SALT");
      if (!salt) throw new Error("provider");
      let generated;
      try {
        generated = await requestEditorial(sources, await safetyIdentifier(userId, salt), body.section);
      } catch (error) {
        if ((error as Error).message !== "invalid-output") throw error;
        generated = await requestEditorial(sources, await safetyIdentifier(userId, salt), body.section);
      }
      let editorial = generated.document;
      if (!isFull && publication.current_draft_version_id) {
        const { data: current } = await supabaseAdmin.from("publication_versions").select("editorial")
          .eq("id", publication.current_draft_version_id).maybeSingle();
        const validCurrent = validateEditorial(current?.editorial, sources);
        if (validCurrent) editorial = mergeEditorialSection(validCurrent, editorial, body.section);
      }
      const { data: fingerprint } = await supabaseAdmin.rpc("refresh_publication_sources", { p_publication_id: publication.id });
      const { data: versionRows } = await supabaseAdmin.from("publication_versions").select("version_number").eq("publication_id", publication.id).order("version_number", { ascending: false }).limit(1);
      const versionNumber = Number(versionRows?.[0]?.version_number ?? 0) + 1;
      const estimatedCost = generated.inputTokens * 0.000002 + generated.outputTokens * 0.000012;
      const { data: version } = await supabaseAdmin.from("publication_versions").insert({
        publication_id: publication.id, version_number: versionNumber, editorial,
        source_fingerprint: fingerprint?.editorialFingerprint ?? "", model: MODEL, prompt_version: PROMPT_VERSION,
        input_tokens: generated.inputTokens, output_tokens: generated.outputTokens,
        estimated_cost_usd: estimatedCost, approval_state: "draft",
      }).select("id").single();
      await supabaseAdmin.from("publications").update({
        mode: "ai", state: "draft", current_draft_version_id: version.id,
        editorial_fingerprint: fingerprint?.editorialFingerprint ?? "", stale_reason: null,
        generation_count: publication.generation_count + (isFull && !staleFullRegeneration ? 1 : 0),
        section_regeneration_count: publication.section_regeneration_count + (staleFullRegeneration ? 5 : isFull ? 0 : 1),
        title: editorial.title, updated_at: new Date().toISOString(),
      }).eq("id", publication.id);
      await supabaseAdmin.from("generation_jobs").update({
        state: "succeeded", lease_expires_at: null, input_tokens: generated.inputTokens,
        output_tokens: generated.outputTokens, estimated_cost_usd: estimatedCost, updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      await supabaseAdmin.from("publication_events").insert({
        dedupe_key: `${job.id}:${isFull ? "ai_completed" : "section_regenerated"}`,
        event_name: isFull ? "ai_completed" : "section_regenerated",
        publication_id: publication.id,
        user_id: userId,
      });
      return Response.json({ status: "draft" });
    } catch (error) {
      const code = ["invalid-output", "spend-limit"].includes((error as Error).message) ? (error as Error).message : "provider";
      await supabaseAdmin.from("generation_jobs").update({ state: "failed", failure_code: code, lease_expires_at: null, updated_at: new Date().toISOString() }).eq("id", job.id);
      await supabaseAdmin.from("publications").update({ state: "failed", updated_at: new Date().toISOString() }).eq("id", publication.id);
      await supabaseAdmin.from("publication_events").insert({
        dedupe_key: `${job.id}:ai_failed`,
        event_name: "ai_failed",
        publication_id: publication.id,
        user_id: userId,
      });
      return Response.json({ error: "Editorial generation could not be completed.", code }, { status: code === "spend-limit" ? 429 : 502 });
    }
  },
);

Deno.serve(generatePublication);
