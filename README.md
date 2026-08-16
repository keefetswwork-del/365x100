# 365 x 100

A mobile-first daily writing practice built with Next.js, TypeScript, Tailwind CSS,
and Supabase. Anonymous writing remains browser-local; signed-in writing is cached
on the device and synchronized to a user-owned cloud entry. Signed-in writers can
also use calendar progress, streaks, optional prompts, and text-free weekly reviews.

## Environment

Copy `.env.example` to `.env.local` for development:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-or-project-publishable-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Only browser-safe `NEXT_PUBLIC_*` values belong in the Next.js environment. Never
add a Supabase secret key, service-role key, database password, GitHub token, or
Render API key to this static application.

Without valid Supabase variables, the anonymous Build 1 editor still works and
stores drafts under `365x100:entry:YYYY-MM-DD` in browser `localStorage`.

## Local Development

Docker must be running for the local Supabase stack:

```bash
npm install
npx supabase start
npm run dev
```

Local OTP messages are available in Mailpit at `http://127.0.0.1:54324`.

Install Playwright's Chromium browser once:

```bash
npx playwright install chromium
```

## Verification

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:db
npm run test:edge
npm run test:e2e
npm run build
```

`test:db`, `test:edge`, and the authenticated end-to-end flow require the local
Supabase stack. `npm run build` creates the static Render bundle in `out/`.

## Production Setup

Keep Render configured as a Static Site with build command
`npm ci && npm run build` and publish directory `out`. Add the three public
environment values above, using `https://365x100.com` for `NEXT_PUBLIC_SITE_URL`.

Before production acceptance:

1. Link this repository to the production Supabase project.
2. Preview and apply migrations with `npx supabase db push --dry-run` and `npx supabase db push`.
3. Deploy `delete-account` and `send-weekly-reviews` with `npx supabase functions deploy <name>`.
4. Set the Edge Function-only `RESEND_API_KEY`, `CRON_SECRET`, and `SITE_URL` secrets with `npx supabase secrets set`.
5. Store `project_url` and the matching `cron_secret` in Supabase Vault, then run `supabase/cron/weekly-reviews.sql` once.
6. Set the Supabase Site URL to `https://365x100.com` and allow localhost plus the Render fallback URL.
7. Configure Google OAuth with the callback URL shown by Supabase.
8. Keep Resend custom SMTP for Auth OTPs and use a separate sending-only Resend key for weekly reviews.
9. Point `365x100.com` to Render and redeploy the static site.

Never add `CRON_SECRET`, `RESEND_API_KEY`, a Supabase secret/service-role key, or
Vault values to Render or any `NEXT_PUBLIC_*` variable. Weekly emails contain only
counts and streaks; they do not read or send entry content. Service-only KPI queries
are documented in `supabase/queries/build_3_kpis.sql`.

Build 3 excludes daily reminders, search, exports, generated books, payments, and
PWA installation.
