create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  content text not null default '',
  word_count integer not null default 0 check (word_count >= 0),
  completed_at timestamptz,
  version bigint not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index entries_user_date_idx
  on public.entries (user_id, entry_date desc);

alter table public.profiles enable row level security;
alter table public.entries enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.entries from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.entries to authenticated;
grant all on table public.profiles to service_role;
grant all on table public.entries to service_role;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own entries"
  on public.entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.is_valid_timezone(value text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = value
  );
$$;

alter table public.profiles
  add constraint profiles_timezone_valid
  check (public.is_valid_timezone(timezone));

create or replace function public.set_profile_timezone(p_timezone text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not public.is_valid_timezone(p_timezone) then
    raise exception 'Invalid IANA timezone' using errcode = '22023';
  end if;

  insert into public.profiles (user_id, timezone)
  values (v_user_id, p_timezone)
  on conflict (user_id) do update
    set timezone = excluded.timezone,
        updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.save_entry(
  p_entry_date date,
  p_content text,
  p_word_count integer,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.entries;
  v_saved public.entries;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_entry_date is null or p_content is null or p_word_count is null then
    raise exception 'Entry date, content, and word count are required'
      using errcode = '22004';
  end if;

  if p_word_count < 0 then
    raise exception 'Word count cannot be negative' using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.entries
  where user_id = v_user_id
    and entry_date = p_entry_date
  for update;

  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      return jsonb_build_object('status', 'conflict', 'remote', null);
    end if;

    begin
      insert into public.entries (
        user_id,
        entry_date,
        content,
        word_count,
        completed_at
      )
      values (
        v_user_id,
        p_entry_date,
        p_content,
        p_word_count,
        case when p_word_count >= 100 then now() else null end
      )
      returning * into v_saved;

      return jsonb_build_object('status', 'saved', 'entry', to_jsonb(v_saved));
    exception
      when unique_violation then
        select *
        into v_existing
        from public.entries
        where user_id = v_user_id
          and entry_date = p_entry_date;

        return jsonb_build_object(
          'status', 'conflict',
          'remote', to_jsonb(v_existing)
        );
    end;
  end if;

  if v_existing.version <> coalesce(p_expected_version, 0) then
    return jsonb_build_object(
      'status', 'conflict',
      'remote', to_jsonb(v_existing)
    );
  end if;

  update public.entries
  set content = p_content,
      word_count = p_word_count,
      completed_at = case
        when p_word_count >= 100 then coalesce(completed_at, now())
        else completed_at
      end,
      version = version + 1,
      updated_at = now()
  where id = v_existing.id
  returning * into v_saved;

  return jsonb_build_object('status', 'saved', 'entry', to_jsonb(v_saved));
end;
$$;

revoke all on function public.is_valid_timezone(text) from public;
revoke all on function public.set_profile_timezone(text) from public;
revoke all on function public.save_entry(date, text, integer, bigint) from public;

grant execute on function public.is_valid_timezone(text) to authenticated;
grant execute on function public.is_valid_timezone(text) to service_role;
grant execute on function public.set_profile_timezone(text) to authenticated;
grant execute on function public.save_entry(date, text, integer, bigint) to authenticated;
