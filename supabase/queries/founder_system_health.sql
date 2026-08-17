-- Founder Analytics: sanitized private-beta operational health
-- Closed feature/error codes only. No messages, URLs, stacks, browser data, or journal text.
select
  occurred_at::date as event_date,
  feature_area,
  error_code,
  count(*) as event_count,
  count(distinct user_id) as affected_accounts,
  count(*) filter (where user_id is null) as anonymous_events
from public.operational_events
where occurred_at >= now() - interval '30 days'
group by occurred_at::date, feature_area, error_code
order by event_date desc, event_count desc, feature_area, error_code;
