-- Founder - Media Capacity
-- Private aggregate report. Never selects filenames, paths, URLs, image data, entry text or device details.
with account_usage as (
  select
    m.user_id,
    count(*)::integer as attached_photos,
    sum(m.byte_size)::bigint as stored_bytes,
    public.current_media_tier(m.user_id) as entitlement
  from public.entry_media m
  group by m.user_id
), recent_events as (
  select
    count(*) filter (where event_name = 'photo_upload_completed')::integer as uploads_completed_30d,
    count(*) filter (where event_name in ('photo_processing_failed', 'photo_upload_failed'))::integer as failures_30d,
    count(*) filter (where event_name = 'free_photo_limit_reached')::integer as free_limit_events_30d
  from public.media_events
  where created_at >= now() - interval '30 days'
)
select
  count(*)::integer as users_with_photos,
  count(*) filter (where entitlement = 'free')::integer as free_users_with_photos,
  count(*) filter (where entitlement = 'premium')::integer as premium_users_with_photos,
  count(*) filter (where entitlement = 'free' and attached_photos >= 10)::integer as free_users_at_limit,
  coalesce(sum(attached_photos), 0)::integer as attached_photos,
  coalesce(sum(stored_bytes), 0)::bigint as stored_bytes,
  round(coalesce(sum(stored_bytes), 0)::numeric / 1000000000 * 100, 2) as free_project_storage_percent_estimate,
  (select count(*)::integer from public.media_cleanup_queue) as cleanup_backlog,
  (select count(*)::integer from public.media_cleanup_queue where attempts > 0) as cleanup_retries,
  recent_events.uploads_completed_30d,
  recent_events.failures_30d,
  recent_events.free_limit_events_30d
from account_usage
cross join recent_events
group by recent_events.uploads_completed_30d, recent_events.failures_30d, recent_events.free_limit_events_30d;
