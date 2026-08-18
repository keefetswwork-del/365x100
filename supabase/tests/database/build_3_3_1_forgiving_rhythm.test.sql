begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select ok(
  not has_function_privilege('anon', 'public.entry_has_visible_content(text)', 'EXECUTE'),
  'browser clients cannot call the internal visible-content helper'
);
select is(public.entry_has_visible_content(''), false, 'empty content is not a writing day');
select is(public.entry_has_visible_content(E' \n\t\r '), false, 'whitespace-only content is not a writing day');
select is(public.entry_has_visible_content(chr(160) || chr(8203) || chr(8205) || chr(65279)), false, 'invisible formatting content is not a writing day');
select is(public.entry_has_visible_content('🌻'), true, 'emoji-only content is a writing day');
select is(public.entry_has_visible_content('...'), true, 'punctuation-only content is a writing day');

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000331a', 'rhythm-a@example.com', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-0000-0000-00000000331b', 'rhythm-b@example.com', 'authenticated', 'authenticated', now(), now());

insert into public.profiles (user_id, timezone)
values
  ('00000000-0000-0000-0000-00000000331a', 'UTC'),
  ('00000000-0000-0000-0000-00000000331b', 'UTC');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000331a', true);
select is(
  public.save_entry('2026-06-20', '🌻', 0, 0)->>'status',
  'saved',
  'the unchanged save RPC stores a zero-word visible memory'
);
reset role;

insert into public.entries (user_id, entry_date, content, word_count)
select
  '00000000-0000-0000-0000-00000000331a',
  '2026-06-20'::date + day_offset,
  'memory ' || day_offset,
  2
from generate_series(1, 50) as day_offset;

select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000331a'
      and event_name = 'monthly_chapter_eligible'
      and dedupe_key like '%:2026-08'),
  0,
  'nine visible August writing days do not reach monthly eligibility'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000331a', true);
select is(
  (public.get_habit_dashboard('2026-08-01')->>'monthWritingDays')::integer,
  9,
  'Writing Rhythm counts nine current-month writing days'
);
reset role;

insert into public.entries (user_id, entry_date, content, word_count)
values ('00000000-0000-0000-0000-00000000331a', '2026-08-10', 'tenth memory', 2);

select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000331a'
      and event_name = 'monthly_chapter_eligible'
      and dedupe_key like '%:2026-08'),
  1,
  'the tenth visible writing day records monthly eligibility'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000331a', true);
select is(public.get_habit_dashboard('2026-08-01')->>'monthlyChapterEligible', 'true', 'the current month is eligible at ten writing days');
select is((public.get_habit_dashboard('2026-08-01')->>'monthlyChapterDaysRemaining')::integer, 0, 'eligible months have no remaining writing days');
reset role;

update public.entries
set content = E' \n\t ', word_count = 0
where user_id = '00000000-0000-0000-0000-00000000331a'
  and entry_date = '2026-08-10';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000331a', true);
select is((public.get_habit_dashboard('2026-08-01')->>'monthWritingDays')::integer, 9, 'clearing a memory recalculates the current monthly writing-day count');
select is(public.get_habit_dashboard('2026-08-01')->>'monthlyChapterEligible', 'false', 'current monthly eligibility reverses below ten writing days');
reset role;

select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000331a'
      and event_name = 'monthly_chapter_eligible'
      and dedupe_key like '%:2026-08'),
  1,
  'historical monthly threshold attainment remains recorded'
);

update public.entries
set content = 'restored tenth memory', word_count = 3
where user_id = '00000000-0000-0000-0000-00000000331a'
  and entry_date = '2026-08-10';

select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000331a'
      and event_name = 'monthly_chapter_eligible'
      and dedupe_key like '%:2026-08'),
  1,
  'monthly threshold events remain deduplicated after restoration'
);

insert into public.entries (user_id, entry_date, content, word_count)
select
  '00000000-0000-0000-0000-00000000331a',
  '2026-06-20'::date + day_offset,
  'memory ' || day_offset,
  2
from generate_series(52, 58) as day_offset;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000331a', true);
select is((public.get_writing_year_dashboard()->>'writingDays')::integer, 59, 'fifty-nine visible dates produce 59 writing days');
select is(public.get_writing_year_dashboard()->>'annualBookEligible', 'false', '59 writing days do not reach Annual Book eligibility');
reset role;

select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000331a'
      and event_name = 'annual_book_threshold_reached'),
  0,
  'the annual threshold event is absent at 59 writing days'
);

insert into public.entries (user_id, entry_date, content, word_count)
values ('00000000-0000-0000-0000-00000000331a', '2026-08-18', 'sixtieth memory', 2);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000331a', true);
select is((public.get_writing_year_dashboard()->>'writingDays')::integer, 60, 'the sixtieth visible date produces 60 writing days');
select is(public.get_writing_year_dashboard()->>'annualBookEligible', 'true', '60 writing days reach Annual Book eligibility');
select is((public.get_writing_year_dashboard()->>'annualBookDaysRemaining')::integer, 0, 'eligible Personal Years have no remaining writing days');
select is((public.get_writing_year_dashboard()->>'completedDays')::integer, 0, 'legacy 100-word completion remains separate from writing days');
select is((public.get_habit_dashboard('2026-08-01')->>'currentStreak')::integer, 0, 'legacy streaks still require the 100-word goal');
select is((public.get_habit_dashboard('2026-08-01')->>'lastSevenWritingDays')::integer, 7, 'the previous seven calendar days count distinct visible entries');
reset role;

select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000331a'
      and event_name = 'annual_book_threshold_reached'),
  1,
  'the sixtieth writing day records annual eligibility once'
);
select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000331a'
      and event_name = 'monthly_chapter_eligible'
      and dedupe_key like '%:2026-08'),
  1,
  'monthly eligibility remains deduplicated as more memories are added'
);

update public.entries
set content = '🌻', word_count = 0
where user_id = '00000000-0000-0000-0000-00000000331a'
  and entry_date = '2026-08-01';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000331a', true);
select ok(
  jsonb_path_exists(public.get_habit_dashboard('2026-08-01')->'calendar', '$[*] ? (@.entryDate == "2026-08-01" && @.hasWriting == true)'),
  'the calendar identifies an emoji-only memory as writing'
);
select ok(
  jsonb_path_exists(public.get_habit_dashboard('2026-08-01')->'calendar', '$[*] ? (@.entryDate == "2026-08-01" && @.completed == false)'),
  'emoji-only writing does not falsely reach the 100-word goal'
);
reset role;

select ok(
  (select count(*) > 0 from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000331a'
      and event_name = 'short_entry_saved'),
  'short visible entries produce privacy-safe server events'
);
select is(
  (select count(*)::integer from public.product_events
    where user_id = '00000000-0000-0000-0000-00000000331a'
      and event_name = 'backdated_entry_created'
      and entry_date = '2026-08-01'),
  1,
  'a backdated memory is recorded once without journal content'
);
select ok(
  (select e.writing_year_id = wy.id
    from public.entries e
    join public.writing_years wy on wy.user_id = e.user_id
      and e.entry_date between wy.start_date and wy.end_date
    where e.user_id = '00000000-0000-0000-0000-00000000331a'
      and e.entry_date = '2026-08-01'),
  'backdated memories retain the server-assigned Personal Year'
);

update public.entries
set content = E' \n\t ', word_count = 0
where user_id = '00000000-0000-0000-0000-00000000331a'
  and entry_date = '2026-08-18';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000331a', true);
select is((public.get_writing_year_dashboard()->>'writingDays')::integer, 59, 'clearing a memory recalculates Personal Year writing days');
select is(public.get_writing_year_dashboard()->>'annualBookEligible', 'false', 'current annual eligibility reverses below 60 writing days');
reset role;

select is((select count(*)::integer from public.product_events where user_id = '00000000-0000-0000-0000-00000000331a' and event_name = 'annual_book_threshold_reached'), 1, 'historical annual threshold attainment remains recorded');

update public.entries
set content = 'restored memory', word_count = 2
where user_id = '00000000-0000-0000-0000-00000000331a'
  and entry_date = '2026-08-18';

select is((select count(*)::integer from public.product_events where user_id = '00000000-0000-0000-0000-00000000331a' and event_name = 'annual_book_threshold_reached'), 1, 'annual threshold events remain deduplicated after restoration');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000331a', true);
select is(public.record_product_event('writing_rhythm_viewed', null, '2026-08-18'), true, 'clients can record the closed Writing Rhythm view event');
select throws_ok(
  $$select public.record_product_event('annual_book_threshold_reached', null, '2026-08-18')$$,
  '42501',
  'This event is recorded by the server',
  'clients cannot self-award Annual Book eligibility'
);
select ok(
  public.get_habit_dashboard('2026-08-01')::text not like '%restored memory%'
    and public.get_writing_year_dashboard()::text not like '%restored memory%',
  'rhythm dashboards never return journal content'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000331b', true);
select is(
  (select count(*)::integer from public.writing_years where user_id = '00000000-0000-0000-0000-00000000331a'),
  0,
  'RLS hides another user Personal Year records'
);

select * from finish();
rollback;
