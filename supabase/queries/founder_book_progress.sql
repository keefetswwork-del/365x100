-- Founder Analytics: monthly and annual book-progress aggregates
-- Only entry dates and counts are read; journal content is never selected.
with periods as (
  select
    'Month'::text as period_type,
    month_start::date as period_start,
    (month_start + interval '1 month - 1 day')::date as period_end
  from generate_series(
    date_trunc('month', current_date) - interval '11 months',
    date_trunc('month', current_date),
    interval '1 month'
  ) as month_start

  union all

  select
    'Year'::text as period_type,
    year_start::date as period_start,
    (year_start + interval '1 year - 1 day')::date as period_end
  from generate_series(
    date_trunc('year', current_date) - interval '2 years',
    date_trunc('year', current_date),
    interval '1 year'
  ) as year_start
),
period_metrics as (
  select
    p.period_type,
    p.period_start,
    p.period_end,
    count(distinct e.user_id) filter (where e.word_count > 0) as active_writers,
    count(*) filter (where e.word_count > 0) as total_entries,
    count(*) filter (where e.word_count >= 100) as completed_days,
    coalesce(sum(e.word_count), 0) as total_words
  from periods p
  left join public.entries e
    on e.entry_date between p.period_start and least(p.period_end, current_date)
  group by p.period_type, p.period_start, p.period_end
)
select
  period_type,
  period_start,
  least(period_end, current_date) as period_end,
  active_writers,
  total_entries,
  completed_days,
  total_words,
  round(completed_days::numeric / nullif(active_writers, 0), 1) as average_completed_days_per_writer
from period_metrics
order by
  case period_type when 'Month' then 1 else 2 end,
  period_start desc;
