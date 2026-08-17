-- Founder Analytics: weekly-review delivery health
-- No journal content, provider response bodies, or recipient email addresses are returned.
select
  count(distinct p.user_id) filter (where p.weekly_review_enabled) as weekly_reviews_enabled,
  count(d.id) filter (where d.status = 'sent') as emails_sent,
  count(d.id) filter (where d.status = 'pending') as emails_pending,
  count(d.id) filter (where d.status = 'failed') as emails_failed,
  max(d.sent_at) filter (where d.status = 'sent') as latest_successful_delivery
from public.profiles p
left join public.email_deliveries d on d.user_id = p.user_id;
