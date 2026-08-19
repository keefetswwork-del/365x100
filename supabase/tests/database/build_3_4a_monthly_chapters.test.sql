begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column('public', 'entries', 'title', 'entries have optional plain-text titles');
select has_table('public', 'publications', 'publication records exist');
select has_table('public', 'publication_versions', 'versioned editorial records exist');
select has_table('public', 'publication_sources', 'publications reference owned source versions');
select has_table('public', 'generation_jobs', 'idempotent generation jobs exist');
select ok(has_function_privilege('authenticated', 'public.save_entry_with_title(date,text,text,jsonb,integer,bigint)', 'EXECUTE'), 'authenticated clients can use the additive titled save RPC');
select ok(has_function_privilege('authenticated', 'public.save_entry(date,text,integer,bigint)', 'EXECUTE'), 'the original save RPC remains compatible');
select ok(not has_table_privilege('authenticated', 'public.publications', 'INSERT'), 'direct publication writes remain revoked');

insert into auth.users (id, email, aud, role, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000340a', 'chapter-a@example.com', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-00000000340b', 'chapter-b@example.com', 'authenticated', 'authenticated', now(), now());
insert into public.profiles (user_id, timezone) values
  ('00000000-0000-0000-0000-00000000340a', 'Asia/Singapore'),
  ('00000000-0000-0000-0000-00000000340b', 'Asia/Singapore');

insert into public.entries (user_id, entry_date, title, content, word_count)
select '00000000-0000-0000-0000-00000000340a', '2026-07-01'::date + day_number - 1,
  'Memory ' || day_number, 'visible memory ' || day_number, 3
from generate_series(1, 10) as day_number;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000340a', true);
select is((select (item->>'eligible')::boolean from jsonb_array_elements(public.get_publication_library()->'items') item where item->>'monthStart' = '2026-07-01'), true, 'ten visible-content days make an ended month eligible');
create temporary table created_publication as
select public.create_monthly_publication('2026-07-01', 'original') as value;
select is((select value->>'mode' from created_publication), 'original', 'every eligible user can create an original-only chapter');
select is((select value->>'state' from created_publication), 'ready', 'original-only chapters are immediately ready');
select is(public.record_publication_event('books_viewed', null), true, 'the closed analytics RPC records an allowed library event');
select throws_ok(
  $$select public.record_publication_event('journal_text', null)$$,
  '22023', 'Invalid publication event', 'publication analytics rejects arbitrary event names'
);
select throws_ok(
  $$insert into public.publications (user_id, scope, period_start, period_end) values ('00000000-0000-0000-0000-00000000340a', 'monthly', '2026-06-01', '2026-06-30')$$,
  '42501', 'permission denied for table publications', 'browser clients cannot bypass hardened publication RPCs'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000340b', true);
select is((select count(*)::integer from public.publications), 0, 'RLS hides another user''s publications');
select throws_ok(
  format('select public.get_publication_document(%L)', (select value->>'id' from created_publication)),
  'P0002', 'Publication not found', 'cross-user publication document access is denied'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000340a', true);
select is(
  public.save_entry('2026-07-01', 'updated through the old client', 5, 1)->'entry'->>'title',
  'Memory 1',
  'old clients can save content without clearing a title'
);
select is(
  public.save_entry_with_title('2026-07-02', 'A revised title', 'new client content', null, 3, 1)->'entry'->>'title',
  'A revised title',
  'the new RPC saves title and content atomically'
);
reset role;

insert into public.publication_entitlements (user_id, ai_enabled)
values ('00000000-0000-0000-0000-00000000340a', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000340a', true);
select is(public.create_monthly_publication('2026-07-01', 'ai')->>'mode', 'ai', 'founder entitlement enables an AI chapter');
select is(public.accept_ai_processing((select id from public.publications where user_id = '00000000-0000-0000-0000-00000000340a'))->>'accepted', 'true', 'AI consent is scoped to the owned chapter and current disclosure');
reset role;

select is((select count(*)::integer from public.publication_sources), 10, 'source references include each entry exactly once without duplicating journal text');
select is((select count(*)::integer from public.ai_processing_consents), 1, 'AI processing consent is recorded once');
select is((select count(*)::integer from public.publication_events where event_name = 'original_created'), 1, 'original chapter creation is recorded once');
select is((select count(*)::integer from public.publication_events where event_name = 'books_viewed'), 1, 'library views are privacy-safe and deduplicated');
select ok(not has_table_privilege('authenticated', 'public.publication_events', 'SELECT'), 'publication analytics remains founder-private');

delete from auth.users where id = '00000000-0000-0000-0000-00000000340a';
select is((select count(*)::integer from public.publications), 0, 'account deletion cascades through publication data');
select is((select count(*)::integer from public.generation_jobs), 0, 'account deletion leaves no generation jobs');

select * from finish();
rollback;
