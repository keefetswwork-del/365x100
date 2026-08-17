begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select ok(
  not has_function_privilege('anon', 'public.get_entry_history(text,date,date,date,integer)', 'EXECUTE'),
  'anonymous users cannot search journal history'
);
select ok(
  has_function_privilege('authenticated', 'public.get_entry_history(text,date,date,date,integer)', 'EXECUTE'),
  'authenticated users can request their own history'
);

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000032', 'history-a@example.com', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-000000000033', 'history-b@example.com', 'authenticated', 'authenticated', now(), now());

insert into public.profiles (user_id, timezone)
values
  ('00000000-0000-0000-0000-000000000032', 'UTC'),
  ('00000000-0000-0000-0000-000000000033', 'UTC');

insert into public.entries (user_id, entry_date, content, word_count, completed_at)
values
  ('00000000-0000-0000-0000-000000000032', '2026-01-01', 'Alice''s café memory 🌟', 4, null),
  ('00000000-0000-0000-0000-000000000032', '2026-01-02', E'Trip to Kyoto\nTemple bells', 100, now()),
  ('00000000-0000-0000-0000-000000000032', '2026-02-01', 'Punctuation: rain, rain!', 3, null),
  ('00000000-0000-0000-0000-000000000033', '2026-01-03', 'Alice private other-user writing', 100, now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000032', true);

select is(
  jsonb_array_length(public.get_entry_history(null, null, null, null, 30)->'items'),
  3,
  'empty search browses every owned entry'
);
select is(
  public.get_entry_history(null, null, null, null, 30)->'items'->0->>'entryDate',
  '2026-02-01',
  'history is newest first'
);
select is(
  jsonb_array_length(public.get_entry_history('ALICE''S', null, null, null, 30)->'items'),
  1,
  'search is case insensitive and preserves apostrophes'
);
select is(
  jsonb_array_length(public.get_entry_history('café', null, null, null, 30)->'items'),
  1,
  'search handles non-ASCII writing'
);
select is(
  jsonb_array_length(public.get_entry_history('🌟', null, null, null, 30)->'items'),
  1,
  'search handles emoji literally'
);
select is(
  jsonb_array_length(public.get_entry_history('rain, rain!', null, null, null, 30)->'items'),
  1,
  'search handles punctuation as a literal substring'
);
select is(
  jsonb_array_length(public.get_entry_history(null, '2026-01-01', '2026-01-31', null, 30)->'items'),
  2,
  'date filters bound history inclusively'
);
select ok(
  (public.get_entry_history(null, null, null, null, 2)->>'hasMore')::boolean,
  'a limited first page reports more entries'
);
select is(
  public.get_entry_history(null, null, null, null, 2)->>'nextCursor',
  '2026-01-02',
  'the next cursor is the oldest included date'
);
select is(
  jsonb_array_length(public.get_entry_history(null, null, null, '2026-01-02', 2)->'items'),
  1,
  'cursor pagination does not duplicate the prior page'
);
select ok(
  public.get_entry_history('Alice', null, null, null, 30)::text not like '%other-user writing%',
  'history never includes another user entry'
);
select throws_ok(
  $$select public.get_entry_history(repeat('x', 201), null, null, null, 30)$$,
  '22023',
  'Search query is too long',
  'overlong search terms are rejected without echoing content'
);
select throws_ok(
  $$select public.get_entry_history(null, '2026-02-01', '2026-01-01', null, 30)$$,
  '22023',
  'History date range is invalid',
  'invalid date ranges are rejected'
);
select throws_ok(
  $$select public.get_entry_history(null, null, null, null, 51)$$,
  '22023',
  'History page size must be between 1 and 50',
  'history pages are capped'
);

reset role;

insert into public.entries (user_id, entry_date, content, word_count)
select
  '00000000-0000-0000-0000-000000000032',
  day::date,
  'archive-memory-' || row_number() over (order by day),
  1
from generate_series('2023-01-01'::date, '2025-09-26'::date, interval '1 day') as day;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000032', true);

select is(
  jsonb_array_length(public.get_entry_history(null, null, null, null, 50)->'items'),
  50,
  'multi-year history remains bounded to the requested page size'
);
select is(
  jsonb_array_length(public.get_entry_history('archive-memory-731', null, null, null, 30)->'items'),
  1,
  'a literal search finds the correct entry in a multi-year journal'
);

reset role;
select * from finish();
rollback;
