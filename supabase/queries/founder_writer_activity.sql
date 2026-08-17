-- Founder Analytics: private writer activity table
-- This intentionally returns account email but never journal text or identifiers.
with user_facts as (
  select
    u.id,
    u.email,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email') as authentication_provider,
    u.created_at as signup_at,
    p.timezone,
    coalesce((now() at time zone p.timezone)::date, current_date) as local_today,
    min(e.entry_date) filter (where e.word_count > 0) as first_entry_date,
    max(e.entry_date) filter (where e.word_count > 0) as latest_entry_date,
    count(*) filter (where e.word_count > 0) as days_written,
    count(*) filter (where e.word_count >= 100) as completed_days,
    coalesce(sum(e.word_count), 0) as total_words
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.entries e on e.user_id = u.id
  group by u.id, u.email, u.raw_app_meta_data, u.created_at, p.timezone
)
select
  f.email,
  f.authentication_provider,
  f.signup_at,
  f.timezone,
  f.first_entry_date,
  f.latest_entry_date,
  f.days_written,
  f.completed_days,
  f.total_words,
  coalesce(s.current_streak, 0) as current_streak,
  case
    when f.latest_entry_date is null then 'Not started'
    when f.latest_entry_date >= f.local_today - 6 then 'Active'
    when f.latest_entry_date >= f.local_today - 29 then 'Cooling'
    else 'Inactive'
  end as activity_status
from user_facts f
left join lateral public.habit_streaks(f.id, f.local_today) s on true
order by f.latest_entry_date desc nulls last, f.signup_at desc;
