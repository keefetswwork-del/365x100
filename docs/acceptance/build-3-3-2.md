# Build 3.3.2 Acceptance

Date: 18 August 2026

## Automated acceptance

| Criterion | Status | Evidence |
| --- | --- | --- |
| Existing Builds 1–3.3.1 remain compatible | Passed locally | Full TypeScript, ESLint, unit, pgTAP, Edge, Playwright and static-export suites |
| JPEG, PNG and WebP magic-byte validation | Passed locally | Unit and Edge tests reject forged and unsupported bytes |
| Exact 10,000,000-byte original limit | Passed locally | Unit boundary test |
| Exact 1,000,000-byte processed and Storage limit | Passed locally | Unit boundary and pgTAP bucket assertions |
| Orientation-aware browser decode, no enlargement and aspect ratio | Passed locally | Browser processing flow plus deterministic geometry tests |
| Browser canvas re-encoding strips original metadata | Passed by implementation | Only the canvas-produced WebP Blob is uploaded; the original is never transmitted |
| One private photo per entry | Passed locally | Unique database constraint and pgTAP |
| Free 9/10/11 quota and founder Premium grant | Passed locally | pgTAP |
| Idempotent upload and conflict-safe replacement/removal | Passed locally | Edge and pgTAP tests |
| Anonymous and cross-user access denial | Passed locally | RLS, revoked-write and Edge ownership tests |
| Photo-first entries do not become writing days without visible text | Passed locally | Browser journey and unchanged Writing Rhythm functions |
| Editor, Calendar and History presentation | Passed locally | Playwright mobile journey |
| Offline photo privacy and independent text saving | Passed locally | Playwright offline journey |
| ZIP archive includes processed photos and sanitized metadata | Passed locally | Unit streaming/Blob tests and Playwright download inspection |
| Account deletion removes Storage objects and media metadata | Passed locally | Edge test with a real private object |
| Journal content absent from media analytics | Passed locally | Closed database schema/RPC contracts and privacy assertions |
| Static export | Passed locally | `out/index.html`, legal routes, callback, robots and sitemap generated |

## Production acceptance

| Criterion | Status |
| --- | --- |
| Remote migration history and dry run | Passed founder deployment |
| Private bucket and policies | Passed production upload and cross-account checks |
| `journal-media`, cleanup, updated deletion and weekly-review functions | Passed founder deployment |
| Exactly one hourly cleanup cron | Scheduled; successful run remains TBC |
| Existing production client save after backend migration | Passed founder smoke test |
| Desktop Chrome/Edge upload and direct writable ZIP | Pending production test |
| Mobile Safari and Chrome upload | Pending production test |
| 9/10/11 production quota | Pending disposable-account test |
| Signed-URL expiry/refresh | Pending timed production test |
| Production account deletion and cleanup | Passed disposable-account test |
| Error-free production console and network privacy review | Pending production test |

## Offline startup hotfix

Production acceptance found that a signed-in account reopening while offline was shown the legal-consent gate again and could not restore cached writing. The client had persisted entries but not the server-confirmed legal versions and profile timezone, and treated a failed legal-status request as an unaccepted response.

The hotfix adds a user-scoped account bootstrap cache containing no journal content. Automated acceptance now covers offline reload, no repeated acceptance for the same versions, cached-only History, local dirty saves, reconnect reconciliation, conflict handling, missing-cache guidance, and account-deletion cleanup. Production verification remains pending the hotfix deployment.

## Known operational boundary

The Supabase Free storage allowance must be monitored through Founder Media Capacity before broad acquisition. Live off-site backups and a restore drill remain deferred; the operations runbook is not evidence that a recoverable backup exists.
