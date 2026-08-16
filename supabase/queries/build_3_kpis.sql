-- Run with a service or dashboard role. Browser roles cannot read this view.
-- Rates are directional product KPIs, not release acceptance tests.
with daily as (
  select
    event_date,
    coalesce(max(actor_count) filter (where event_name = 'editor_started'), 0) as editor_started,
    coalesce(max(actor_count) filter (where event_name = 'hundred_words_reached'), 0) as writing_completed,
    coalesce(max(actor_count) filter (where event_name = 'signup_started'), 0) as signup_started,
    coalesce(max(actor_count) filter (where event_name = 'signup_completed'), 0) as signup_completed,
    coalesce(max(actor_count) filter (where event_name = 'returned_next_day'), 0) as returned_next_day,
    coalesce(max(actor_count) filter (where event_name = 'seven_days_completed'), 0) as seven_days_completed
  from public.product_metrics_daily
  group by event_date
)
select
  event_date,
  editor_started,
  writing_completed,
  round(100.0 * writing_completed / nullif(editor_started, 0), 1) as writing_completion_percent,
  signup_started,
  signup_completed,
  round(100.0 * signup_completed / nullif(signup_started, 0), 1) as signup_conversion_percent,
  returned_next_day,
  round(100.0 * returned_next_day / nullif(signup_completed, 0), 1) as day_two_return_percent,
  seven_days_completed,
  round(100.0 * seven_days_completed / nullif(signup_completed, 0), 1) as seven_day_completion_percent
from daily
order by event_date desc;
