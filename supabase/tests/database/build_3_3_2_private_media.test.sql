begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'entry_media', 'private entry-media metadata exists');
select has_table('public', 'media_entitlements', 'founder-managed media entitlements exist');
select is(
  (select public from storage.buckets where id = 'journal-media'),
  false,
  'journal media uses a private Storage bucket'
);
select is(
  (select file_size_limit from storage.buckets where id = 'journal-media'),
  1000000::bigint,
  'the bucket rejects objects above exactly one million bytes'
);
select ok(
  not has_function_privilege('authenticated', 'public.commit_entry_media(uuid,uuid,uuid,text,integer,integer,integer,uuid,uuid,bigint)', 'EXECUTE'),
  'browser clients cannot commit media metadata directly'
);
select ok(
  has_function_privilege('service_role', 'public.commit_entry_media(uuid,uuid,uuid,text,integer,integer,integer,uuid,uuid,bigint)', 'EXECUTE'),
  'only the service path can commit media metadata'
);

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000332a', 'media-a@example.com', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-00000000332b', 'media-b@example.com', 'authenticated', 'authenticated', now(), now());

insert into public.profiles (user_id, timezone)
values
  ('00000000-0000-0000-0000-00000000332a', 'Asia/Singapore'),
  ('00000000-0000-0000-0000-00000000332b', 'UTC');

insert into public.legal_acceptances (user_id, document_type, version)
select '00000000-0000-0000-0000-00000000332a', 'terms', version
from public.legal_document_versions where document_type = 'terms' and is_current;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000332a', true);
select is(public.get_media_account_status()->>'privacyAccepted', 'false', 'the revised photo policy is initially pending');
select is(public.accept_media_privacy()->>'privacyAccepted', 'true', 'media consent records the current privacy version');
select is(public.get_current_legal_status()->>'accepted', 'true', 'media consent also satisfies the current account privacy version');
select throws_ok(
  $$insert into public.entry_media (id, user_id, entry_id, storage_path, byte_size, width, height, operation_id)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000332a', gen_random_uuid(), 'bypass.webp', 10, 10, 10, gen_random_uuid())$$,
  '42501',
  'permission denied for table entry_media',
  'authenticated users cannot bypass the media Edge Function'
);
reset role;

insert into public.entries (id, user_id, entry_date, content, word_count)
select
  ('00000000-0000-0000-0001-' || lpad(day_number::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-00000000332a',
  '2026-08-01'::date + day_number - 1,
  '',
  0
from generate_series(1, 11) as day_number;

create temporary table media_commit_results (number integer, result jsonb);
grant insert, select on media_commit_results to service_role;
set local role service_role;
insert into media_commit_results
select day_number, public.commit_entry_media(
  '00000000-0000-0000-0000-00000000332a',
  ('00000000-0000-0000-0001-' || lpad(day_number::text, 12, '0'))::uuid,
  ('00000000-0000-0000-0002-' || lpad(day_number::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-00000000332a/00000000-0000-0000-0001-' || lpad(day_number::text, 12, '0') || '/00000000-0000-0000-0002-' || lpad(day_number::text, 12, '0') || '.webp',
  1000000,
  2500,
  2500,
  ('00000000-0000-0000-0003-' || lpad(day_number::text, 12, '0'))::uuid
)
from generate_series(1, 10) as day_number;
reset role;

select is((select count(*)::integer from media_commit_results where result->>'status' = 'saved'), 10, 'the first ten free photos are accepted');
select is((select count(*)::integer from public.entry_media where user_id = '00000000-0000-0000-0000-00000000332a'), 10, 'one photo is attached to each of ten entries');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000332a', true);
select is(public.get_media_account_status()->>'canAdd', 'false', 'the free account blocks an eleventh attachment');
select is((public.get_media_account_status()->>'storedCount')::integer, 10, 'quota status reports ten current attachments');
reset role;

set local role service_role;
select is(
  public.commit_entry_media(
    '00000000-0000-0000-0000-00000000332a',
    '00000000-0000-0000-0001-000000000011',
    '00000000-0000-0000-0002-000000000011',
    '00000000-0000-0000-0000-00000000332a/00000000-0000-0000-0001-000000000011/00000000-0000-0000-0002-000000000011.webp',
    1000, 1200, 800, '00000000-0000-0000-0003-000000000011'
  )->>'status',
  'limit',
  'the service commit also enforces the free quota'
);
reset role;

insert into public.media_entitlements (user_id, tier)
values ('00000000-0000-0000-0000-00000000332a', 'premium');

set local role service_role;
select is(
  public.commit_entry_media(
    '00000000-0000-0000-0000-00000000332a',
    '00000000-0000-0000-0001-000000000011',
    '00000000-0000-0000-0002-000000000011',
    '00000000-0000-0000-0000-00000000332a/00000000-0000-0000-0001-000000000011/00000000-0000-0000-0002-000000000011.webp',
    1000, 1200, 800, '00000000-0000-0000-0003-000000000011'
  )->>'status',
  'saved',
  'a founder Premium grant removes the account photo limit'
);
select is(
  public.commit_entry_media(
    '00000000-0000-0000-0000-00000000332a',
    '00000000-0000-0000-0001-000000000011',
    '00000000-0000-0000-0002-000000000011',
    '00000000-0000-0000-0000-00000000332a/00000000-0000-0000-0001-000000000011/00000000-0000-0000-0002-000000000011.webp',
    1000, 1200, 800, '00000000-0000-0000-0003-000000000011'
  )->>'status',
  'saved',
  'replaying the same idempotency operation returns its original attachment'
);
reset role;

select is((select count(*)::integer from public.entry_media where entry_id = '00000000-0000-0000-0001-000000000011'), 1, 'idempotency never creates duplicate attachments');

set local role service_role;
select is(
  public.commit_entry_media(
    '00000000-0000-0000-0000-00000000332a',
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0004-000000000001',
    '00000000-0000-0000-0000-00000000332a/00000000-0000-0000-0001-000000000001/00000000-0000-0000-0004-000000000001.webp',
    900000, 2000, 1200, '00000000-0000-0000-0005-000000000001',
    '00000000-0000-0000-0002-000000000001', 1
  )->>'status',
  'saved',
  'a matching expected version atomically replaces the photo'
);
select is(
  public.commit_entry_media(
    '00000000-0000-0000-0000-00000000332a',
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0004-000000000002',
    '00000000-0000-0000-0000-00000000332a/00000000-0000-0000-0001-000000000001/00000000-0000-0000-0004-000000000002.webp',
    800000, 1800, 1000, '00000000-0000-0000-0005-000000000002',
    '00000000-0000-0000-0002-000000000001', 1
  )->>'status',
  'conflict',
  'a stale replacement cannot overwrite newer media'
);
reset role;

select is((select count(*)::integer from public.media_cleanup_queue where reason = 'replaced'), 1, 'successful replacement queues the old object for API deletion');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000332b', true);
select is((select count(*)::integer from public.entry_media where user_id = '00000000-0000-0000-0000-00000000332a'), 0, 'RLS hides another user photo metadata');
reset role;

delete from public.entries where id = '00000000-0000-0000-0001-000000000002';
select ok(
  exists(select 1 from public.media_cleanup_queue where storage_path like '%/00000000-0000-0000-0002-000000000002.webp'),
  'internal entry deletion queues its private object for cleanup'
);

delete from auth.users where id = '00000000-0000-0000-0000-00000000332a';
select is((select count(*)::integer from public.entry_media where user_id = '00000000-0000-0000-0000-00000000332a'), 0, 'account deletion cascades media metadata');
select is((select count(*)::integer from public.media_entitlements where user_id = '00000000-0000-0000-0000-00000000332a'), 0, 'account deletion cascades founder grants');

select * from finish();
rollback;
