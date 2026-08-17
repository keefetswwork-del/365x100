create table public.writing_years (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year_number integer not null check (year_number >= 1),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, year_number),
  unique (user_id, start_date),
  check (end_date = start_date + 364)
);

create index writing_years_user_dates_idx
  on public.writing_years (user_id, start_date, end_date);

alter table public.entries
  add column writing_year_id uuid;

alter table public.writing_years enable row level security;
revoke all on table public.writing_years from anon, authenticated;
grant select on table public.writing_years to authenticated;
grant all on table public.writing_years to service_role;

create policy "Users can read their own writing years"
  on public.writing_years
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

with user_bounds as (
  select
    e.user_id,
    min(e.entry_date) as anchor_date,
    greatest(
      max(e.entry_date),
      coalesce((now() at time zone p.timezone)::date, max(e.entry_date))
    ) as horizon_date
  from public.entries e
  left join public.profiles p on p.user_id = e.user_id
  group by e.user_id, p.timezone
), generated_years as (
  select
    bounds.user_id,
    series.year_number,
    bounds.anchor_date + ((series.year_number - 1) * 365) as start_date
  from user_bounds bounds
  cross join lateral generate_series(
    1,
    ((bounds.horizon_date - bounds.anchor_date) / 365) + 1
  ) as series(year_number)
)
insert into public.writing_years (user_id, year_number, start_date, end_date)
select user_id, year_number, start_date, start_date + 364
from generated_years
on conflict (user_id, year_number) do nothing;

update public.entries e
set writing_year_id = wy.id
from public.writing_years wy
where wy.user_id = e.user_id
  and e.entry_date between wy.start_date and wy.end_date;

alter table public.entries
  alter column writing_year_id set not null,
  add constraint entries_writing_year_id_fkey
    foreign key (writing_year_id) references public.writing_years (id) on delete restrict;

create index entries_writing_year_idx
  on public.entries (writing_year_id, entry_date);

create or replace function public.ensure_writing_year_for_date(
  p_user_id uuid,
  p_entry_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anchor date;
  v_anchor_sealed boolean := false;
  v_horizon date;
  v_year_number integer;
  v_writing_year_id uuid;
begin
  if p_user_id is null or p_entry_date is null then
    raise exception 'User and entry date are required' using errcode = '22004';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 365100)
  );

  select min(start_date)
  into v_anchor
  from public.writing_years
  where user_id = p_user_id;

  if v_anchor is null then
    select least(coalesce(min(entry_date), p_entry_date), p_entry_date)
    into v_anchor
    from public.entries
    where user_id = p_user_id;
  end if;

  if p_entry_date < v_anchor then
    select exists (
      select 1
      from public.legal_acceptances
      where user_id = p_user_id
    ) into v_anchor_sealed;

    if v_anchor_sealed then
      raise exception 'Entry date is earlier than the permanent writing-year start'
        using errcode = '22023';
    end if;

    -- During rollout, cached Build 3.2 clients may backfill older entries before
    -- the one-time consent gate seals the earliest cloud entry as permanent Day 1.
    v_anchor := p_entry_date;

    update public.writing_years
    set start_date = date '1000-01-01' + ((year_number - 1) * 365),
        end_date = date '1000-01-01' + ((year_number - 1) * 365) + 364
    where user_id = p_user_id;

    update public.writing_years
    set start_date = v_anchor + ((year_number - 1) * 365),
        end_date = v_anchor + ((year_number - 1) * 365) + 364
    where user_id = p_user_id;

    select greatest(coalesce(max(entry_date), p_entry_date), p_entry_date)
    into v_horizon
    from public.entries
    where user_id = p_user_id;

    insert into public.writing_years (user_id, year_number, start_date, end_date)
    select
      p_user_id,
      series.year_number,
      v_anchor + ((series.year_number - 1) * 365),
      v_anchor + ((series.year_number - 1) * 365) + 364
    from generate_series(1, ((v_horizon - v_anchor) / 365) + 1) as series(year_number)
    on conflict (user_id, year_number) do nothing;

    update public.entries e
    set writing_year_id = wy.id
    from public.writing_years wy
    where e.user_id = p_user_id
      and wy.user_id = e.user_id
      and e.entry_date between wy.start_date and wy.end_date;
  end if;

  v_year_number := ((p_entry_date - v_anchor) / 365) + 1;

  insert into public.writing_years (user_id, year_number, start_date, end_date)
  select
    p_user_id,
    series.year_number,
    v_anchor + ((series.year_number - 1) * 365),
    v_anchor + ((series.year_number - 1) * 365) + 364
  from generate_series(1, v_year_number) as series(year_number)
  on conflict (user_id, year_number) do nothing;

  select id
  into v_writing_year_id
  from public.writing_years
  where user_id = p_user_id
    and year_number = v_year_number;

  return v_writing_year_id;
end;
$$;

create or replace function public.assign_entry_writing_year()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.writing_year_id := public.ensure_writing_year_for_date(
    new.user_id,
    new.entry_date
  );
  return new;
end;
$$;

create trigger assign_entry_writing_year
before insert or update of user_id, entry_date on public.entries
for each row execute function public.assign_entry_writing_year();

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
    count(*),
    coalesce(sum(word_count), 0)
  into v_completed_days, v_total_entries, v_total_words
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
    'totalWords', v_total_words
  );
end;
$$;

create table public.legal_document_versions (
  document_type text not null check (document_type in ('privacy', 'terms')),
  version text not null check (char_length(version) between 1 and 40),
  effective_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (document_type, version)
);

create unique index legal_document_versions_one_current_idx
  on public.legal_document_versions (document_type)
  where is_current;

insert into public.legal_document_versions (
  document_type, version, effective_date, is_current
) values
  ('privacy', '2026-08-17', '2026-08-17', true),
  ('terms', '2026-08-17', '2026-08-17', true);

create table public.legal_acceptances (
  user_id uuid not null references auth.users (id) on delete cascade,
  document_type text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, document_type, version),
  foreign key (document_type, version)
    references public.legal_document_versions (document_type, version)
    on delete restrict
);

create index legal_acceptances_user_time_idx
  on public.legal_acceptances (user_id, accepted_at desc);

alter table public.legal_document_versions enable row level security;
alter table public.legal_acceptances enable row level security;

revoke all on table public.legal_document_versions from anon, authenticated;
revoke all on table public.legal_acceptances from anon, authenticated;
grant select on table public.legal_document_versions to authenticated;
grant select on table public.legal_acceptances to authenticated;
grant all on table public.legal_document_versions to service_role;
grant all on table public.legal_acceptances to service_role;

create policy "Authenticated users can read current legal versions"
  on public.legal_document_versions
  for select
  to authenticated
  using (is_current);

create policy "Users can read their own legal acceptances"
  on public.legal_acceptances
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.get_current_legal_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then
      jsonb_build_object('authenticated', false, 'accepted', false)
    else jsonb_build_object(
      'authenticated', true,
      'accepted', count(*) = 2,
      'privacyVersion', max(v.version) filter (where v.document_type = 'privacy'),
      'termsVersion', max(v.version) filter (where v.document_type = 'terms')
    )
  end
  from public.legal_document_versions v
  left join public.legal_acceptances a
    on a.user_id = auth.uid()
   and a.document_type = v.document_type
   and a.version = v.version
  where v.is_current
    and (auth.uid() is null or a.user_id is not null);
$$;

create or replace function public.accept_current_legal_documents()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.legal_acceptances (user_id, document_type, version)
  select v_user_id, document_type, version
  from public.legal_document_versions
  where is_current
  on conflict (user_id, document_type, version) do nothing;

  return public.get_current_legal_status();
end;
$$;

create table public.operational_events (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  session_id uuid,
  feature_area text not null check (feature_area in (
    'auth',
    'entry-load',
    'entry-save',
    'export',
    'migration',
    'profile',
    'writing-year'
  )),
  error_code text not null check (error_code in (
    'auth-callback-failed',
    'entry-load-failed',
    'export-failed',
    'migration-failed',
    'otp-send-failed',
    'otp-verify-failed',
    'profile-load-failed',
    'save-retry-exhausted',
    'session-expired',
    'writing-year-load-failed'
  )),
  dedupe_key text not null unique,
  occurred_at timestamptz not null default now(),
  check (user_id is not null or session_id is not null)
);

create index operational_events_time_idx
  on public.operational_events (occurred_at desc, feature_area, error_code);

alter table public.operational_events enable row level security;
revoke all on table public.operational_events from anon, authenticated;
grant all on table public.operational_events to service_role;

create or replace function public.record_operational_event(
  p_feature_area text,
  p_error_code text,
  p_session_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_actor text;
  v_inserted bigint;
begin
  if p_feature_area not in (
    'auth', 'entry-load', 'entry-save', 'export', 'migration', 'profile', 'writing-year'
  ) or p_error_code not in (
    'auth-callback-failed', 'entry-load-failed', 'export-failed',
    'migration-failed', 'otp-send-failed', 'otp-verify-failed',
    'profile-load-failed', 'save-retry-exhausted', 'session-expired',
    'writing-year-load-failed'
  ) then
    raise exception 'Unknown operational event' using errcode = '22023';
  end if;

  if v_user_id is null and p_session_id is null then
    raise exception 'A session identifier is required' using errcode = '22023';
  end if;

  delete from public.operational_events
  where occurred_at < now() - interval '90 days';

  if (
    select count(*)
    from public.operational_events
    where occurred_at >= now() - interval '1 hour'
      and (
        (v_user_id is not null and user_id = v_user_id)
        or (v_user_id is null and session_id = p_session_id)
      )
  ) >= 20 then
    return false;
  end if;

  v_actor := coalesce(v_user_id::text, p_session_id::text);

  insert into public.operational_events (
    user_id, session_id, feature_area, error_code, dedupe_key
  ) values (
    v_user_id,
    case when v_user_id is null then p_session_id else null end,
    p_feature_area,
    p_error_code,
    p_feature_area || ':' || p_error_code || ':' || v_actor || ':' ||
      to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI')
  )
  on conflict (dedupe_key) do nothing
  returning id into v_inserted;

  return v_inserted is not null;
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
    'monthly_chapter_eligible'
  ));

create or replace function public.record_monthly_chapter_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completed_days integer;
  v_inserted bigint;
begin
  if new.word_count < 100
    or (tg_op = 'UPDATE' and old.word_count >= 100) then
    return new;
  end if;

  select count(*)
  into v_completed_days
  from public.entries
  where user_id = new.user_id
    and word_count >= 100
    and entry_date >= date_trunc('month', new.entry_date)::date
    and entry_date < (date_trunc('month', new.entry_date) + interval '1 month')::date;

  if v_completed_days >= 10 then
    insert into public.product_events (
      user_id, event_name, entry_date, dedupe_key
    ) values (
      new.user_id,
      'monthly_chapter_eligible',
      new.entry_date,
      'monthly_chapter_eligible:' || new.user_id::text || ':' || to_char(new.entry_date, 'YYYY-MM')
    )
    on conflict (dedupe_key) do nothing
    returning id into v_inserted;
  end if;

  return new;
end;
$$;

create trigger record_monthly_chapter_eligibility
after insert or update of word_count on public.entries
for each row execute function public.record_monthly_chapter_eligibility();

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
where word_count >= 100
group by user_id, date_trunc('month', entry_date), to_char(entry_date, 'YYYY-MM')
having count(*) >= 10
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
    'monthly_chapter_eligible'
  ) then
    raise exception 'Unknown product event' using errcode = '22023';
  end if;

  if p_event_name = 'monthly_chapter_eligible' then
    raise exception 'Monthly eligibility is recorded by the server' using errcode = '42501';
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

revoke all on function public.ensure_writing_year_for_date(uuid, date) from public;
revoke all on function public.assign_entry_writing_year() from public;
revoke all on function public.get_writing_year_dashboard() from public;
revoke all on function public.get_current_legal_status() from public;
revoke all on function public.accept_current_legal_documents() from public;
revoke all on function public.record_operational_event(text, text, uuid) from public;
revoke all on function public.record_monthly_chapter_eligibility() from public;

grant execute on function public.get_writing_year_dashboard() to authenticated;
grant execute on function public.get_current_legal_status() to authenticated;
grant execute on function public.accept_current_legal_documents() to authenticated;
grant execute on function public.record_operational_event(text, text, uuid) to anon, authenticated;
grant execute on function public.ensure_writing_year_for_date(uuid, date) to service_role;
