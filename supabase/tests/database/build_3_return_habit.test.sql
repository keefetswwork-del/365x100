begin;

create extension if not exists pgtap with schema extensions;

select plan(40);

select is((select count(*)::integer from public.prompts), 150, 'the prompt library contains 150 prompts');
select is(
  (select count(*)::integer from (
    select category from public.prompts group by category having count(*) = 15
  ) balanced_categories),
  10,
  'each life-story category contains 15 prompts'
);
select ok(
  not has_function_privilege('anon', 'public.get_daily_prompt(date,boolean)', 'EXECUTE'),
  'anonymous users cannot request prompts'
);
select ok(
  not has_function_privilege('anon', 'public.get_habit_dashboard(date)', 'EXECUTE'),
  'anonymous users cannot request habit data'
);
select ok(
  not has_function_privilege('anon', 'public.set_habit_preferences(boolean,boolean,smallint,time without time zone,boolean)', 'EXECUTE'),
  'anonymous users cannot update habit preferences'
);

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000003a', 'habit-a@example.com', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-00000000003b', 'habit-b@example.com', 'authenticated', 'authenticated', now(), now());

insert into public.profiles (user_id, timezone)
values
  ('00000000-0000-0000-0000-00000000003a', 'UTC'),
  ('00000000-0000-0000-0000-00000000003b', 'Pacific/Auckland');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000003a', true);
select throws_ok(
  $$insert into public.prompts (body, category) values ('A prompt that bypasses the RPC boundary.', 'growth')$$,
  '42501',
  'permission denied for table prompts',
  'authenticated users cannot write prompts directly'
);
select throws_ok(
  $$select * from public.email_deliveries$$,
  '42501',
  'permission denied for table email_deliveries',
  'authenticated users cannot read service delivery diagnostics'
);
select ok(
  (public.set_habit_preferences(true, false, 7::smallint, '19:00'::time, true)).daily_prompts_enabled,
  'a user can opt into daily prompts'
);
select ok(
  (public.get_daily_prompt(current_date, false)).id is not null,
  'an opted-in user receives a prompt for today'
);
select is(
  (public.get_daily_prompt(current_date, false)).id,
  (select prompt_id from public.daily_prompt_assignments
    where user_id = '00000000-0000-0000-0000-00000000003a' and entry_date = current_date),
  'the prompt assignment is stable'
);
select isnt(
  (select prompt_id from public.daily_prompt_assignments
    where user_id = '00000000-0000-0000-0000-00000000003a' and entry_date = current_date),
  (public.get_daily_prompt(current_date, true)).id,
  'refreshing chooses and stores a different prompt'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000003b', true);
select is(
  (select count(*)::integer from public.daily_prompt_assignments
    where user_id = '00000000-0000-0000-0000-00000000003a'),
  0,
  'users cannot read another user prompt assignments'
);
reset role;

insert into public.entries (user_id, entry_date, content, word_count, completed_at)
select
  '00000000-0000-0000-0000-00000000003a',
  current_date - offset_day,
  'private completed writing',
  100,
  now()
from generate_series(1, 3) as offset_day;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000003a', true);
select is(
  public.save_entry(current_date, 'secret-habit-entry', 100, 0)->>'status',
  'saved',
  'today can be completed through the hardened save RPC'
);
select ok(
  (select completed_at is not null from public.entries where entry_date = current_date),
  'a 100-word entry records completion'
);
reset role;

select is(
  (select current_streak from public.habit_streaks('00000000-0000-0000-0000-00000000003a', current_date)),
  4,
  'the current streak includes today when today is complete'
);
select is(
  (select longest_streak from public.habit_streaks('00000000-0000-0000-0000-00000000003a', current_date)),
  4,
  'the longest streak is derived from completed entries'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000003a', true);
select is(
  public.save_entry(current_date, 'shortened', 1, 1)->>'status',
  'saved',
  'a completed entry can be reduced below 100 words'
);
select ok(
  (select completed_at is null from public.entries where entry_date = current_date),
  'reducing an entry below 100 words clears completion'
);
reset role;

select is(
  (select current_streak from public.habit_streaks('00000000-0000-0000-0000-00000000003a', current_date)),
  3,
  'the current streak keeps a through-today grace period'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000003a', true);
select ok(
  public.get_habit_dashboard(current_date)::text not like '%secret-habit-entry%'
    and public.get_habit_dashboard(current_date)::text not like '%private completed writing%',
  'habit summaries never return journal content'
);
select is(
  (public.get_habit_dashboard(current_date)->>'totalWords')::integer,
  301,
  'word statistics include complete and incomplete saved words'
);
select is(
  public.mark_welcome_back(current_date),
  current_date,
  'welcome-back acknowledgement is persisted for the profile-local today'
);
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.record_product_event('arbitrary_event', '10000000-0000-0000-0000-000000000001', current_date)$$,
  '22023',
  'Unknown product event',
  'analytics reject event names outside the allow-list'
);
select throws_ok(
  $$select public.record_product_event('editor_started', null, current_date)$$,
  '22023',
  'A session identifier is required',
  'anonymous events require a session identifier'
);
select is(
  public.record_product_event('editor_started', '10000000-0000-0000-0000-000000000001', current_date),
  true,
  'an allow-listed anonymous event is recorded'
);
select is(
  public.record_product_event('editor_started', '10000000-0000-0000-0000-000000000001', current_date),
  false,
  'duplicate analytics events are ignored'
);
select throws_ok(
  $$select * from public.product_events$$,
  '42501',
  'permission denied for table product_events',
  'browser roles cannot read private analytics rows'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000003a', true);
select is(
  public.record_product_event('signup_completed', null, current_date),
  true,
  'signed-in retention events derive the user identity from the JWT'
);
reset role;

update public.profiles
set weekly_review_enabled = true,
    weekly_review_day = extract(isodow from now() at time zone 'UTC')::smallint,
    weekly_review_time = ((now() at time zone 'UTC')::time - interval '1 minute')::time
where user_id = '00000000-0000-0000-0000-00000000003a';

set local role service_role;
select is(
  (select count(*)::integer from public.claim_due_weekly_reviews(now(), 50)),
  1,
  'the service claims one due weekly review and skips disabled users'
);
select is(
  (select count(*)::integer from public.claim_due_weekly_reviews(now(), 50)),
  0,
  'a claimed review is not claimed twice'
);
select is(
  (select count(*)::integer from public.email_deliveries
    where user_id = '00000000-0000-0000-0000-00000000003a'),
  1,
  'delivery records enforce one review per user and date'
);
select lives_ok(
  $$select public.finish_weekly_review(
    (select id from public.email_deliveries where user_id = '00000000-0000-0000-0000-00000000003a'),
    null,
    'resend_503'
  )$$,
  'a failed email is safely scheduled for retry'
);
select is(
  (select status from public.email_deliveries
    where user_id = '00000000-0000-0000-0000-00000000003a'),
  'failed',
  'failed deliveries retain a diagnostic status'
);
select ok(
  (select next_attempt_at is not null from public.email_deliveries
    where user_id = '00000000-0000-0000-0000-00000000003a'),
  'failed deliveries receive a capped retry time'
);
reset role;

update public.profiles
set weekly_review_enabled = false
where user_id = '00000000-0000-0000-0000-00000000003a';
update public.profiles
set timezone = 'America/New_York',
    weekly_review_enabled = true,
    weekly_review_day = 7,
    weekly_review_time = '01:30'
where user_id = '00000000-0000-0000-0000-00000000003b';

set local role service_role;
select is(
  (select count(*)::integer from public.claim_due_weekly_reviews('2026-11-01 05:30:00+00', 50)),
  1,
  'a review is due during the first occurrence of a DST fall-back hour'
);
select is(
  (select delivery_id from public.claim_due_weekly_reviews('2026-11-01 06:30:00+00', 50)),
  (select id from public.email_deliveries
    where user_id = '00000000-0000-0000-0000-00000000003b' and review_date = '2026-11-01'),
  'a repeated DST hour reuses the same idempotent delivery identifier'
);
reset role;

delete from auth.users where id = '00000000-0000-0000-0000-00000000003a';
select is(
  (select count(*)::integer from public.daily_prompt_assignments
    where user_id = '00000000-0000-0000-0000-00000000003a'),
  0,
  'prompt assignments cascade on account deletion'
);
select is(
  (select count(*)::integer from public.email_deliveries
    where user_id = '00000000-0000-0000-0000-00000000003a'),
  0,
  'email delivery diagnostics cascade on account deletion'
);
select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000003a'),
  0,
  'authenticated analytics events cascade on account deletion'
);
select is(
  (select count(*)::integer from public.profiles
    where user_id = '00000000-0000-0000-0000-00000000003a'),
  0,
  'habit preferences cascade on account deletion'
);

select * from finish();
rollback;
