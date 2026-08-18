create or replace function public.entry_has_visible_content(p_content text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select length(regexp_replace(
    translate(p_content, chr(160) || chr(8203) || chr(8204) || chr(8205) || chr(8288) || chr(65279), ''),
    '[[:space:]]',
    '',
    'g'
  )) > 0;
$$;

create or replace function public.get_habit_dashboard(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_today date;
  v_month_start date;
  v_month_end date;
  v_current_month_start date;
  v_year_start date;
  v_current_streak integer := 0;
  v_longest_streak integer := 0;
  v_first_entry date;
  v_last_completed date;
  v_last_writing date;
  v_total_words bigint := 0;
  v_total_completed integer := 0;
  v_total_writing integer := 0;
  v_last_seven_writing integer := 0;
  v_month_words bigint := 0;
  v_month_completed integer := 0;
  v_month_writing integer := 0;
  v_year_words bigint := 0;
  v_year_completed integer := 0;
  v_year_writing integer := 0;
  v_calendar jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_profile
  from public.profiles
  where user_id = v_user_id;

  if not found then
    raise exception 'Profile required' using errcode = 'P0002';
  end if;

  v_today := (now() at time zone v_profile.timezone)::date;
  v_month_start := date_trunc('month', coalesce(p_month, v_today))::date;
  v_month_end := (v_month_start + interval '1 month - 1 day')::date;
  v_current_month_start := date_trunc('month', v_today)::date;
  v_year_start := date_trunc('year', v_today)::date;

  select current_streak, longest_streak
  into v_current_streak, v_longest_streak
  from public.habit_streaks(v_user_id, v_today);

  select
    min(entry_date),
    max(entry_date) filter (where word_count >= 100),
    max(entry_date) filter (where public.entry_has_visible_content(content)),
    coalesce(sum(word_count), 0),
    count(*) filter (where word_count >= 100),
    count(*) filter (where public.entry_has_visible_content(content))
  into
    v_first_entry,
    v_last_completed,
    v_last_writing,
    v_total_words,
    v_total_completed,
    v_total_writing
  from public.entries
  where user_id = v_user_id;

  select count(*) filter (where public.entry_has_visible_content(content))
  into v_last_seven_writing
  from public.entries
  where user_id = v_user_id
    and entry_date between v_today - 6 and v_today;

  select
    coalesce(sum(word_count), 0),
    count(*) filter (where word_count >= 100),
    count(*) filter (where public.entry_has_visible_content(content))
  into v_month_words, v_month_completed, v_month_writing
  from public.entries
  where user_id = v_user_id
    and entry_date between v_current_month_start and v_today;

  select
    coalesce(sum(word_count), 0),
    count(*) filter (where word_count >= 100),
    count(*) filter (where public.entry_has_visible_content(content))
  into v_year_words, v_year_completed, v_year_writing
  from public.entries
  where user_id = v_user_id
    and entry_date between v_year_start and v_today;

  select coalesce(jsonb_agg(jsonb_build_object(
    'entryDate', entry_date,
    'wordCount', word_count,
    'completed', word_count >= 100,
    'hasWriting', public.entry_has_visible_content(content)
  ) order by entry_date), '[]'::jsonb)
  into v_calendar
  from public.entries
  where user_id = v_user_id
    and entry_date between v_month_start and v_month_end;

  return jsonb_build_object(
    'today', v_today,
    'visibleMonth', v_month_start,
    'currentStreak', v_current_streak,
    'longestStreak', v_longest_streak,
    'firstEntryDate', v_first_entry,
    'lastCompletedDate', v_last_completed,
    'missedDays', case
      when v_last_completed is null then 0
      else greatest(v_today - v_last_completed - 1, 0)
    end,
    'lastWelcomeBackDate', v_profile.last_welcome_back_date,
    'totalWords', v_total_words,
    'totalCompletedDays', v_total_completed,
    'monthWords', v_month_words,
    'monthCompletedDays', v_month_completed,
    'monthElapsedDays', extract(day from v_today)::integer,
    'yearWords', v_year_words,
    'yearCompletedDays', v_year_completed,
    'yearElapsedDays', extract(doy from v_today)::integer,
    'calendar', v_calendar,
    'totalWritingDays', v_total_writing,
    'lastSevenWritingDays', v_last_seven_writing,
    'monthWritingDays', v_month_writing,
    'yearWritingDays', v_year_writing,
    'mostRecentWritingDate', v_last_writing,
    'daysSinceLastWriting', case
      when v_last_writing is null then 0
      else greatest(v_today - v_last_writing, 0)
    end,
    'monthlyChapterEligible', v_month_writing >= 10,
    'monthlyChapterDaysRemaining', greatest(10 - v_month_writing, 0)
  );
end;
$$;

create or replace function public.get_writing_year_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
  v_anchor date;
  v_writing_year public.writing_years;
  v_completed_days integer := 0;
  v_writing_days integer := 0;
  v_total_entries integer := 0;
  v_total_words bigint := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select timezone
  into v_timezone
  from public.profiles
  where user_id = v_user_id;

  if v_timezone is null then
    raise exception 'Profile required' using errcode = 'P0002';
  end if;

  v_today := (now() at time zone v_timezone)::date;

  select min(entry_date)
  into v_anchor
  from public.entries
  where user_id = v_user_id;

  if v_anchor is null then
    return jsonb_build_object(
      'hasWritingYear', false,
      'today', v_today
    );
  end if;

  perform public.ensure_writing_year_for_date(v_user_id, greatest(v_today, v_anchor));

  select *
  into v_writing_year
  from public.writing_years
  where user_id = v_user_id
    and greatest(v_today, v_anchor) between start_date and end_date;

  select
    count(*) filter (where word_count >= 100),
    count(*) filter (where public.entry_has_visible_content(content)),
    count(*),
    coalesce(sum(word_count), 0)
  into v_completed_days, v_writing_days, v_total_entries, v_total_words
  from public.entries
  where user_id = v_user_id
    and writing_year_id = v_writing_year.id;

  return jsonb_build_object(
    'hasWritingYear', true,
    'today', v_today,
    'yearNumber', v_writing_year.year_number,
    'dayNumber', greatest(v_today, v_anchor) - v_writing_year.start_date + 1,
    'startDate', v_writing_year.start_date,
    'endDate', v_writing_year.end_date,
    'completedDays', v_completed_days,
    'totalEntries', v_total_entries,
    'totalWords', v_total_words,
    'writingDays', v_writing_days,
    'annualBookEligible', v_writing_days >= 60,
    'annualBookDaysRemaining', greatest(60 - v_writing_days, 0)
  );
end;
$$;

alter table public.product_events
  drop constraint if exists product_events_event_name_check;

alter table public.product_events
  add constraint product_events_event_name_check
  check (event_name in (
    'editor_started',
    'twenty_five_words_reached',
    'hundred_words_reached',
    'signup_started',
    'signup_completed',
    'returned_next_day',
    'seven_days_completed',
    'monthly_chapter_eligible',
    'short_entry_saved',
    'backdated_entry_created',
    'writing_rhythm_viewed',
    'annual_book_threshold_reached',
    'welcome_back_message_shown'
  ));

drop trigger if exists record_monthly_chapter_eligibility on public.entries;
drop function if exists public.record_monthly_chapter_eligibility();

create function public.record_writing_rhythm_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_visible boolean := false;
  v_today date;
  v_month_writing_days integer := 0;
  v_year_writing_days integer := 0;
begin
  if tg_op = 'UPDATE' then
    v_was_visible := public.entry_has_visible_content(old.content);
  end if;

  if not public.entry_has_visible_content(new.content) then
    return new;
  end if;

  if new.word_count < 100 then
    insert into public.product_events (
      user_id, event_name, entry_date, dedupe_key
    ) values (
      new.user_id,
      'short_entry_saved',
      new.entry_date,
      'short_entry_saved:' || new.user_id::text || ':' || new.entry_date::text
    ) on conflict (dedupe_key) do nothing;
  end if;

  select (now() at time zone timezone)::date
  into v_today
  from public.profiles
  where user_id = new.user_id;

  if new.entry_date < v_today and not v_was_visible then
    insert into public.product_events (
      user_id, event_name, entry_date, dedupe_key
    ) values (
      new.user_id,
      'backdated_entry_created',
      new.entry_date,
      'backdated_entry_created:' || new.user_id::text || ':' || new.entry_date::text
    ) on conflict (dedupe_key) do nothing;
  end if;

  select count(*)
  into v_month_writing_days
  from public.entries
  where user_id = new.user_id
    and public.entry_has_visible_content(content)
    and entry_date >= date_trunc('month', new.entry_date)::date
    and entry_date < (date_trunc('month', new.entry_date) + interval '1 month')::date;

  if v_month_writing_days >= 10 then
    insert into public.product_events (
      user_id, event_name, entry_date, dedupe_key
    ) values (
      new.user_id,
      'monthly_chapter_eligible',
      new.entry_date,
      'monthly_chapter_eligible:' || new.user_id::text || ':' || to_char(new.entry_date, 'YYYY-MM')
    ) on conflict (dedupe_key) do nothing;
  end if;

  select count(*)
  into v_year_writing_days
  from public.entries
  where user_id = new.user_id
    and writing_year_id = new.writing_year_id
    and public.entry_has_visible_content(content);

  if v_year_writing_days >= 60 then
    insert into public.product_events (
      user_id, event_name, entry_date, dedupe_key
    ) values (
      new.user_id,
      'annual_book_threshold_reached',
      new.entry_date,
      'annual_book_threshold_reached:' || new.user_id::text || ':' || new.writing_year_id::text
    ) on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

create trigger record_writing_rhythm_events
after insert or update of content, word_count, writing_year_id on public.entries
for each row execute function public.record_writing_rhythm_events();

insert into public.product_events (
  user_id, event_name, entry_date, dedupe_key, occurred_at
)
select
  user_id,
  'short_entry_saved',
  entry_date,
  'short_entry_saved:' || user_id::text || ':' || entry_date::text,
  updated_at
from public.entries
where public.entry_has_visible_content(content)
  and word_count < 100
on conflict (dedupe_key) do nothing;

insert into public.product_events (
  user_id, event_name, entry_date, dedupe_key, occurred_at
)
select
  user_id,
  'monthly_chapter_eligible',
  max(entry_date),
  'monthly_chapter_eligible:' || user_id::text || ':' || to_char(entry_date, 'YYYY-MM'),
  max(updated_at)
from public.entries
where public.entry_has_visible_content(content)
group by user_id, date_trunc('month', entry_date), to_char(entry_date, 'YYYY-MM')
having count(*) >= 10
on conflict (dedupe_key) do nothing;

insert into public.product_events (
  user_id, event_name, entry_date, dedupe_key, occurred_at
)
select
  user_id,
  'annual_book_threshold_reached',
  max(entry_date),
  'annual_book_threshold_reached:' || user_id::text || ':' || writing_year_id::text,
  max(updated_at)
from public.entries
where public.entry_has_visible_content(content)
group by user_id, writing_year_id
having count(*) >= 60
on conflict (dedupe_key) do nothing;

create or replace function public.record_product_event(
  p_event_name text,
  p_session_id uuid default null,
  p_entry_date date default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_actor text;
  v_key text;
  v_inserted bigint;
begin
  if p_event_name not in (
    'editor_started',
    'twenty_five_words_reached',
    'hundred_words_reached',
    'signup_started',
    'signup_completed',
    'returned_next_day',
    'seven_days_completed',
    'monthly_chapter_eligible',
    'short_entry_saved',
    'backdated_entry_created',
    'writing_rhythm_viewed',
    'annual_book_threshold_reached',
    'welcome_back_message_shown'
  ) then
    raise exception 'Unknown product event' using errcode = '22023';
  end if;

  if p_event_name = 'monthly_chapter_eligible' then
    raise exception 'Monthly eligibility is recorded by the server' using errcode = '42501';
  end if;

  if p_event_name in (
    'short_entry_saved',
    'backdated_entry_created',
    'annual_book_threshold_reached',
    'welcome_back_message_shown'
  ) then
    raise exception 'This event is recorded by the server' using errcode = '42501';
  end if;

  if v_user_id is null and p_session_id is null then
    raise exception 'A session identifier is required' using errcode = '22023';
  end if;

  if p_entry_date is not null
    and (p_entry_date < current_date - 730 or p_entry_date > current_date + 1) then
    raise exception 'Event date is outside the accepted range' using errcode = '22023';
  end if;

  v_actor := coalesce(v_user_id::text, p_session_id::text);
  v_key := p_event_name || ':' || v_actor || ':' || coalesce(p_entry_date::text, 'session');

  insert into public.product_events (
    user_id, session_id, event_name, entry_date, dedupe_key
  ) values (
    v_user_id, p_session_id, p_event_name, p_entry_date, v_key
  )
  on conflict (dedupe_key) do nothing
  returning id into v_inserted;

  return v_inserted is not null;
end;
$$;

create or replace function public.mark_welcome_back(p_entry_date date)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select (now() at time zone timezone)::date
  into v_today
  from public.profiles
  where user_id = v_user_id;

  if v_today is null or p_entry_date is distinct from v_today then
    raise exception 'Welcome-back date must be today' using errcode = '22023';
  end if;

  update public.profiles
  set last_welcome_back_date = p_entry_date,
      updated_at = now()
  where user_id = v_user_id;

  insert into public.product_events (
    user_id, event_name, entry_date, dedupe_key
  ) values (
    v_user_id,
    'welcome_back_message_shown',
    p_entry_date,
    'welcome_back_message_shown:' || v_user_id::text || ':' || p_entry_date::text
  ) on conflict (dedupe_key) do nothing;

  return p_entry_date;
end;
$$;

drop function public.claim_due_weekly_reviews(timestamptz, integer);

create function public.claim_due_weekly_reviews(
  p_now timestamptz default now(),
  p_limit integer default 50
)
returns table (
  delivery_id uuid,
  user_id uuid,
  email text,
  review_date date,
  period_start date,
  period_end date,
  timezone text,
  current_streak integer,
  week_completed integer,
  week_words bigint,
  month_completed integer,
  month_words bigint,
  year_completed integer,
  year_words bigint,
  week_writing_days integer,
  month_writing_days integer,
  personal_year_writing_days integer,
  personal_year_words bigint,
  most_recent_writing_date date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_delivery public.email_deliveries;
  v_streak integer;
  v_writing_year_id uuid;
begin
  delete from public.product_events where occurred_at < p_now - interval '18 months';
  delete from public.email_deliveries where created_at < p_now - interval '90 days';

  for v_candidate in
    select p.*, u.email,
           p_now at time zone p.timezone as local_now
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.weekly_review_enabled
      and u.email is not null
      and extract(isodow from (p_now at time zone p.timezone))::integer = p.weekly_review_day
      and (p_now at time zone p.timezone)::time >= p.weekly_review_time
      and (p_now at time zone p.timezone) <
        date_trunc('day', p_now at time zone p.timezone)
        + p.weekly_review_time + interval '24 hours'
    order by p.user_id
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  loop
    insert into public.email_deliveries (
      user_id, review_date, period_start, period_end
    ) values (
      v_candidate.user_id,
      v_candidate.local_now::date,
      v_candidate.local_now::date - 6,
      v_candidate.local_now::date
    )
    on conflict on constraint email_deliveries_user_id_kind_review_date_key do update
    set status = 'pending',
        attempts = public.email_deliveries.attempts + 1,
        next_attempt_at = null,
        updated_at = p_now
    where (
        public.email_deliveries.status = 'failed'
        and public.email_deliveries.attempts < 5
        and public.email_deliveries.next_attempt_at <= p_now
      ) or (
        public.email_deliveries.status = 'pending'
        and public.email_deliveries.attempts < 5
        and public.email_deliveries.updated_at < p_now - interval '10 minutes'
      )
    returning * into v_delivery;

    if v_delivery.id is null then
      continue;
    end if;

    select s.current_streak into v_streak
    from public.habit_streaks(v_candidate.user_id, v_candidate.local_now::date) s;

    delivery_id := v_delivery.id;
    user_id := v_candidate.user_id;
    email := v_candidate.email;
    review_date := v_delivery.review_date;
    period_start := v_delivery.period_start;
    period_end := v_delivery.period_end;
    timezone := v_candidate.timezone;
    current_streak := coalesce(v_streak, 0);

    select
      count(*) filter (where word_count >= 100),
      coalesce(sum(word_count), 0),
      count(*) filter (where public.entry_has_visible_content(content))
    into week_completed, week_words, week_writing_days
    from public.entries
    where entries.user_id = v_candidate.user_id
      and entry_date between v_delivery.period_start and v_delivery.period_end;

    select
      count(*) filter (where word_count >= 100),
      coalesce(sum(word_count), 0),
      count(*) filter (where public.entry_has_visible_content(content))
    into month_completed, month_words, month_writing_days
    from public.entries
    where entries.user_id = v_candidate.user_id
      and entry_date between date_trunc('month', v_delivery.review_date)::date and v_delivery.review_date;

    select count(*) filter (where word_count >= 100), coalesce(sum(word_count), 0)
    into year_completed, year_words
    from public.entries
    where entries.user_id = v_candidate.user_id
      and entry_date between date_trunc('year', v_delivery.review_date)::date and v_delivery.review_date;

    select id
    into v_writing_year_id
    from public.writing_years
    where writing_years.user_id = v_candidate.user_id
      and v_delivery.review_date between start_date and end_date;

    select
      count(*) filter (where public.entry_has_visible_content(content)),
      coalesce(sum(word_count), 0)
    into personal_year_writing_days, personal_year_words
    from public.entries
    where entries.user_id = v_candidate.user_id
      and writing_year_id = v_writing_year_id;

    select max(entry_date) filter (where public.entry_has_visible_content(content))
    into most_recent_writing_date
    from public.entries
    where entries.user_id = v_candidate.user_id
      and entry_date <= v_delivery.review_date;

    return next;
  end loop;
end;
$$;

revoke all on function public.entry_has_visible_content(text) from public;
revoke all on function public.record_writing_rhythm_events() from public;
revoke all on function public.claim_due_weekly_reviews(timestamptz, integer) from public;

grant execute on function public.claim_due_weekly_reviews(timestamptz, integer) to service_role;
