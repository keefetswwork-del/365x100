-- Founder Analytics: 30-day anonymous and authenticated funnel
-- Actor counts are aggregate. No session or user identifiers are returned.
with days as (
  select generate_series(
    current_date - 29,
    current_date,
    interval '1 day'
  )::date as event_date
),
daily as (
  select
    event_date,
    coalesce(max(actor_count) filter (where event_name = 'editor_started'), 0) as editor_started,
    coalesce(max(actor_count) filter (where event_name = 'twenty_five_words_reached'), 0) as twenty_five_words,
    coalesce(max(actor_count) filter (where event_name = 'hundred_words_reached'), 0) as hundred_words,
    coalesce(max(actor_count) filter (where event_name = 'signup_started'), 0) as signup_started,
    coalesce(max(actor_count) filter (where event_name = 'signup_completed'), 0) as signup_completed
  from public.product_metrics_daily
  where event_date >= current_date - 29
  group by event_date
)
select
  d.event_date,
  coalesce(a.editor_started, 0) as editor_started,
  coalesce(a.twenty_five_words, 0) as twenty_five_words,
  coalesce(a.hundred_words, 0) as hundred_words,
  coalesce(a.signup_started, 0) as signup_started,
  coalesce(a.signup_completed, 0) as signup_completed,
  round(
    100.0 * coalesce(a.hundred_words, 0) / nullif(a.editor_started, 0),
    1
  ) as writing_completion_percent,
  round(
    100.0 * coalesce(a.signup_completed, 0) / nullif(a.signup_started, 0),
    1
  ) as signup_conversion_percent
from days d
left join daily a using (event_date)
order by d.event_date;
