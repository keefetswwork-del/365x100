# Build 3.4A Acceptance

Date: 19 August 2026

## Automated acceptance

| Criterion | Status | Evidence |
| --- | --- | --- |
| Existing Build 1-3.3.2 save paths remain compatible | Passed locally | Original RPC pgTAP coverage, authenticated browser regression, lint and TypeScript |
| Optional 120-character titles save, migrate, search and export | Passed locally | Unit, pgTAP and authenticated Playwright coverage |
| Ten visible-content days unlock an ended monthly chapter | Passed locally | 9/10 boundary pgTAP and Books browser flow |
| Original-only chapters work without AI entitlement | Passed locally | RLS/RPC pgTAP and Playwright |
| AI access, exact-month disclosure and credits are enforced | Passed locally | pgTAP, mocked Edge and Playwright |
| OpenAI request excludes photographs and private account data | Passed locally | Edge request-contract tests |
| Structured output, quotations and source references are validated | Passed locally | Unit and mocked Edge tests |
| Large months chunk only at entry boundaries | Passed locally | Edge tests |
| Draft editing, approval and section regeneration work | Passed locally | Playwright |
| Source text/title changes mark AI output stale and block PDF | Passed locally | Database triggers and Playwright |
| Rich/photo-only changes refresh layout without another AI request | Passed locally | Additive layout triggers and source fingerprints |
| Preview and A5 PDF use the same chronological document model | Passed locally | Unit parity model plus real browser PDF download |
| Private photograph renders in preview, cover and PDF | Passed locally | Real private WebP browser/PDF flow |
| English, Chinese, Malay, Tamil, punctuation and monochrome emoji render | Passed locally | Embedded Noto fonts and rendered-page visual inspection |
| Publication analytics and feedback contain no journal/generated text | Passed locally | Closed schema, hardened RPCs, private grants and pgTAP |
| Cross-user access and direct browser writes are denied | Passed locally | RLS, revoked grants and pgTAP |
| Annual Books remain gated | Passed | No annual UI or generation path is released |

## Production gates

| Criterion | Status |
| --- | --- |
| Remaining Build 3.3.2 production acceptance | Blocked pending founder checks |
| Encrypted production dump restored into isolated project | Blocked pending founder operation |
| Dedicated OpenAI project, data controls and US$25 alert | Blocked pending founder setup |
| Edge secrets configured | Blocked pending explicit secret checkpoint |
| Build 3.4A migration dry run and production apply | Not started |
| Existing-client save after backend rollout | Not started |
| `generate-publication` production deployment | Not started |
| Existing Render Static Site release | Not started |
| Monthly production acceptance | Not started |

Build 3.4A must not be described as production-complete while any production gate is blocked. Build 3.4B remains blocked until the separate ten-generation quality gate passes.
