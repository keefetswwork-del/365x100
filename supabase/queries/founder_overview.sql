-- Founder Analytics: headline cards
-- Read-only. Never add entries.content, entries.content_rich, or session identifiers.
-- Entry windows use each writer's confirmed local calendar date.
with users as (
  select
    u.id,
    u.created_at,
    coalesce((now() at time zone p.timezone)::date, current_date) as local_today
  from auth.users u
  left join public.profiles p on p.user_id = u.id
),
entry_metrics as (
  select
    count(*) filter (
      where e.word_count > 0
        and e.entry_date between u.local_today - 6 and u.local_today
    ) as entries_7_days,
    count(distinct e.user_id) filter (
      where e.word_count > 0
        and e.entry_date between u.local_today - 6 and u.local_today
    ) as active_writers_7_days,
    count(*) filter (
      where e.word_count > 0
        and e.entry_date between u.local_today - 29 and u.local_today
    ) as entries_30_days,
    count(*) filter (
      where e.word_count >= 100
        and e.entry_date between u.local_today - 29 and u.local_today
    ) as completed_entries_30_days,
    count(distinct e.user_id) filter (
      where e.word_count > 0
        and e.entry_date between u.local_today - 29 and u.local_today
    ) as active_writers_30_days,
    count(distinct e.user_id) filter (
      where e.word_count >= 100
        and e.entry_date between u.local_today - 29 and u.local_today
    ) as completed_writers_30_days,
    coalesce(sum(e.word_count) filter (
      where e.entry_date between u.local_today - 29 and u.local_today
    ), 0) as words_30_days
  from users u
  left join public.entries e on e.user_id = u.id
),
user_metrics as (
  select
    count(*) as registered_users,
    count(*) filter (where created_at >= now() - interval '30 days') as new_users_30_days
  from users
)
select
  um.registered_users,
  um.new_users_30_days,
  em.active_writers_7_days,
  em.active_writers_30_days,
  em.completed_writers_30_days,
  em.entries_30_days,
  em.completed_entries_30_days,
  em.words_30_days,
  round(
    100.0 * em.completed_entries_30_days / nullif(em.entries_30_days, 0),
    1
  ) as writing_completion_percent
from user_metrics um
cross join entry_metrics em;
