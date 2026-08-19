# Build 3.4A Monthly Chapters Runbook

Build 3.4A is deployed backend-first. Annual Books remain disabled until the monthly quality gate passes.

## Predeployment gates

Do not apply the production migration or release the frontend until all of these are complete:

1. Finish the open Build 3.3.2 production checks in `docs/acceptance/build-3-3-2.md`: 9/10/11 quota, successful cleanup-cron execution, signed-URL expiry/refresh, mobile upload, ZIP inspection, and console/network privacy review.
2. Create an encrypted Supabase CLI dump and restore it successfully into an isolated non-production project. Record the date, source migration version, restore target, and verification result without committing credentials or dump data.
3. Create a dedicated OpenAI project for 365x100, disable voluntary data sharing, and configure a US$25 monthly budget alert.
4. Generate a dedicated API key and a cryptographically random safety-identifier salt. Store only `OPENAI_API_KEY` and `OPENAI_SAFETY_SALT` as Supabase Edge secrets. Never add either value to Render or a `NEXT_PUBLIC_*` variable.

## Backend rollout

1. Confirm the CLI is linked to project `dtctphqqupmxgdgodzxf`.
2. Run `npx supabase migration list`.
3. Run `npx supabase db push --dry-run` and require only `20260819130000_build_3_4a_monthly_chapters.sql`.
4. Apply the migration with `npx supabase db push`.
5. Deploy `generate-publication` with JWT verification enabled.
6. Confirm the production client still saves an existing entry and restores it after refresh.
7. Grant AI access only to selected founder test accounts through `publication_entitlements`. Original-only eligible chapters require no entitlement.

The Edge Function sends only entry dates, titles, authoritative plain text, and opaque source references. It uses `store: false`; photographs, rich JSON, filenames, URLs, account identifiers, and email addresses are excluded. Errors, jobs, events, and cost records must never contain journal or generated text.

## Frontend rollout

Fast-forward the tested branch to `main` without force. Use only the existing Render Static Site. No Render variables, Web Service, second Static Site, or additional domain mapping is required.

Production smoke testing covers original and AI chapters, disclosure consent, editing, approval, cover selection, source staleness, A5 PDF output, supported scripts, mobile layout, offline blocking, exports, and deletion.

## Quality gate for Build 3.4B

Run the private `Founder - Publication Quality` query. Annual implementation stays blocked until there are at least ten reviewed monthly generations, at least 80% are marked accurate, there are zero invented-fact reports, and production acceptance has no cross-user, journal-log, PDF-ordering, or media-placement defects.

Generated PDFs are on-demand browser downloads and are never retained in Storage. A frontend rollback leaves the additive database migration in place.
