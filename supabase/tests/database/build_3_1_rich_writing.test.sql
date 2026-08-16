begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_column('public', 'entries', 'content_rich', 'entries store optional rich content');
select ok(
  not has_function_privilege('anon', 'public.save_rich_entry(date,text,jsonb,integer,bigint)', 'EXECUTE'),
  'anonymous users cannot execute the rich save RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.save_rich_entry(date,text,jsonb,integer,bigint)', 'EXECUTE'),
  'authenticated users can execute the rich save RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.save_entry(date,text,integer,bigint)', 'EXECUTE'),
  'the legacy save RPC remains available to cached clients'
);

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000031a', 'rich-a@example.com', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-00000000031b', 'rich-b@example.com', 'authenticated', 'authenticated', now(), now());

insert into public.profiles (user_id, timezone)
values
  ('00000000-0000-0000-0000-00000000031a', 'Asia/Singapore'),
  ('00000000-0000-0000-0000-00000000031b', 'UTC');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000031a', true);
select is(
  public.save_rich_entry(
    '2026-08-16',
    'A formatted memory',
    $json${"schemaVersion":1,"editorState":{"root":{"children":[{"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"A formatted memory","type":"text","version":1}],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}}$json$::jsonb,
    3,
    0
  )->>'status',
  'saved',
  'a valid rich entry is saved'
);
select is(
  (select content from public.entries where entry_date = '2026-08-16'),
  'A formatted memory',
  'plain text remains the authoritative content projection'
);
select is(
  (select content_rich->>'schemaVersion' from public.entries where entry_date = '2026-08-16'),
  '1',
  'the versioned rich document is stored beside plain text'
);
select is(
  public.save_entry('2026-08-16', 'Updated by a cached client', 5, 1)->>'status',
  'saved',
  'a cached client can still update through the legacy RPC'
);
select is(
  (select content_rich is null from public.entries where entry_date = '2026-08-16'),
  true,
  'legacy saves clear stale formatting rather than mismatching the new plain text'
);
select is(
  public.save_rich_entry(
    '2026-08-16', 'Stale rich overwrite',
    $json${"schemaVersion":1,"editorState":{"root":{"children":[],"type":"root","version":1}}}$json$::jsonb,
    3, 1
  )->>'status',
  'conflict',
  'a stale rich version cannot overwrite newer content'
);
select throws_ok(
  $$select public.save_rich_entry('2026-08-17', 'invalid', '{"schemaVersion":2}'::jsonb, 1, 0)$$,
  '22023',
  'Invalid rich entry',
  'malformed or unsupported rich documents are rejected'
);
select throws_ok(
  $$insert into public.entries (user_id, entry_date, content) values ('00000000-0000-0000-0000-00000000031a', '2026-08-18', 'bypass')$$,
  '42501',
  'permission denied for table entries',
  'authenticated users still cannot bypass the save RPC'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000031b', true);
select is(
  (select count(*)::integer from public.entries where user_id = '00000000-0000-0000-0000-00000000031a'),
  0,
  'RLS hides rich entries from other users'
);
reset role;

delete from auth.users where id = '00000000-0000-0000-0000-00000000031a';
select is(
  (select count(*)::integer from public.entries where user_id = '00000000-0000-0000-0000-00000000031a'),
  0,
  'rich entries cascade when the account is deleted'
);

select * from finish();
rollback;
