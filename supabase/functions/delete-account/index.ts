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
