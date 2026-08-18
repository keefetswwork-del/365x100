import { expect, test } from "@playwright/test";

import {
  createWeeklyReviewHandler,
  type FetchLike,
  type WeeklyReviewClaim,
} from "../../supabase/functions/send-weekly-reviews/core";

const environment = {
  cronSecret: "test-cron-secret",
  resendApiKey: "test-resend-key",
  resendApiUrl: "https://resend.test/emails",
  serviceRoleKey: "test-service-role",
  siteUrl: "https://365x100.com",
  supabaseUrl: "https://supabase.test",
};

const claim: WeeklyReviewClaim = {
  current_streak: 4,
  delivery_id: "00000000-0000-0000-0000-000000000001",
  email: "writer@example.com",
  month_completed: 8,
  month_writing_days: 10,
  month_words: 1240,
  most_recent_writing_date: "2026-08-17",
  personal_year_words: 7210,
  personal_year_writing_days: 48,
  week_completed: 4,
  week_writing_days: 5,
  week_words: 630,
  year_completed: 48,
  year_words: 7210,
};

function request(secret = environment.cronSecret) {
  return new Request("https://functions.test/send-weekly-reviews", {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
}

test("rejects invalid cron secrets before accessing services", async () => {
  let requests = 0;
  const fetcher: FetchLike = async () => {
    requests += 1;
    return Response.json([]);
  };
  const response = await createWeeklyReviewHandler(environment, fetcher)(request("wrong"));
  expect(response.status).toBe(401);
  expect(requests).toBe(0);
});

test("sends statistics with a stable idempotency key and no journal content", async () => {
  const calls: Array<{ body: string; headers: Headers; url: string }> = [];
  const fetcher: FetchLike = async (input, init) => {
    const url = String(input);
    calls.push({ body: String(init?.body ?? ""), headers: new Headers(init?.headers), url });
    if (url.endsWith("claim_due_weekly_reviews")) return Response.json([claim]);
    if (url === environment.resendApiUrl) return Response.json({ id: "email-123" });
    return Response.json(null);
  };

  const response = await createWeeklyReviewHandler(environment, fetcher)(request());
  expect(await response.json()).toEqual({ failed: 0, processed: 1, sent: 1 });
  const resend = calls.find((call) => call.url === environment.resendApiUrl)!;
  expect(resend.headers.get("Idempotency-Key")).toBe(`weekly-review/${claim.delivery_id}`);
  expect(resend.body).toContain("630");
  expect(resend.body).toContain("5 writing days");
  expect(resend.body).not.toContain("Current streak");
  expect(resend.body).not.toContain("content");
  expect(resend.body).not.toContain("journal entry");
  const finish = calls.find((call) => call.url.endsWith("finish_weekly_review"))!;
  expect(JSON.parse(finish.body)).toEqual({
    p_delivery_id: claim.delivery_id,
    p_error_code: null,
    p_provider_id: "email-123",
  });
});

test("records a retryable failure without duplicating the send", async () => {
  const calls: Array<{ body: string; url: string }> = [];
  const fetcher: FetchLike = async (input, init) => {
    const url = String(input);
    calls.push({ body: String(init?.body ?? ""), url });
    if (url.endsWith("claim_due_weekly_reviews")) return Response.json([claim]);
    if (url === environment.resendApiUrl) return new Response(null, { status: 503 });
    return Response.json(null);
  };

  const response = await createWeeklyReviewHandler(environment, fetcher)(request());
  expect(await response.json()).toEqual({ failed: 1, processed: 1, sent: 0 });
  expect(calls.filter((call) => call.url === environment.resendApiUrl)).toHaveLength(1);
  const finish = calls.find((call) => call.url.endsWith("finish_weekly_review"))!;
  expect(JSON.parse(finish.body).p_error_code).toBe("resend_503");
});

test("does not contact Resend when no reviews are due", async () => {
  const urls: string[] = [];
  const fetcher: FetchLike = async (input) => {
    urls.push(String(input));
    return Response.json([]);
  };
  const response = await createWeeklyReviewHandler(environment, fetcher)(request());
  expect(await response.json()).toEqual({ failed: 0, processed: 0, sent: 0 });
  expect(urls).toHaveLength(1);
});
