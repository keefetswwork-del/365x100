-- Founder Analytics: retention cohorts anchored to each writer's first non-empty entry.
-- Next-day return means any non-empty entry on the following calendar date.
-- Seven-day achievement means reaching seven completed days at any point.
with writer_facts as (
  select
    u.id,
    min(e.entry_date) filter (where e.word_count > 0) as first_entry_date,
    count(*) filter (where e.word_count >= 100) as completed_days
  from auth.users u
  left join public.entries e on e.user_id = u.id
  group by u.id
),
activated as (
  select
    f.id,
    f.first_entry_date,
    date_trunc('week', f.first_entry_date)::date as first_entry_week,
    f.completed_days,
    exists (
      select 1
      from public.entries next_entry
      where next_entry.user_id = f.id
        and next_entry.entry_date = f.first_entry_date + 1
        and next_entry.word_count > 0
    ) as returned_next_calendar_day
  from writer_facts f
  where f.first_entry_date is not null
)
select
  first_entry_week,
  count(*) as activated_writers,
  count(*) filter (where returned_next_calendar_day) as returned_next_calendar_day,
  round(
    100.0 * count(*) filter (where returned_next_calendar_day) / nullif(count(*), 0),
    1
  ) as next_day_return_percent,
  count(*) filter (where completed_days >= 7) as reached_seven_completed_days,
  round(
    100.0 * count(*) filter (where completed_days >= 7) / nullif(count(*), 0),
    1
  ) as seven_day_achievement_percent
from activated
group by first_entry_week
order by first_entry_week desc;
