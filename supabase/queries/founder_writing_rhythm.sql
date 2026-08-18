-- Founder Analytics: forgiving Writing Rhythm and reactivation
-- Read-only. Returns counts and rates only; never journal text, excerpts, or search terms.
with writing_dates as (
  select
    e.user_id,
    e.entry_date,
    lag(e.entry_date) over (partition by e.user_id order by e.entry_date) as previous_writing_date
  from public.entries e
  where public.entry_has_visible_content(e.content)
),
writer_facts as (
  select
    a.user_id,
    a.first_writing_date,
    count(*) filter (
      where w.entry_date < a.first_writing_date + 7
    ) as first_week_writing_days,
    count(*) filter (
      where w.entry_date < a.first_writing_date + 30
    ) as first_30_day_writing_days,
    bool_or(w.entry_date - w.previous_writing_date >= 4) as returned_after_3_day_gap,
    bool_or(w.entry_date - w.previous_writing_date >= 8) as returned_after_7_day_gap,
    bool_or(w.entry_date - w.previous_writing_date >= 31) as returned_after_30_day_gap
  from (
    select user_id, min(entry_date) as first_writing_date
    from writing_dates
    group by user_id
  ) a
  join writing_dates w on w.user_id = a.user_id
  group by a.user_id, a.first_writing_date
),
monthly as (
  select
    date_trunc('month', entry_date)::date as month,
    count(distinct user_id) as writers,
    count(*) as writing_days,
    count(*) filter (where word_count < 100) as short_entries
  from public.entries
  where public.entry_has_visible_content(content)
  group by date_trunc('month', entry_date)
)
select
  m.month,
  m.writers,
  m.writing_days,
  round(m.writing_days::numeric / nullif(m.writers, 0), 1) as average_writing_days,
  round(100.0 * m.short_entries / nullif(m.writing_days, 0), 1) as short_entry_percent,
  round(100.0 * count(*) filter (where f.first_week_writing_days >= 3) / nullif(count(*), 0), 1) as three_days_first_week_percent,
  round(100.0 * count(*) filter (where f.first_30_day_writing_days >= 10) / nullif(count(*), 0), 1) as ten_days_first_30_percent,
  round(100.0 * count(*) filter (where f.returned_after_3_day_gap) / nullif(count(*), 0), 1) as returned_after_3_day_gap_percent,
  round(100.0 * count(*) filter (where f.returned_after_7_day_gap) / nullif(count(*), 0), 1) as returned_after_7_day_gap_percent,
  round(100.0 * count(*) filter (where f.returned_after_30_day_gap) / nullif(count(*), 0), 1) as returned_after_30_day_gap_percent
from monthly m
cross join writer_facts f
group by m.month, m.writers, m.writing_days, m.short_entries
order by m.month desc;
