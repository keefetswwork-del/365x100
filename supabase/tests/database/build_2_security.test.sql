begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000000a', 'user-a@example.com', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', 'user-b@example.com', 'authenticated', 'authenticated', now(), now());

insert into public.profiles (user_id, timezone)
values
  ('00000000-0000-0000-0000-00000000000a', 'Asia/Singapore'),
  ('00000000-0000-0000-0000-00000000000b', 'UTC');

insert into public.entries (user_id, entry_date, content, word_count)
values
  ('00000000-0000-0000-0000-00000000000a', '2026-08-16', 'A private entry', 3),
  ('00000000-0000-0000-0000-00000000000b', '2026-08-16', 'B private entry', 3);

set local role anon;
select throws_ok(
  'select * from public.entries',
  '42501',
  'permission denied for table entries',
  'anonymous users cannot read journal entries'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select results_eq(
  'select content from public.entries order by content',
  $$values ('A private entry'::text)$$,
  'User A can read their own entry'
);
select is(
  (select count(*)::integer from public.entries where user_id = '00000000-0000-0000-0000-00000000000b'),
  0,
  'User A cannot read User B entries'
);
select throws_ok(
  $$insert into public.entries (user_id, entry_date, content) values ('00000000-0000-0000-0000-00000000000a', '2026-08-17', 'bypass')$$,
  '42501',
  'permission denied for table entries',
  'authenticated users cannot bypass the save RPC'
);

select is(
  public.save_entry('2026-08-16', 'A updated entry', 3, 1)->>'status',
  'saved',
  'matching versions save successfully'
);
select is(
  public.save_entry('2026-08-16', 'A stale overwrite', 3, 1)->>'status',
  'conflict',
  'stale versions return a conflict'
);
select is(
  (select content from public.entries where entry_date = '2026-08-16'),
  'A updated entry',
  'a conflict cannot overwrite newer content'
);
select throws_ok(
  $$select public.set_profile_timezone('Invalid/Timezone')$$,
  '22023',
  'Invalid IANA timezone',
  'profile timezones must be valid IANA names'
);
reset role;

select throws_ok(
  $$insert into public.entries (user_id, entry_date, content) values ('00000000-0000-0000-0000-00000000000a', '2026-08-16', 'duplicate')$$,
  '23505',
  'duplicate key value violates unique constraint "entries_user_id_entry_date_key"',
  'each user has at most one entry per date'
);

delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select is(
  (select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b'),
  0,
  'profile deletion cascades from auth.users'
);
select is(
  (select count(*)::integer from public.entries where user_id = '00000000-0000-0000-0000-00000000000b'),
  0,
  'entry deletion cascades from auth.users'
);
select * from finish();
rollback;
