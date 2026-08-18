import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const deleteAccount = withSupabase(
  { auth: "user" },
  async (request, { supabaseAdmin, userClaims }) => {
    const body = await request.json().catch(() => null);

    if (body?.confirmation !== "DELETE") {
      return Response.json(
        { error: "Type DELETE to permanently delete the account." },
        { status: 400 },
      );
    }

    const userId = userClaims?.id;
    if (!userId) {
      return Response.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { data: storedPaths, error: pathError } = await supabaseAdmin.rpc(
      "user_media_storage_paths",
      { p_user_id: userId },
    );
    if (pathError) {
      return Response.json(
        { error: "Account deletion could not be completed." },
        { status: 500 },
      );
    }

    const paths = (storedPaths ?? []).map((item: { storage_path: string }) => item.storage_path);
    for (let index = 0; index < paths.length; index += 100) {
      const { error: storageError } = await supabaseAdmin.storage
        .from("journal-media")
        .remove(paths.slice(index, index + 100));
      if (storageError) {
        return Response.json(
          { error: "Account deletion could not be completed." },
          { status: 500 },
        );
      }
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, false);
    if (error) {
      return Response.json(
        { error: "Account deletion could not be completed." },
        { status: 500 },
      );
    }

    return new Response(null, { status: 204 });
  },
);

export default {
  fetch: deleteAccount,
};
