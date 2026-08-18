# Build 3.3 Acceptance Report

Date: 18 August 2026

This report separates automated verification from production acceptance. It contains no journal content or credentials.

## Automated acceptance

| Masterplan success condition | Status | Evidence |
| --- | --- | --- |
| Refresh and local draft recovery do not lose content | Passed | Anonymous and authenticated Playwright flows |
| Saving, saved and failed states are explicit | Passed | Save-queue tests and exact UI status contract |
| Temporary connection loss cannot silently overwrite newer content | Passed | Offline retry and conflict Playwright flow; queue tests |
| Rich text survives save, sign-out/sign-in and a second browser context | Passed | Authenticated rich restoration and toolbar Playwright flows |
| One entry per user and local calendar date | Passed | Database uniqueness and pgTAP regression suites |
| Midnight and timezone assignment remain correct | Passed | Timezone unit tests and unchanged profile-date behavior |
| Reaching 100 words completes a day | Passed | Unit, browser and database regression suites |
| Reducing an entry below 100 words reverses completion | Passed | Build 3 and Build 3.3 pgTAP tests |
| Earliest authenticated cloud entry establishes Day 1 | Passed | Build 3.3 pgTAP anchor and consent-sealing tests |
| Missed days do not postpone the writing-year end | Passed | Fixed 365-day arithmetic tests |
| Day X of 365 remains correct | Passed | Day 1, Day 365, leap-day and multi-year unit tests |
| Entries are assigned correctly at writing-year boundaries | Passed | Trigger and boundary pgTAP tests |
| Year 2 begins after Day 365 | Passed | Unit and pgTAP boundary tests |
| Legal links are visible and acceptance is recorded | Passed | New/existing-user Playwright flows and pgTAP tests |
| Feedback, data export and account deletion remain available | Passed | Browser, Edge Function and footer tests |
| Ordinary users cannot access beta administration | Passed | Revoked grants, RLS and pgTAP tests |
| Product and operational analytics exclude journal text | Passed | Closed database enums, private tables, query allow-list review and tests |
| Complete automated suite and static export pass | Passed | Database reset/lint/pgTAP, Edge, ESLint, TypeScript, 51 unit tests, 13 Playwright tests, and static build |

## Production acceptance

| Check | Status |
| --- | --- |
| Additive migration applied to production | Passed; local and remote migration history include `20260817233000` |
| Existing Build 3.2 client saves after migration | Passed; founder-confirmed cloud save and refresh restoration before the frontend release |
| Existing-account legal consent | Passed; founder-confirmed production acceptance and continued cloud saving |
| New-account legal consent | Pending a separate production signup test; automated coverage passes |
| Writing-year progress | Passed; founder-confirmed production Progress display |
| Authenticated cloud save and refresh restoration | Passed; founder-confirmed after the Build 3.3 release |
| Second-device rich restoration | Pending a separate production browser-context test; automated coverage passes |
| Founder writing-year and sanitized system-health snippets | Pending Supabase report setup |
| Render static deployment and desktop/mobile smoke test | Passed; commit `e84902d`, exported routes and icon assets returned 200, responsive layouts had no settled overflow, and the browser console had no errors |
| Favicon and search metadata | Passed; new PNG icon URLs and exact description are live, with the old favicon absent |

## Operational limitation

Off-site backup creation and a restore drill are **deferred**. The procedure is documented in `docs/operations/private-beta-runbook.md`, but it has not been exercised and must not be reported as passed.
