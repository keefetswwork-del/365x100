# Private Beta Operations Runbook

This runbook covers Build 3.3 operations for the existing Supabase project and Render Static Site. It does not authorize creating another service, exposing secrets, or inspecting journal content.

## Daily health review

1. Open Supabase **Reports > Custom Reports > Founder Analytics** and refresh the System Health and Operational Health blocks.
2. Investigate a sustained increase in a closed error code, not an individual journal entry.
3. Open Supabase **Logs Explorer** and filter by service, time range, status, and request ID. Never add entry text, rich documents, search terms, or authentication tokens to a search or incident note.
4. Check Render only for static build and asset-delivery failures. The public application must remain the existing Static Site publishing `out/`.

Reference: [Supabase Logs Explorer](https://supabase.com/docs/guides/monitoring-and-debugging/logs).

## Authentication and rate limits

- Keep Supabase Auth's platform rate limits enabled. Review **Authentication > Rate Limits** before a planned beta invitation wave.
- The application enforces a 60-second OTP resend cooldown in addition to provider limits.
- Operational events are capped per actor in the database. Entry autosaves are never routed through that limiter.
- If sign-in errors rise, inspect provider status, redirect allow-lists, SMTP delivery, and sanitized Auth logs before changing limits.

Reference: [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

## Incident handling

1. Record the start time, affected feature, closed error code, and deployment or migration version.
2. Confirm whether anonymous local writing still works before changing production.
3. Prefer restoring the previous Render deployment for a frontend regression. Build 3.3 database changes are additive and should remain in place for old-client compatibility.
4. For a database incident, stop the frontend rollout and take an off-site dump before any corrective migration.
5. Apply fixes through a new version-controlled migration. Never edit migration history, force-push `main`, or destructively roll back production tables.
6. Record only sanitized diagnostics. Do not paste journal text, rich JSON, email codes, tokens, or secrets into tickets or chat.

## Secrets

- Browser builds may contain only the Supabase URL, publishable key, and public site URL.
- Supabase service-role keys, database passwords, Resend keys, cron secrets, OAuth client secrets, and CLI access tokens never belong in Render's static environment or tracked files.
- Store Edge Function secrets in Supabase secrets and cron invocation secrets in Vault.
- Use short-lived CLI access deliberately, clear it from the PowerShell session after use, and revoke it when the deployment session is complete.

## Backup procedure

Supabase Free projects do not provide the same managed daily backup coverage as paid plans. The planned off-site procedure is:

1. Create an encrypted, access-controlled destination outside the repository and synchronized workspace.
2. Run schema and data dumps with the Supabase CLI using the production project connection. Do not write the database password into a script or command history.
3. Encrypt the dump before transferring it off the workstation.
4. Record the migration version, dump timestamp, checksum, encryption method, and authorized custodian without recording secrets.
5. Retain backups according to the legal retention policy and securely remove expired copies.

Reference: [Supabase database backups](https://supabase.com/docs/guides/platform/backups).

## Restore drill

1. Create an isolated non-production Supabase project.
2. Restore the encrypted dump into that project using a temporary credential.
3. Run migration-history checks, database lint, pgTAP, and aggregate row-count comparisons.
4. Verify RLS, RPC grants, Auth linkage, entry counts, writing-year assignments, and deletion cascades without opening journal text.
5. Destroy the isolated project and temporary credentials after documenting the result.

## Current acceptance status

Live off-site backup creation and a restore drill are **deferred** for Build 3.3. The documented procedure is not evidence that a recoverable backup exists. Build 3.3 operations must continue to report backup acceptance as deferred until both a backup and restore drill have actually succeeded.

## Private media operations

- Refresh the Founder Media Capacity report before broadening beta access. Review attached photos, total bytes, free accounts at the 10-photo limit, recent failures and the cleanup backlog without opening journal or image content.
- Treat 1,000,000 bytes as the exact processed-object ceiling. The private `journal-media` bucket accepts only WebP objects, while the authenticated Edge Function validates magic bytes, dimensions, ownership, consent, quota and optimistic replacement state.
- Keep exactly one `cleanup-journal-media` cron job scheduled hourly. It must use the same Vault and Edge `CRON_SECRET`; never place that secret in Render.
- Investigate cleanup retries through closed error codes and object counts. Do not paste private paths into support messages or founder reports.
- Grant or expire beta Premium access only through `media_entitlements` using an authenticated founder database session. Premium is not a checkout product in Build 3.3.2.
- If uploads fail, preserve text saving and existing photos first. A frontend rollback may leave the additive media schema and functions in place for old-client compatibility.
- Before account deletion, the `delete-account` Edge Function removes owned Storage objects through the Storage API. Database cascades then remove metadata and entitlements; the cleanup queue handles interrupted deletion attempts.
- Do not delete rows directly from `storage.objects`. Supabase Storage objects must be removed through the Storage API.
