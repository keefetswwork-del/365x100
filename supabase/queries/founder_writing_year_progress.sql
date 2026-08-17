-- Founder Analytics: current personal writing-year progress
-- Private report only. Returns account email and aggregate counts, never entry text or IDs.
with writer_dates as (
  select
    u.id as user_id,
    u.email,
    u.created_at as signup_at,
    p.timezone,
    coalesce((now() at time zone p.timezone)::date, current_date) as local_today,
    min(e.entry_date) as anchor_date
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.entries e on e.user_id = u.id
  group by u.id, u.email, u.created_at, p.timezone
), current_years as (
  select
    d.*,
    wy.id as writing_year_id,
    wy.year_number,
    wy.start_date,
    wy.end_date
  from writer_dates d
  left join public.writing_years wy
    on wy.user_id = d.user_id
   and greatest(d.local_today, d.anchor_date) between wy.start_date and wy.end_date
)
select
  y.email,
  y.signup_at,
  y.timezone,
  y.year_number,
  case
    when y.start_date is null then null
    else greatest(y.local_today, y.anchor_date) - y.start_date + 1
  end as day_of_365,
  y.start_date,
  y.end_date,
  count(e.id) filter (where e.word_count > 0) as days_written,
  count(e.id) filter (where e.word_count >= 100) as completed_days,
  coalesce(sum(e.word_count), 0) as total_words
from current_years y
left join public.entries e on e.writing_year_id = y.writing_year_id
group by
  y.email,
  y.signup_at,
  y.timezone,
  y.year_number,
  y.start_date,
  y.end_date,
  y.local_today,
  y.anchor_date
order by completed_days desc, days_written desc, y.signup_at desc;
