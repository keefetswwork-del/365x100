begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

select has_table('public', 'writing_years', 'writing years are stored separately');
select has_column('public', 'entries', 'writing_year_id', 'entries are assigned to a writing year');
select ok(
  not has_function_privilege('anon', 'public.get_writing_year_dashboard()', 'EXECUTE'),
  'anonymous users cannot request writing-year progress'
);
select ok(
  has_function_privilege('authenticated', 'public.get_writing_year_dashboard()', 'EXECUTE'),
  'authenticated users can request writing-year progress'
);
select ok(
  not has_function_privilege('anon', 'public.accept_current_legal_documents()', 'EXECUTE'),
  'anonymous users cannot record legal acceptance'
);
select ok(
  has_function_privilege('authenticated', 'public.accept_current_legal_documents()', 'EXECUTE'),
  'authenticated users can record legal acceptance'
);

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000033a', 'beta-a@example.com', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-00000000033b', 'beta-b@example.com', 'authenticated', 'authenticated', now(), now());

insert into public.profiles (user_id, timezone)
values
  ('00000000-0000-0000-0000-00000000033a', 'UTC'),
  ('00000000-0000-0000-0000-00000000033b', 'Pacific/Auckland');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000033a', true);
select throws_ok(
  $$insert into public.writing_years (user_id, year_number, start_date, end_date)
    values ('00000000-0000-0000-0000-00000000033a', 1, '2026-01-01', '2026-12-31')$$,
  '42501',
  'permission denied for table writing_years',
  'browser clients cannot assign their own writing-year boundaries'
);
select is(
  public.save_entry('2026-01-01', 'first cloud entry', 100, 0)->>'status',
  'saved',
  'the unchanged legacy save RPC creates the first entry'
);
select is(
  (select start_date from public.writing_years where user_id = '00000000-0000-0000-0000-00000000033a' and year_number = 1),
  '2026-01-01'::date,
  'the first saved cloud entry establishes the initial Day 1 anchor'
);
select is(
  public.save_entry('2026-12-31', 'day three hundred sixty five', 5, 0)->>'status',
  'saved',
  'Day 365 saves through the existing RPC'
);
select is(
  (select wy.year_number from public.entries e join public.writing_years wy on wy.id = e.writing_year_id
    where e.user_id = '00000000-0000-0000-0000-00000000033a' and e.entry_date = '2026-12-31'),
  1,
  'Day 365 remains in writing year one'
);
select is(
  public.save_entry('2027-01-01', 'year two begins', 4, 0)->>'status',
  'saved',
  'the first day after a 365-day cycle saves normally'
);
select is(
  (select wy.year_number from public.entries e join public.writing_years wy on wy.id = e.writing_year_id
    where e.user_id = '00000000-0000-0000-0000-00000000033a' and e.entry_date = '2027-01-01'),
  2,
  'Day 366 is assigned to writing year two'
);
select is(
  (select count(*)::integer from public.writing_years where user_id = '00000000-0000-0000-0000-00000000033a'),
  2,
  'later cycles are created without duplicate boundaries'
);
select ok(
  (select writing_year_id is not null from public.entries
    where user_id = '00000000-0000-0000-0000-00000000033a' and entry_date = '2026-01-01'),
  'entry assignment is always server controlled'
);
select is(
  public.save_entry('2025-12-31', 'cached backfill before consent', 2, 0)->>'status',
  'saved',
  'a cached Build 3.2 client can backfill before consent seals the anchor'
);
select is(
  public.save_rich_entry(
    '2026-06-01',
    'rich compatible entry',
    $json${"schemaVersion":1,"editorState":{"root":{"children":[{"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"rich compatible entry","type":"text","version":1}],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}}$json$::jsonb,
    3,
    0
  )->>'status',
  'saved',
  'the unchanged rich save RPC remains compatible'
);
select ok(
  (select writing_year_id is not null and content_rich is not null from public.entries
    where user_id = '00000000-0000-0000-0000-00000000033a' and entry_date = '2026-06-01'),
  'rich entries retain formatting and receive a writing-year assignment'
);
select is(
  public.save_entry('2026-01-01', 'completion reversed', 2, 1)->>'status',
  'saved',
  'legacy clients can still reverse completion'
);
select ok(
  (select completed_at is null from public.entries
    where user_id = '00000000-0000-0000-0000-00000000033a' and entry_date = '2026-01-01'),
  'completion reversal still clears completed_at'
);
select ok(
  public.get_writing_year_dashboard()::text not like '%first cloud entry%'
    and public.get_writing_year_dashboard()::text not like '%rich compatible entry%',
  'writing-year progress never returns journal content'
);
select is(
  public.get_current_legal_status()->>'accepted',
  'false',
  'existing users require one-time acceptance of current legal versions'
);
select is(
  public.accept_current_legal_documents()->>'accepted',
  'true',
  'acceptance records both current legal documents'
);
select throws_ok(
  $$select public.save_entry('2025-12-30', 'before sealed anchor', 2, 0)$$,
  '22023',
  'Entry date is earlier than the permanent writing-year start',
  'legal acceptance seals the earliest entry as permanent Day 1'
);
select is(
  (select count(*)::integer from public.legal_acceptances where user_id = '00000000-0000-0000-0000-00000000033a'),
  2,
  'privacy and terms acceptance are stored separately'
);
select lives_ok(
  $$select public.accept_current_legal_documents()$$,
  'recording acceptance is idempotent'
);
select is(
  (select count(*)::integer from public.legal_acceptances where user_id = '00000000-0000-0000-0000-00000000033a'),
  2,
  'idempotent acceptance does not create duplicates'
);
select is(
  public.record_operational_event('entry-save', 'save-retry-exhausted', '33000000-0000-0000-0000-000000000001'),
  true,
  'an allow-listed sanitized operational event is recorded'
);
select throws_ok(
  $$select public.record_operational_event('journal-text', 'stack-trace', '33000000-0000-0000-0000-000000000001')$$,
  '22023',
  'Unknown operational event',
  'arbitrary operational fields are rejected'
);
select throws_ok(
  $$select * from public.operational_events$$,
  '42501',
  'permission denied for table operational_events',
  'browser clients cannot inspect private operational diagnostics'
);
select throws_ok(
  $$select public.record_product_event('monthly_chapter_eligible', null, '2026-01-10')$$,
  '42501',
  'Monthly eligibility is recorded by the server',
  'clients cannot self-award monthly chapter eligibility'
);
reset role;

update public.entries
set word_count = 100, completed_at = now()
where user_id = '00000000-0000-0000-0000-00000000033a' and entry_date = '2026-01-01';

insert into public.entries (user_id, entry_date, content, word_count, completed_at)
select
  '00000000-0000-0000-0000-00000000033a',
  ('2026-01-01'::date + day_offset),
  'completed monthly entry',
  100,
  now()
from generate_series(1, 8) as day_offset;

select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000033a'
      and event_name = 'monthly_chapter_eligible'),
  0,
  'nine completed days do not reach monthly eligibility'
);

insert into public.entries (user_id, entry_date, content, word_count, completed_at)
values ('00000000-0000-0000-0000-00000000033a', '2026-01-10', 'tenth completed entry', 100, now());

select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000033a'
      and event_name = 'monthly_chapter_eligible'),
  1,
  'the tenth completed day records monthly eligibility once'
);

update public.entries
set word_count = 99, completed_at = null
where user_id = '00000000-0000-0000-0000-00000000033a' and entry_date = '2026-01-10';
update public.entries
set word_count = 100, completed_at = now()
where user_id = '00000000-0000-0000-0000-00000000033a' and entry_date = '2026-01-10';

select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000033a'
      and event_name = 'monthly_chapter_eligible'),
  1,
  'monthly eligibility remains deduplicated after completion reversal'
);

insert into public.operational_events (user_id, feature_area, error_code, dedupe_key)
select
  '00000000-0000-0000-0000-00000000033a',
  'entry-save',
  'save-retry-exhausted',
  'rate-limit-test-' || number
from generate_series(1, 19) as number;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000033a', true);
select is(
  public.record_operational_event('entry-save', 'save-retry-exhausted', null),
  false,
  'operational events are rate limited per actor without throttling autosave'
);
select is(
  public.record_product_event('returned_next_day', null, '2026-01-02'),
  true,
  'existing product-event names and mappings remain available'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000033b', true);
select is(
  (select count(*)::integer from public.writing_years where user_id = '00000000-0000-0000-0000-00000000033a'),
  0,
  'RLS hides another user writing-year records'
);
select is(
  (select count(*)::integer from public.legal_acceptances where user_id = '00000000-0000-0000-0000-00000000033a'),
  0,
  'RLS hides another user legal acceptance records'
);
reset role;

delete from auth.users where id = '00000000-0000-0000-0000-00000000033a';
select is(
  (select count(*)::integer from public.entries where user_id = '00000000-0000-0000-0000-00000000033a'),
  0,
  'entries cascade when the account is deleted'
);
select is(
  (select count(*)::integer from public.writing_years where user_id = '00000000-0000-0000-0000-00000000033a'),
  0,
  'writing years cascade when the account is deleted'
);
select is(
  (select count(*)::integer from public.legal_acceptances where user_id = '00000000-0000-0000-0000-00000000033a'),
  0,
  'legal acceptances cascade when the account is deleted'
);
select is(
  (select count(*)::integer from public.operational_events where user_id = '00000000-0000-0000-0000-00000000033a'),
  0,
  'authenticated operational events cascade when the account is deleted'
);

select * from finish();
rollback;
