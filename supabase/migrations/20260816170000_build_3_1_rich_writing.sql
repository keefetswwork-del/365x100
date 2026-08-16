alter table public.entries
  add column if not exists content_rich jsonb;

create or replace function public.is_valid_rich_entry(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is not null
    and jsonb_typeof(value) = 'object'
    and value->>'schemaVersion' = '1'
    and jsonb_typeof(value->'editorState') = 'object'
    and jsonb_typeof(value->'editorState'->'root') = 'object'
    and value->'editorState'->'root'->>'type' = 'root'
    and octet_length(value::text) <= 1000000;
$$;

create or replace function public.save_rich_entry(
  p_entry_date date,
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
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_entry_date is null or p_content is null or p_content_rich is null or p_word_count is null then
    raise exception 'Entry date, content, rich content, and word count are required' using errcode = '22004';
  end if;
  if p_word_count < 0 or not public.is_valid_rich_entry(p_content_rich) then
    raise exception 'Invalid rich entry' using errcode = '22023';
  end if;

  select * into v_existing
  from public.entries
  where user_id = v_user_id and entry_date = p_entry_date
  for update;

  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      return jsonb_build_object('status', 'conflict', 'remote', null);
    end if;
    begin
      insert into public.entries (
        user_id, entry_date, content, content_rich, word_count, completed_at
      ) values (
        v_user_id, p_entry_date, p_content, p_content_rich, p_word_count,
        case when p_word_count >= 100 then now() else null end
      ) returning * into v_saved;
      return jsonb_build_object('status', 'saved', 'entry', to_jsonb(v_saved));
    exception when unique_violation then
      select * into v_existing
      from public.entries
      where user_id = v_user_id and entry_date = p_entry_date;
      return jsonb_build_object('status', 'conflict', 'remote', to_jsonb(v_existing));
    end;
  end if;

  if v_existing.version <> coalesce(p_expected_version, 0) then
    return jsonb_build_object('status', 'conflict', 'remote', to_jsonb(v_existing));
  end if;

  update public.entries
  set content = p_content,
      content_rich = p_content_rich,
      word_count = p_word_count,
      completed_at = case
        when p_word_count >= 100 then coalesce(completed_at, now())
        else null
      end,
      version = version + 1,
      updated_at = now()
  where id = v_existing.id
  returning * into v_saved;

  return jsonb_build_object('status', 'saved', 'entry', to_jsonb(v_saved));
end;
$$;

create or replace function public.clear_stale_rich_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content is distinct from old.content
    and new.content_rich is not distinct from old.content_rich then
    new.content_rich := null;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_stale_rich_entry on public.entries;
create trigger clear_stale_rich_entry
before update of content, content_rich on public.entries
for each row execute function public.clear_stale_rich_entry();

revoke all on function public.is_valid_rich_entry(jsonb) from public;
revoke all on function public.save_rich_entry(date, text, jsonb, integer, bigint) from public;
revoke all on function public.clear_stale_rich_entry() from public;
grant execute on function public.is_valid_rich_entry(jsonb) to service_role;
grant execute on function public.save_rich_entry(date, text, jsonb, integer, bigint) to authenticated;
