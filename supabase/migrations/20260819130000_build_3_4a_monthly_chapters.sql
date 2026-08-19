alter table public.entries
  add column if not exists title text not null default '';

alter table public.entries
  add constraint entries_title_length check (char_length(title) <= 120);

create table public.publication_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_enabled boolean not null default false,
  generation_limit integer not null default 1 check (generation_limit between 0 and 20),
  section_regeneration_limit integer not null default 5 check (section_regeneration_limit between 0 and 100),
  expires_at timestamptz,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_disclosure_versions (
  version text primary key,
  is_current boolean not null default false,
  provider text not null check (provider = 'OpenAI'),
  retention_days integer not null check (retention_days between 0 and 30),
  created_at timestamptz not null default now()
);

create unique index ai_disclosure_one_current_idx
  on public.ai_disclosure_versions (is_current) where is_current;

insert into public.ai_disclosure_versions (version, is_current, provider, retention_days)
values ('2026-08-19', true, 'OpenAI', 30)
on conflict (version) do update set is_current = excluded.is_current;

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('monthly', 'annual')),
  period_start date not null,
  period_end date not null,
  writing_year_id uuid references public.writing_years(id) on delete cascade,
  mode text not null default 'original' check (mode in ('original', 'ai')),
  state text not null default 'eligible' check (state in ('eligible', 'generating', 'draft', 'ready', 'stale', 'failed')),
  title text not null default '' check (char_length(title) <= 120),
  cover_media_id uuid references public.entry_media(id) on delete set null,
  editorial_fingerprint text,
  layout_fingerprint text not null default '',
  stale_reason text check (stale_reason is null or stale_reason in ('source-text', 'source-title')),
  layout_version integer not null default 1 check (layout_version > 0),
  generation_count integer not null default 0 check (generation_count >= 0),
  section_regeneration_count integer not null default 0 check (section_regeneration_count >= 0),
  current_draft_version_id uuid,
  approved_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publications_valid_period check (period_end >= period_start),
  constraint publications_scope_period check (
    (scope = 'monthly' and period_start = date_trunc('month', period_start)::date
      and period_end = (period_start + interval '1 month - 1 day')::date)
    or scope = 'annual'
  ),
  unique (user_id, scope, period_start)
);

create table public.publication_versions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  editorial jsonb not null,
  source_fingerprint text not null,
  model text,
  prompt_version text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_usd numeric(10, 4) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  approval_state text not null default 'draft' check (approval_state in ('draft', 'approved', 'superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, version_number)
);

alter table public.publications
  add constraint publications_current_draft_version_fkey
  foreign key (current_draft_version_id) references public.publication_versions(id) on delete set null;

alter table public.publications
  add constraint publications_approved_version_fkey
  foreign key (approved_version_id) references public.publication_versions(id) on delete set null;

create table public.publication_sources (
  publication_id uuid not null references public.publications(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  entry_version bigint not null,
  title_fingerprint text not null,
  content_fingerprint text not null,
  rich_fingerprint text not null,
  media_id uuid references public.entry_media(id) on delete set null,
  media_version bigint,
  created_at timestamptz not null default now(),
  primary key (publication_id, entry_id)
);

create table public.ai_processing_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  disclosure_version text not null references public.ai_disclosure_versions(version),
  publication_id uuid not null references public.publications(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key (user_id, disclosure_version, publication_id)
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.publications(id) on delete cascade,
  idempotency_key uuid not null,
  job_kind text not null check (job_kind in ('full', 'title', 'review', 'themes', 'moments', 'quotations')),
  state text not null default 'pending' check (state in ('pending', 'running', 'succeeded', 'failed')),
  lease_expires_at timestamptz,
  failure_code text check (failure_code is null or failure_code in ('invalid-output', 'model-refused', 'provider', 'spend-limit', 'source-changed', 'unauthorized')),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_usd numeric(10, 4) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.publication_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.publications(id) on delete cascade,
  verdict text not null check (verdict in ('accurate', 'needs-review', 'invented-fact')),
  created_at timestamptz not null default now(),
  unique (user_id, publication_id)
);

create table public.publication_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid references public.publications(id) on delete cascade,
  event_name text not null check (event_name in ('books_viewed', 'original_created', 'ai_started', 'ai_completed', 'ai_failed', 'section_regenerated', 'chapter_approved', 'pdf_downloaded')),
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create index publications_user_period_idx on public.publications (user_id, scope, period_start desc);
create index publication_versions_publication_idx on public.publication_versions (publication_id, version_number desc);
create index generation_jobs_publication_idx on public.generation_jobs (publication_id, created_at desc);

create or replace function public.mark_publications_from_entry_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.publications set
    state = case
      when mode = 'ai' and editorial_fingerprint is not null
        and (new.title is distinct from old.title or new.content is distinct from old.content)
      then 'stale'
      else state
    end,
    stale_reason = case
      when mode = 'ai' and editorial_fingerprint is not null and new.content is distinct from old.content then 'source-text'
      when mode = 'ai' and editorial_fingerprint is not null and new.title is distinct from old.title then 'source-title'
      else stale_reason
    end,
    layout_version = case when new.content_rich is distinct from old.content_rich then layout_version + 1 else layout_version end,
    updated_at = now()
  where user_id = new.user_id and new.entry_date between period_start and period_end;
  return new;
end;
$$;

create trigger mark_publications_from_entry_change
after update of title, content, content_rich on public.entries
for each row execute function public.mark_publications_from_entry_change();

create or replace function public.mark_publication_layout_from_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_entry_id uuid; v_user_id uuid; v_date date;
begin
  v_entry_id := case when tg_op = 'DELETE' then old.entry_id else new.entry_id end;
  select user_id, entry_date into v_user_id, v_date from public.entries where id = v_entry_id;
  update public.publications set layout_version = layout_version + 1, updated_at = now()
  where user_id = v_user_id and v_date between period_start and period_end;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger mark_publication_layout_from_media
after insert or update or delete on public.entry_media
for each row execute function public.mark_publication_layout_from_media();

alter table public.publication_entitlements enable row level security;
alter table public.ai_disclosure_versions enable row level security;
alter table public.publications enable row level security;
alter table public.publication_versions enable row level security;
alter table public.publication_sources enable row level security;
alter table public.ai_processing_consents enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.publication_feedback enable row level security;
alter table public.publication_events enable row level security;

create policy publication_entitlements_select_own on public.publication_entitlements
  for select to authenticated using (user_id = auth.uid());
create policy ai_disclosure_versions_read_current on public.ai_disclosure_versions
  for select to authenticated using (is_current);
create policy publications_select_own on public.publications
  for select to authenticated using (user_id = auth.uid());
create policy publication_versions_select_own on public.publication_versions
  for select to authenticated using (exists (
    select 1 from public.publications p where p.id = publication_id and p.user_id = auth.uid()
  ));
create policy publication_sources_select_own on public.publication_sources
  for select to authenticated using (exists (
    select 1 from public.publications p where p.id = publication_id and p.user_id = auth.uid()
  ));
create policy ai_processing_consents_select_own on public.ai_processing_consents
  for select to authenticated using (user_id = auth.uid());
create policy generation_jobs_select_own on public.generation_jobs
  for select to authenticated using (user_id = auth.uid());
create policy publication_feedback_select_own on public.publication_feedback
  for select to authenticated using (user_id = auth.uid());

revoke all on public.publication_entitlements from anon, authenticated;
revoke all on public.ai_disclosure_versions from anon, authenticated;
revoke all on public.publications from anon, authenticated;
revoke all on public.publication_versions from anon, authenticated;
revoke all on public.publication_sources from anon, authenticated;
revoke all on public.ai_processing_consents from anon, authenticated;
revoke all on public.generation_jobs from anon, authenticated;
revoke all on public.publication_feedback from anon, authenticated;
revoke all on public.publication_events from anon, authenticated;

grant select on public.publication_entitlements to authenticated;
grant select on public.ai_disclosure_versions to authenticated;
grant select on public.publications to authenticated;
grant select on public.publication_versions to authenticated;
grant select on public.publication_sources to authenticated;
grant select on public.ai_processing_consents to authenticated;
grant select on public.generation_jobs to authenticated;
grant select on public.publication_feedback to authenticated;
grant all on public.publication_entitlements to service_role;
grant all on public.ai_disclosure_versions to service_role;
grant all on public.publications to service_role;
grant all on public.publication_versions to service_role;
grant all on public.publication_sources to service_role;
grant all on public.ai_processing_consents to service_role;
grant all on public.generation_jobs to service_role;
grant all on public.publication_feedback to service_role;
grant all on public.publication_events to service_role;

create or replace function public.save_entry_with_title(
  p_entry_date date,
  p_title text,
  p_content text,
  p_content_rich jsonb,
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
  v_title text := coalesce(p_title, '');
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_entry_date is null or p_content is null or p_word_count is null then
    raise exception 'Entry date, content, and word count are required' using errcode = '22004';
  end if;
  if char_length(v_title) > 120 or p_word_count < 0
    or (p_content_rich is not null and not public.is_valid_rich_entry(p_content_rich)) then
    raise exception 'Invalid titled entry' using errcode = '22023';
  end if;

  select * into v_existing from public.entries
  where user_id = v_user_id and entry_date = p_entry_date for update;

  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      return jsonb_build_object('status', 'conflict', 'remote', null);
    end if;
    begin
      insert into public.entries (user_id, entry_date, title, content, content_rich, word_count, completed_at)
      values (v_user_id, p_entry_date, v_title, p_content, p_content_rich, p_word_count,
        case when p_word_count >= 100 then now() else null end)
      returning * into v_saved;
      return jsonb_build_object('status', 'saved', 'entry', to_jsonb(v_saved));
    exception when unique_violation then
      select * into v_existing from public.entries where user_id = v_user_id and entry_date = p_entry_date;
      return jsonb_build_object('status', 'conflict', 'remote', to_jsonb(v_existing));
    end;
  end if;

  if v_existing.version <> coalesce(p_expected_version, 0) then
    return jsonb_build_object('status', 'conflict', 'remote', to_jsonb(v_existing));
  end if;

  update public.entries set
    title = v_title,
    content = p_content,
    content_rich = p_content_rich,
    word_count = p_word_count,
    completed_at = case when p_word_count >= 100 then coalesce(completed_at, now()) else null end,
    version = version + 1,
    updated_at = now()
  where id = v_existing.id returning * into v_saved;

  return jsonb_build_object('status', 'saved', 'entry', to_jsonb(v_saved));
end;
$$;

create or replace function public.get_entry_history(
  p_query text default null,
  p_from_date date default null,
  p_to_date date default null,
  p_before_date date default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_query text := nullif(btrim(p_query), '');
  v_items jsonb := '[]'::jsonb;
  v_has_more boolean := false;
  v_next_cursor date;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if v_query is not null and char_length(v_query) > 200 then raise exception 'Search query is too long' using errcode = '22023'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then raise exception 'History page size must be between 1 and 50' using errcode = '22023'; end if;
  if p_from_date is not null and p_to_date is not null and p_from_date > p_to_date then raise exception 'History date range is invalid' using errcode = '22023'; end if;

  with candidates as (
    select e.entry_date, e.title, e.word_count, e.updated_at, e.word_count >= 100 as completed,
      regexp_replace(e.content, E'[\n\r\t ]+', ' ', 'g') as normalized_content,
      m.id as media_id, m.storage_path, m.byte_size, m.width, m.height,
      m.version as media_version, m.created_at as media_created_at, m.updated_at as media_updated_at
    from public.entries e left join public.entry_media m on m.entry_id = e.id
    where e.user_id = v_user_id
      and (p_from_date is null or e.entry_date >= p_from_date)
      and (p_to_date is null or e.entry_date <= p_to_date)
      and (p_before_date is null or e.entry_date < p_before_date)
      and (v_query is null or strpos(lower(e.content), lower(v_query)) > 0 or strpos(lower(e.title), lower(v_query)) > 0)
    order by e.entry_date desc limit p_limit + 1
  ), ranked as (
    select c.*, row_number() over (order by c.entry_date desc) as row_number from candidates c
  ), page as (
    select r.*, case
      when r.normalized_content = '' and r.media_id is not null then 'Photo saved; no words yet.'
      when v_query is null or strpos(lower(r.title), lower(v_query)) > 0 then left(r.normalized_content, 180)
      else substring(r.normalized_content from greatest(strpos(lower(r.normalized_content), lower(v_query)) - 80, 1) for 240)
    end as excerpt from ranked r where r.row_number <= p_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'entryDate', p.entry_date, 'title', p.title, 'excerpt', p.excerpt, 'wordCount', p.word_count,
      'completed', p.completed, 'updatedAt', p.updated_at,
      'media', case when p.media_id is null then null else jsonb_build_object(
        'id', p.media_id, 'storagePath', p.storage_path, 'mimeType', 'image/webp',
        'byteSize', p.byte_size, 'width', p.width, 'height', p.height,
        'version', p.media_version, 'createdAt', p.media_created_at, 'updatedAt', p.media_updated_at
      ) end
    ) order by p.entry_date desc), '[]'::jsonb),
    (select count(*) > p_limit from candidates), min(p.entry_date)
  into v_items, v_has_more, v_next_cursor from page p;

  return jsonb_build_object('items', v_items, 'hasMore', v_has_more,
    'nextCursor', case when v_has_more then v_next_cursor else null end);
end;
$$;

create or replace function public.refresh_publication_sources(p_publication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_publication public.publications;
  v_editorial text;
  v_layout text;
begin
  select * into v_publication from public.publications
  where id = p_publication_id and (user_id = v_user_id or auth.role() = 'service_role') for update;
  if not found then raise exception 'Publication not found' using errcode = 'P0002'; end if;

  delete from public.publication_sources where publication_id = p_publication_id;
  insert into public.publication_sources (
    publication_id, entry_id, entry_version, title_fingerprint, content_fingerprint,
    rich_fingerprint, media_id, media_version
  )
  select v_publication.id, e.id, e.version, md5(e.title), md5(e.content),
    md5(coalesce(e.content_rich::text, '')), m.id, m.version
  from public.entries e left join public.entry_media m on m.entry_id = e.id
  where e.user_id = v_publication.user_id
    and e.entry_date between v_publication.period_start and v_publication.period_end
  order by e.entry_date;

  select md5(coalesce(string_agg(e.entry_date::text || ':' || e.version::text || ':' || md5(e.title) || ':' || md5(e.content), '|' order by e.entry_date), '')),
    md5(coalesce(string_agg(e.entry_date::text || ':' || md5(coalesce(e.content_rich::text, '')) || ':' || coalesce(m.version::text, ''), '|' order by e.entry_date), ''))
  into v_editorial, v_layout
  from public.entries e left join public.entry_media m on m.entry_id = e.id
  where e.user_id = v_publication.user_id
    and e.entry_date between v_publication.period_start and v_publication.period_end;

  update public.publications set
    state = case when mode = 'ai' and editorial_fingerprint is not null and editorial_fingerprint <> v_editorial then 'stale' else state end,
    stale_reason = case when mode = 'ai' and editorial_fingerprint is not null and editorial_fingerprint <> v_editorial then 'source-text' else null end,
    layout_fingerprint = v_layout,
    updated_at = now()
  where id = p_publication_id returning * into v_publication;

  return jsonb_build_object('editorialFingerprint', v_editorial, 'layoutFingerprint', v_layout,
    'state', v_publication.state, 'staleReason', v_publication.stale_reason);
end;
$$;

create or replace function public.get_publication_library()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
  v_entitlement public.publication_entitlements;
  v_ai_entitled boolean := false;
  v_disclosure text;
  v_items jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select timezone into v_timezone from public.profiles where user_id = v_user_id;
  if v_timezone is null then raise exception 'Profile required' using errcode = 'P0002'; end if;
  v_today := (now() at time zone v_timezone)::date;
  select * into v_entitlement from public.publication_entitlements where user_id = v_user_id
    and ai_enabled and (expires_at is null or expires_at > now());
  v_ai_entitled := found;
  select version into v_disclosure from public.ai_disclosure_versions where is_current;

  with bounds as (
    select date_trunc('month', min(entry_date))::date as first_month,
      date_trunc('month', v_today)::date as current_month
    from public.entries where user_id = v_user_id
  ), months as (
    select generate_series(first_month, current_month, interval '1 month')::date as month_start
    from bounds where first_month is not null
  ), stats as (
    select m.month_start, (m.month_start + interval '1 month - 1 day')::date as month_end,
      count(e.id) filter (where public.entry_has_visible_content(e.content))::integer as writing_days,
      coalesce(sum(e.word_count), 0)::bigint as words,
      count(e.id)::integer as entry_count
    from months m left join public.entries e on e.user_id = v_user_id
      and e.entry_date between m.month_start and (m.month_start + interval '1 month - 1 day')::date
    group by m.month_start
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'monthStart', s.month_start, 'monthEnd', s.month_end, 'writingDays', s.writing_days,
    'words', s.words, 'entryCount', s.entry_count,
    'ended', s.month_end < v_today, 'eligible', s.month_end < v_today and s.writing_days >= 10,
    'publication', case when p.id is null then null else jsonb_build_object(
      'id', p.id, 'mode', p.mode, 'state', p.state, 'title', p.title,
      'coverMediaId', p.cover_media_id, 'staleReason', p.stale_reason,
      'generationCount', p.generation_count, 'sectionRegenerationCount', p.section_regeneration_count,
      'updatedAt', p.updated_at
    ) end
  ) order by s.month_start desc), '[]'::jsonb) into v_items
  from stats s left join public.publications p on p.user_id = v_user_id
    and p.scope = 'monthly' and p.period_start = s.month_start;

  return jsonb_build_object(
    'items', v_items,
    'aiEntitled', v_ai_entitled,
    'generationLimit', coalesce(v_entitlement.generation_limit, 0),
    'sectionRegenerationLimit', coalesce(v_entitlement.section_regeneration_limit, 0),
    'disclosureVersion', v_disclosure
  );
end;
$$;

create or replace function public.create_monthly_publication(p_month date, p_mode text default 'original')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_writing_days integer;
  v_publication public.publications;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_mode not in ('original', 'ai') then raise exception 'Invalid publication mode' using errcode = '22023'; end if;
  select timezone into v_timezone from public.profiles where user_id = v_user_id;
  v_today := (now() at time zone v_timezone)::date;
  select count(*) into v_writing_days from public.entries
  where user_id = v_user_id and entry_date between v_start and v_end
    and public.entry_has_visible_content(content);
  if v_end >= v_today or v_writing_days < 10 then raise exception 'Month is not eligible' using errcode = '22023'; end if;
  if p_mode = 'ai' and not exists (
    select 1 from public.publication_entitlements where user_id = v_user_id and ai_enabled
      and (expires_at is null or expires_at > now())
  ) then raise exception 'AI beta access required' using errcode = '42501'; end if;

  insert into public.publications (user_id, scope, period_start, period_end, mode, state, title)
  values (v_user_id, 'monthly', v_start, v_end, p_mode,
    case when p_mode = 'original' then 'ready' else 'eligible' end,
    to_char(v_start, 'FMMonth YYYY'))
  on conflict (user_id, scope, period_start) do update set
    mode = excluded.mode,
    state = case when excluded.mode = 'original' then 'ready' else public.publications.state end,
    stale_reason = case when excluded.mode = 'original' then null else public.publications.stale_reason end,
    updated_at = now()
  returning * into v_publication;
  perform public.refresh_publication_sources(v_publication.id);
  if p_mode = 'original' then
    insert into public.publication_events (user_id, publication_id, event_name, dedupe_key)
    values (v_user_id, v_publication.id, 'original_created', md5(v_user_id::text || ':original_created:' || v_publication.id::text))
    on conflict (dedupe_key) do nothing;
  end if;
  return to_jsonb(v_publication);
end;
$$;

create or replace function public.get_publication_document(p_publication_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_publication public.publications;
  v_version public.publication_versions;
  v_entries jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_publication from public.publications where id = p_publication_id and user_id = v_user_id;
  if not found then raise exception 'Publication not found' using errcode = 'P0002'; end if;
  if v_publication.current_draft_version_id is not null then
    select * into v_version from public.publication_versions where id = v_publication.current_draft_version_id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'entryDate', e.entry_date, 'title', e.title, 'content', e.content,
    'richContent', e.content_rich, 'wordCount', e.word_count, 'version', e.version,
    'media', case when m.id is null then null else jsonb_build_object(
      'id', m.id, 'storagePath', m.storage_path, 'mimeType', 'image/webp', 'byteSize', m.byte_size,
      'width', m.width, 'height', m.height, 'version', m.version,
      'createdAt', m.created_at, 'updatedAt', m.updated_at
    ) end
  ) order by e.entry_date), '[]'::jsonb) into v_entries
  from public.entries e left join public.entry_media m on m.entry_id = e.id
  where e.user_id = v_user_id and e.entry_date between v_publication.period_start and v_publication.period_end;
  return jsonb_build_object('publication', to_jsonb(v_publication),
    'editorialVersion', case when v_version.id is null then null else to_jsonb(v_version) end,
    'entries', v_entries);
end;
$$;

create or replace function public.save_publication_draft(
  p_publication_id uuid, p_title text, p_editorial jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_publication public.publications;
  v_version public.publication_versions;
  v_number integer;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if char_length(coalesce(p_title, '')) > 120 or jsonb_typeof(p_editorial) <> 'object' or octet_length(p_editorial::text) > 200000 then
    raise exception 'Invalid publication draft' using errcode = '22023';
  end if;
  select * into v_publication from public.publications where id = p_publication_id and user_id = v_user_id for update;
  if not found then raise exception 'Publication not found' using errcode = 'P0002'; end if;
  if v_publication.current_draft_version_id is not null then
    update public.publication_versions set editorial = p_editorial, updated_at = now()
    where id = v_publication.current_draft_version_id returning * into v_version;
  else
    select coalesce(max(version_number), 0) + 1 into v_number from public.publication_versions where publication_id = p_publication_id;
    insert into public.publication_versions (publication_id, version_number, editorial, source_fingerprint, approval_state)
    values (p_publication_id, v_number, p_editorial, coalesce(v_publication.editorial_fingerprint, ''), 'draft') returning * into v_version;
  end if;
  update public.publications set title = p_title, current_draft_version_id = v_version.id,
    state = 'draft', updated_at = now() where id = p_publication_id returning * into v_publication;
  return jsonb_build_object('publication', to_jsonb(v_publication), 'version', to_jsonb(v_version));
end;
$$;

create or replace function public.approve_publication(p_publication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid(); v_publication public.publications;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_publication from public.publications where id = p_publication_id and user_id = v_user_id for update;
  if not found then raise exception 'Publication not found' using errcode = 'P0002'; end if;
  if v_publication.mode = 'ai' and (v_publication.state = 'stale' or v_publication.current_draft_version_id is null) then
    raise exception 'A current AI draft is required' using errcode = '22023';
  end if;
  if v_publication.current_draft_version_id is not null then
    update public.publication_versions set approval_state = 'superseded'
      where publication_id = p_publication_id and approval_state = 'approved';
    update public.publication_versions set approval_state = 'approved', updated_at = now()
      where id = v_publication.current_draft_version_id;
  end if;
  update public.publications set approved_version_id = current_draft_version_id,
    state = 'ready', stale_reason = null, updated_at = now()
  where id = p_publication_id returning * into v_publication;
  insert into public.publication_events (user_id, publication_id, event_name, dedupe_key)
  values (v_user_id, p_publication_id, 'chapter_approved', md5(v_user_id::text || ':chapter_approved:' || p_publication_id::text))
  on conflict (dedupe_key) do nothing;
  return to_jsonb(v_publication);
end;
$$;

create or replace function public.set_publication_cover(p_publication_id uuid, p_media_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_publication public.publications;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_publication from public.publications where id = p_publication_id and user_id = v_user_id for update;
  if not found then raise exception 'Publication not found' using errcode = 'P0002'; end if;
  if p_media_id is not null and not exists (
    select 1 from public.entry_media m join public.entries e on e.id = m.entry_id
    where m.id = p_media_id and e.user_id = v_user_id
      and e.entry_date between v_publication.period_start and v_publication.period_end
  ) then raise exception 'Cover photo must belong to this publication' using errcode = '42501'; end if;
  update public.publications set cover_media_id = p_media_id, layout_version = layout_version + 1,
    updated_at = now() where id = p_publication_id returning * into v_publication;
  return to_jsonb(v_publication);
end;
$$;

create or replace function public.delete_publication(p_publication_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_deleted uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  delete from public.publications where id = p_publication_id and user_id = v_user_id returning id into v_deleted;
  return v_deleted is not null;
end;
$$;

create or replace function public.accept_ai_processing(p_publication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_version text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not exists (select 1 from public.publications where id = p_publication_id and user_id = v_user_id) then
    raise exception 'Publication not found' using errcode = 'P0002';
  end if;
  select version into v_version from public.ai_disclosure_versions where is_current;
  insert into public.ai_processing_consents (user_id, disclosure_version, publication_id)
  values (v_user_id, v_version, p_publication_id) on conflict do nothing;
  return jsonb_build_object('accepted', true, 'version', v_version);
end;
$$;

create or replace function public.record_publication_feedback(p_publication_id uuid, p_verdict text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_verdict not in ('accurate', 'needs-review', 'invented-fact') then raise exception 'Invalid feedback' using errcode = '22023'; end if;
  if not exists (select 1 from public.publications where id = p_publication_id and user_id = v_user_id) then raise exception 'Publication not found' using errcode = 'P0002'; end if;
  insert into public.publication_feedback (user_id, publication_id, verdict)
  values (v_user_id, p_publication_id, p_verdict)
  on conflict (user_id, publication_id) do update set verdict = excluded.verdict, created_at = now();
  return true;
end;
$$;

create or replace function public.record_publication_event(p_event_name text, p_publication_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_period text := (now() at time zone 'UTC')::date::text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_event_name not in ('books_viewed', 'pdf_downloaded') then
    raise exception 'Invalid publication event' using errcode = '22023';
  end if;
  if p_publication_id is not null and not exists (
    select 1 from public.publications where id = p_publication_id and user_id = v_user_id
  ) then raise exception 'Publication not found' using errcode = 'P0002'; end if;
  if p_event_name = 'pdf_downloaded' and p_publication_id is null then
    raise exception 'Publication required' using errcode = '22023';
  end if;
  insert into public.publication_events (user_id, publication_id, event_name, dedupe_key)
  values (
    v_user_id,
    p_publication_id,
    p_event_name,
    md5(v_user_id::text || ':' || p_event_name || ':' || coalesce(p_publication_id::text, 'library') || ':' || v_period)
  ) on conflict (dedupe_key) do nothing;
  return true;
end;
$$;

create or replace function public.get_portable_publication_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_publications jsonb; v_consents jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'scope', p.scope, 'periodStart', p.period_start, 'periodEnd', p.period_end,
    'mode', p.mode, 'state', p.state, 'title', p.title,
    'approvedEditorial', v.editorial
  ) order by p.period_start), '[]'::jsonb) into v_publications
  from public.publications p
  left join public.publication_versions v on v.id = p.approved_version_id
  where p.user_id = v_user_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', c.kind, 'version', c.version, 'acceptedAt', c.accepted_at, 'periodStart', c.period_start
  ) order by c.accepted_at), '[]'::jsonb) into v_consents
  from (
    select 'legal-' || la.document_type as kind, la.version, la.accepted_at, null::date as period_start
    from public.legal_acceptances la where la.user_id = v_user_id
    union all
    select 'ai-processing' as kind, ac.disclosure_version as version, ac.accepted_at, p.period_start
    from public.ai_processing_consents ac join public.publications p on p.id = ac.publication_id
    where ac.user_id = v_user_id
  ) c;
  return jsonb_build_object('publications', v_publications, 'consents', v_consents);
end;
$$;

update public.legal_document_versions set is_current = false where is_current;
insert into public.legal_document_versions (document_type, version, is_current, effective_date, account_gate_from)
values
  ('privacy', '2026-08-19', true, '2026-08-19 00:00:00+00', null),
  ('terms', '2026-08-19', true, '2026-08-19 00:00:00+00', null);

revoke all on function public.save_entry_with_title(date, text, text, jsonb, integer, bigint) from public;
revoke all on function public.mark_publications_from_entry_change() from public;
revoke all on function public.mark_publication_layout_from_media() from public;
revoke all on function public.get_entry_history(text, date, date, date, integer) from public;
revoke all on function public.refresh_publication_sources(uuid) from public;
revoke all on function public.get_publication_library() from public;
revoke all on function public.create_monthly_publication(date, text) from public;
revoke all on function public.get_publication_document(uuid) from public;
revoke all on function public.save_publication_draft(uuid, text, jsonb) from public;
revoke all on function public.approve_publication(uuid) from public;
revoke all on function public.set_publication_cover(uuid, uuid) from public;
revoke all on function public.delete_publication(uuid) from public;
revoke all on function public.accept_ai_processing(uuid) from public;
revoke all on function public.record_publication_feedback(uuid, text) from public;
revoke all on function public.record_publication_event(text, uuid) from public;
revoke all on function public.get_portable_publication_data() from public;

grant execute on function public.save_entry_with_title(date, text, text, jsonb, integer, bigint) to authenticated;
grant execute on function public.get_entry_history(text, date, date, date, integer) to authenticated;
grant execute on function public.refresh_publication_sources(uuid) to authenticated, service_role;
grant execute on function public.get_publication_library() to authenticated;
grant execute on function public.create_monthly_publication(date, text) to authenticated;
grant execute on function public.get_publication_document(uuid) to authenticated;
grant execute on function public.save_publication_draft(uuid, text, jsonb) to authenticated;
grant execute on function public.approve_publication(uuid) to authenticated;
grant execute on function public.set_publication_cover(uuid, uuid) to authenticated;
grant execute on function public.delete_publication(uuid) to authenticated;
grant execute on function public.accept_ai_processing(uuid) to authenticated;
grant execute on function public.record_publication_feedback(uuid, text) to authenticated;
grant execute on function public.record_publication_event(text, uuid) to authenticated;
grant execute on function public.get_portable_publication_data() to authenticated;

create or replace view public.publication_quality_gate
with (security_invoker = true)
as
select
  count(*) as reviewed_generations,
  count(*) filter (where verdict = 'accurate') as accurate_generations,
  count(*) filter (where verdict = 'invented-fact') as invented_fact_reports,
  case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where verdict = 'accurate') / count(*), 1) end as accuracy_percent
from public.publication_feedback;

revoke all on public.publication_quality_gate from anon, authenticated;
grant select on public.publication_quality_gate to service_role;
