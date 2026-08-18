import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

import { isUuid, validateProcessedPhoto } from "./core.ts";

function mediaJson(row: Record<string, unknown>) {
  return {
    id: row.id,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function queueCleanup(
  supabaseAdmin: any,
  userId: string,
  storagePath: string,
  reason: "abandoned" | "removed" | "replaced",
) {
  await supabaseAdmin.rpc("queue_media_cleanup", {
    p_reason: reason,
    p_storage_path: storagePath,
    p_user_id: userId,
  });
}

async function removeObject(supabaseAdmin: any, storagePath: string) {
  const { error } = await supabaseAdmin.storage.from("journal-media").remove([storagePath]);
  if (!error) {
    await supabaseAdmin.rpc("complete_media_cleanup", { p_storage_paths: [storagePath] });
  }
}

const journalMedia = withSupabase(
  { auth: "user" },
  async (request, { supabaseAdmin, userClaims }) => {
    const userId = userClaims?.id;
    if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });

    if (request.method === "DELETE") {
      const body = await request.json().catch(() => null);
      if (!isUuid(body?.mediaId) || !Number.isInteger(body?.version) || body.version < 1 || !isUuid(body?.operationId)) {
        return Response.json({ error: "Invalid removal request." }, { status: 400 });
      }

      const { data: owned } = await supabaseAdmin
        .from("entry_media")
        .select("id, user_id, storage_path, version")
        .eq("id", body.mediaId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!owned) return new Response(null, { status: 204 });

      const { data, error } = await supabaseAdmin.rpc("remove_entry_media", {
        p_expected_version: body.version,
        p_media_id: body.mediaId,
        p_user_id: userId,
      });
      if (error) return Response.json({ error: "Photo could not be removed." }, { status: 500 });
      if (data?.status === "conflict") {
        return Response.json({ status: "conflict", remote: mediaJson(data.remote) }, { status: 409 });
      }

      await removeObject(supabaseAdmin, owned.storage_path);
      const tier = await supabaseAdmin.rpc("current_media_tier", { p_user_id: userId });
      await supabaseAdmin.from("media_events").insert({
        user_id: userId,
        event_name: "photo_removed",
        operation_id: body.operationId,
        entitlement: tier.data ?? "free",
        dedupe_key: `photo_removed:${userId}:${body.operationId}`,
      });
      return new Response(null, { status: 204 });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const entryId = form?.get("entryId");
    const operationId = form?.get("operationId");
    const expectedMediaId = form?.get("expectedMediaId");
    const expectedVersionValue = form?.get("expectedVersion");
    if (!(file instanceof File) || !isUuid(entryId) || !isUuid(operationId)) {
      return Response.json({ error: "Invalid upload request." }, { status: 400 });
    }

    const expectedVersion = typeof expectedVersionValue === "string" && expectedVersionValue
      ? Number(expectedVersionValue)
      : null;
    if ((expectedMediaId && !isUuid(expectedMediaId)) || (expectedVersion !== null && (!Number.isInteger(expectedVersion) || expectedVersion < 1))) {
      return Response.json({ error: "Invalid replacement request." }, { status: 400 });
    }

    const { data: entry } = await supabaseAdmin
      .from("entries")
      .select("id")
      .eq("id", entryId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!entry) return Response.json({ error: "Entry not found." }, { status: 404 });

    const { data: privacyVersion } = await supabaseAdmin
      .from("legal_document_versions")
      .select("version")
      .eq("document_type", "privacy")
      .eq("is_current", true)
      .single();
    const { data: acceptance } = await supabaseAdmin
      .from("legal_acceptances")
      .select("version")
      .eq("user_id", userId)
      .eq("document_type", "privacy")
      .eq("version", privacyVersion?.version ?? "")
      .maybeSingle();
    if (!acceptance) return Response.json({ status: "privacy-required" }, { status: 428 });

    const { data: replayed } = await supabaseAdmin
      .from("entry_media")
      .select("*")
      .eq("user_id", userId)
      .eq("entry_id", entryId)
      .eq("operation_id", operationId)
      .maybeSingle();
    if (replayed) return Response.json({ status: "saved", media: mediaJson(replayed) });

    const bytes = new Uint8Array(await file.arrayBuffer());
    let dimensions;
    try {
      dimensions = validateProcessedPhoto(bytes);
    } catch {
      return Response.json({ error: "Processed photo is invalid." }, { status: 415 });
    }

    // The operation UUID makes duplicate clicks and retries converge on one object path.
    const mediaId = operationId;
    const storagePath = `${userId}/${entryId}/${mediaId}.webp`;
    const { error: uploadError } = await supabaseAdmin.storage.from("journal-media").upload(
      storagePath,
      new Blob([bytes], { type: "image/webp" }),
      { cacheControl: "60", contentType: "image/webp", upsert: false },
    );
    if (uploadError) {
      const { data: concurrentReplay } = await supabaseAdmin
        .from("entry_media")
        .select("*")
        .eq("user_id", userId)
        .eq("entry_id", entryId)
        .eq("operation_id", operationId)
        .maybeSingle();
      if (concurrentReplay) return Response.json({ status: "saved", media: mediaJson(concurrentReplay) });
      return Response.json({ error: "Photo upload failed." }, { status: 503 });
    }

    const { data: result, error: commitError } = await supabaseAdmin.rpc("commit_entry_media", {
      p_byte_size: bytes.length,
      p_entry_id: entryId,
      p_expected_media_id: expectedMediaId || null,
      p_expected_version: expectedVersion,
      p_height: dimensions.height,
      p_media_id: mediaId,
      p_operation_id: operationId,
      p_storage_path: storagePath,
      p_user_id: userId,
      p_width: dimensions.width,
    });

    if (commitError || result?.status !== "saved") {
      await queueCleanup(supabaseAdmin, userId, storagePath, "abandoned");
      await removeObject(supabaseAdmin, storagePath);
      if (result?.status === "limit") return Response.json(result, { status: 409 });
      if (result?.status === "conflict") {
        return Response.json({ status: "conflict", remote: result.remote ? mediaJson(result.remote) : null }, { status: 409 });
      }
      return Response.json({ error: "Photo could not be attached." }, { status: 500 });
    }

    if (result.oldPath) await removeObject(supabaseAdmin, result.oldPath);
    const tier = await supabaseAdmin.rpc("current_media_tier", { p_user_id: userId });
    await supabaseAdmin.from("media_events").insert({
      user_id: userId,
      event_name: result.oldPath ? "photo_replaced" : "photo_upload_completed",
      operation_id: operationId,
      entitlement: tier.data ?? "free",
      dedupe_key: `${result.oldPath ? "photo_replaced" : "photo_upload_completed"}:${userId}:${operationId}`,
    });

    return Response.json({ status: "saved", media: mediaJson(result.media) });
  },
);

export default { fetch: journalMedia };
