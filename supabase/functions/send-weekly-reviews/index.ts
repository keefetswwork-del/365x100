import "@supabase/functions-js/edge-runtime.d.ts";

import { createWeeklyReviewHandler } from "./core.ts";

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

let handler: (request: Request) => Promise<Response>;

try {
  handler = createWeeklyReviewHandler({
    cronSecret: requiredEnvironment("CRON_SECRET"),
    resendApiKey: requiredEnvironment("RESEND_API_KEY"),
    resendApiUrl: Deno.env.get("RESEND_API_URL") ?? "https://api.resend.com/emails",
    serviceRoleKey: requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    siteUrl: Deno.env.get("SITE_URL") ?? "https://365x100.com",
    supabaseUrl: requiredEnvironment("SUPABASE_URL"),
  });
} catch {
  handler = async () => Response.json({ error: "Service unavailable." }, { status: 503 });
}

Deno.serve(handler);
