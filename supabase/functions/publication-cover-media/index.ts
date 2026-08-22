import { createClient } from "@supabase/supabase-js";

import { isUuid, validateProcessedPhoto } from "../journal-media/core.ts";

const corsHeaders = {
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "DELETE, OPTIONS, POST",
  "access-control-allow-origin": "*",
};

function response(body: Record<string, string>, status: number) {
  return Response.json(body, { headers: corsHeaders, status });
}

async function currentUser(request: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("authorization");
  if (!url || !anonKey || !authorization) return null;
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) throw new Error("server-config");
  return createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });
  if (request.method !== "POST" && request.method !== "DELETE") return response({ error: "Method not allowed." }, 405);
  const user = await currentUser(request);
  if (!user) return response({ error: "Authentication required." }, 401);

  try {
    const input = request.method === "POST" ? await request.formData() : await request.json();
    const publicationId = input instanceof FormData ? input.get("publicationId") : input.publicationId;
    if (!isUuid(publicationId)) return response({ error: "Invalid chapter." }, 400);
    const admin = adminClient();
    const { data: publication } = await admin.from("publications")
      .select("id, cover_upload_path")
      .eq("id", publicationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!publication) return response({ error: "Chapter not found." }, 404);

    if (request.method === "DELETE") {
      if (publication.cover_upload_path) await admin.storage.from("journal-media").remove([publication.cover_upload_path]);
      const { error } = await admin.from("publications").update({ cover_source: "default", cover_upload_path: null }).eq("id", publicationId);
      if (error) return response({ error: "Cover could not be removed." }, 503);
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    const operationId = input.get("operationId");
    const file = input.get("file");
    if (!isUuid(operationId) || !(file instanceof File) || file.type !== "image/webp") return response({ error: "Invalid cover image." }, 415);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let dimensions;
    try {
      dimensions = validateProcessedPhoto(bytes);
    } catch {
      return response({ error: "Invalid cover image." }, 415);
    }
    const path = `${user.id}/covers/${publicationId}/${operationId}.webp`;
    const { error: uploadError } = await admin.storage.from("journal-media").upload(path, bytes, {
      cacheControl: "60", contentType: "image/webp", upsert: false,
    });
    if (uploadError) return response({ error: "Cover could not be uploaded." }, 503);
    const { error: updateError } = await admin.from("publications").update({
      cover_source: "upload", cover_upload_path: path, updated_at: new Date().toISOString(),
    }).eq("id", publicationId);
    if (updateError) {
      await admin.storage.from("journal-media").remove([path]);
      return response({ error: "Cover could not be saved." }, 503);
    }
    if (publication.cover_upload_path && publication.cover_upload_path !== path) await admin.storage.from("journal-media").remove([publication.cover_upload_path]);
    return Response.json({ height: dimensions.height, storagePath: path, width: dimensions.width }, { headers: corsHeaders, status: 200 });
  } catch {
    return response({ error: "Cover could not be updated." }, 503);
  }
});
