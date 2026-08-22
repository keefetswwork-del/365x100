alter table public.publications
  add column if not exists cover_source text not null default 'default' check (cover_source in ('default', 'entry', 'upload')),
  add column if not exists cover_upload_path text;

update public.publications
set cover_source = case when cover_media_id is null then 'default' else 'entry' end
where cover_source = 'default' and cover_media_id is not null;

create or replace function public.set_publication_cover(p_publication_id uuid, p_media_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_publication public.publications;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_publication from public.publications where id = p_publication_id and user_id = v_user_id for update;
  if not found then raise exception 'Publication not found' using errcode = 'P0002'; end if;
  if p_media_id is not null and not exists (
    select 1 from public.entry_media m join public.entries e on e.id = m.entry_id
    where m.id = p_media_id and e.user_id = v_user_id
      and e.entry_date between v_publication.period_start and v_publication.period_end
  ) then raise exception 'Cover photo must belong to this publication' using errcode = '42501'; end if;
  update public.publications
  set cover_media_id = p_media_id,
      cover_source = case when p_media_id is null then 'default' else 'entry' end,
      updated_at = now()
  where id = p_publication_id
  returning * into v_publication;
  return to_jsonb(v_publication);
end;
$$;

create or replace function public.orphaned_media_objects(p_limit integer default 100)
returns table (storage_path text)
language sql
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'journal-media'
    and not exists (select 1 from public.entry_media m where m.storage_path = o.name)
    and not exists (select 1 from public.publications p where p.cover_upload_path = o.name)
    and o.created_at < now() - interval '1 hour'
  order by o.created_at
  limit least(greatest(p_limit, 1), 500);
$$;
