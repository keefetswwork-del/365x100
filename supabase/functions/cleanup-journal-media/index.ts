import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

Deno.serve(async (request) => {
  const secret = Deno.env.get("CRON_SECRET") ?? "";
  if (!secret || !safeEqual(request.headers.get("x-cron-secret") ?? "", secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: queued, error } = await client.rpc("media_cleanup_candidates", { p_limit: 100 });
  if (error) return Response.json({ error: "Cleanup unavailable." }, { status: 503 });
  const { data: orphaned } = await client.rpc("orphaned_media_objects", { p_limit: 100 });
  const paths = [...new Set([
    ...(queued ?? []).map((item: { storage_path: string }) => item.storage_path),
    ...(orphaned ?? []).map((item: { storage_path: string }) => item.storage_path),
  ])];

  let removed = 0;
  for (const path of paths) {
    const { error: removeError } = await client.storage.from("journal-media").remove([path]);
    if (removeError) {
      await client.rpc("fail_media_cleanup", { p_error_code: "storage-remove-failed", p_storage_path: path });
      continue;
    }
    await client.rpc("complete_media_cleanup", { p_storage_paths: [path] });
    removed += 1;
  }

  return Response.json({ examined: paths.length, removed });
});
