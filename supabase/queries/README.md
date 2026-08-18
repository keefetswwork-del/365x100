# Founder Analytics

These read-only queries power the private Supabase `Founder Analytics` report. They deliberately exclude journal text, rich documents, search terms, session identifiers, tokens, IP addresses, and provider response bodies.

## Access

1. Open the Supabase `365x100` project (`dtctphqqupmxgdgodzxf`).
2. Open **SQL Editor** and save each `founder_*.sql` file as a private snippet using the display name below.
3. Open **Reports > Custom Reports**, create `Founder Analytics`, and add the saved snippets as report blocks.
4. Use the report's **Refresh** action to load current production data.

If Custom Reports is unavailable in the current dashboard, run the private snippets directly in SQL Editor. The returned result grids are the same report outputs.

## Report blocks

| File | Snippet name | Display |
| --- | --- | --- |
| `founder_overview.sql` | `Founder - Overview` | Table or headline values |
| `founder_daily_funnel.sql` | `Founder - Daily Funnel` | Multi-series line chart |
| `founder_writer_activity.sql` | `Founder - Writer Activity` | Private table |
| `founder_retention.sql` | `Founder - Retention` | Table or grouped chart |
| `founder_book_progress.sql` | `Founder - Book Progress` | Table |
| `founder_operational_health.sql` | `Founder - Operational Health` | Table or headline values |
| `founder_writing_year_progress.sql` | `Founder - Writing Years` | Private table |
| `founder_system_health.sql` | `Founder - System Health` | Table or grouped chart |
| `founder_writing_rhythm.sql` | `Founder - Writing Rhythm` | Table or grouped chart |

The report is manually refreshed. It does not send email reports or alter application data.

The system-health block contains only closed feature and error codes retained for 90 days. The writing-year block contains email-level aggregate progress for private founder use, but no journal content or internal identifiers.
