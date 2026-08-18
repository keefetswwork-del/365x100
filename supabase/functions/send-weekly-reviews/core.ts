export interface WeeklyReviewClaim {
  delivery_id: string;
  email: string;
  current_streak: number;
  week_completed: number;
  week_writing_days: number;
  week_words: number;
  month_completed: number;
  month_writing_days: number;
  month_words: number;
  most_recent_writing_date: string | null;
  personal_year_words: number;
  personal_year_writing_days: number;
  year_completed: number;
  year_words: number;
}

export interface WeeklyReviewEnvironment {
  cronSecret: string;
  resendApiKey: string;
  resendApiUrl: string;
  serviceRoleKey: string;
  siteUrl: string;
  supabaseUrl: string;
}

export type FetchLike = typeof fetch;

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function reviewHtml(claim: WeeklyReviewClaim, siteUrl: string): string {
  const url = siteUrl.replace(/\/$/, "");
  const recent = claim.most_recent_writing_date ?? "Your first memory awaits";
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f5f0e6;color:#18332e;font-family:Arial,sans-serif"><main style="max-width:560px;margin:0 auto;padding:40px 24px"><p style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#aa3f2e">365x100</p><h1 style="font-family:Georgia,serif;font-size:36px;line-height:1.1;margin:12px 0">Your week in writing</h1><p style="font-size:16px;line-height:1.6">You preserved memories on <strong>${claim.week_writing_days}</strong> of the last seven days and wrote <strong>${claim.week_words}</strong> words.</p><div style="margin:24px 0;padding:20px;border:1px solid rgba(24,51,46,.15);border-radius:16px;background:#fffaf1"><p style="margin:0 0 8px"><strong>This month:</strong> ${claim.month_writing_days} writing days · ${claim.month_words} words</p><p style="margin:0 0 8px"><strong>Your Personal Year:</strong> ${claim.personal_year_writing_days} writing days · ${claim.personal_year_words} words</p><p style="margin:0"><strong>Most recent memory:</strong> ${recent}</p></div><p style="font-size:15px;line-height:1.6">There is nothing to catch up on. Your story is still here whenever you are ready.</p><a href="${url}" style="display:inline-block;border-radius:999px;background:#18332e;color:white;padding:13px 20px;text-decoration:none;font-weight:700">Preserve a memory</a><p style="margin-top:28px;font-size:13px;line-height:1.5;color:#6c756e">This review contains writing statistics only, never your journal text. Change or disable weekly reviews from Account.</p></main></body></html>`;
}

function reviewText(claim: WeeklyReviewClaim, siteUrl: string): string {
  return [
    "Your week in 365x100",
    "",
    `Last seven days: ${claim.week_writing_days} writing days and ${claim.week_words} words preserved.`,
    `This month: ${claim.month_writing_days} writing days and ${claim.month_words} words.`,
    `Your Personal Year: ${claim.personal_year_writing_days} writing days and ${claim.personal_year_words} words.`,
    `Most recent memory: ${claim.most_recent_writing_date ?? "Your first memory awaits"}.`,
    "There is nothing to catch up on. Your story is still here whenever you are ready.",
    "",
    `Preserve a memory: ${siteUrl.replace(/\/$/, "")}`,
    "",
    "This review contains writing statistics only, never your journal text.",
  ].join("\n");
}

async function callRpc<T>(
  environment: WeeklyReviewEnvironment,
  fetcher: FetchLike,
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetcher(`${environment.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: environment.serviceRoleKey,
      Authorization: `Bearer ${environment.serviceRoleKey}`,
      "Content-Type": "application/json",
      "X-Client-Info": "365x100-weekly-reviews",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`RPC ${name} failed with ${response.status}`);
  return await response.json() as T;
}

async function finishDelivery(
  environment: WeeklyReviewEnvironment,
  fetcher: FetchLike,
  deliveryId: string,
  providerId: string | null,
  errorCode: string | null,
): Promise<void> {
  await callRpc<null>(environment, fetcher, "finish_weekly_review", {
    p_delivery_id: deliveryId,
    p_error_code: errorCode,
    p_provider_id: providerId,
  });
}

export function createWeeklyReviewHandler(
  environment: WeeklyReviewEnvironment,
  fetcher: FetchLike = fetch,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    }
    if (!safeEqual(request.headers.get("x-cron-secret") ?? "", environment.cronSecret)) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    let claims: WeeklyReviewClaim[];
    try {
      claims = await callRpc<WeeklyReviewClaim[]>(environment, fetcher, "claim_due_weekly_reviews", { p_limit: 50 });
    } catch {
      return Response.json({ error: "Review claims could not be loaded." }, { status: 502 });
    }

    let sent = 0;
    let failed = 0;
    for (const claim of claims) {
      try {
        const response = await fetcher(environment.resendApiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${environment.resendApiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `weekly-review/${claim.delivery_id}`,
            "User-Agent": "365x100-weekly-reviews/1.0",
          },
          body: JSON.stringify({
            from: "365x100 <hello@mail.365x100.com>",
            reply_to: "hello@365x100.com",
            to: [claim.email],
            subject: `Your week in writing: ${claim.week_writing_days} writing days`,
            html: reviewHtml(claim, environment.siteUrl),
            text: reviewText(claim, environment.siteUrl),
          }),
        });

        if (!response.ok) {
          await finishDelivery(environment, fetcher, claim.delivery_id, null, `resend_${response.status}`);
          failed += 1;
          continue;
        }

        const result = await response.json().catch(() => ({})) as { id?: string };
        await finishDelivery(environment, fetcher, claim.delivery_id, result.id ?? null, null);
        sent += 1;
      } catch {
        await finishDelivery(environment, fetcher, claim.delivery_id, null, "network_error").catch(() => undefined);
        failed += 1;
      }
    }

    return Response.json({ processed: claims.length, sent, failed });
  };
}
