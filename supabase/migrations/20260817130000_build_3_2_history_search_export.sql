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
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_query is not null and char_length(v_query) > 200 then
    raise exception 'Search query is too long' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'History page size must be between 1 and 50' using errcode = '22023';
  end if;

  if p_from_date is not null and p_to_date is not null and p_from_date > p_to_date then
    raise exception 'History date range is invalid' using errcode = '22023';
  end if;

  with candidates as (
    select
      e.entry_date,
      e.word_count,
      e.updated_at,
      e.word_count >= 100 as completed,
      regexp_replace(e.content, E'[\\n\\r\\t ]+', ' ', 'g') as normalized_content
    from public.entries e
    where e.user_id = v_user_id
      and (p_from_date is null or e.entry_date >= p_from_date)
      and (p_to_date is null or e.entry_date <= p_to_date)
      and (p_before_date is null or e.entry_date < p_before_date)
      and (v_query is null or strpos(lower(e.content), lower(v_query)) > 0)
    order by e.entry_date desc
    limit p_limit + 1
  ), ranked as (
    select
      c.*,
      row_number() over (order by c.entry_date desc) as row_number
    from candidates c
  ), page as (
    select
      r.*,
      case
        when v_query is null then left(r.normalized_content, 180)
        else substring(
          r.normalized_content
          from greatest(strpos(lower(r.normalized_content), lower(v_query)) - 80, 1)
          for 240
        )
      end as excerpt
    from ranked r
    where r.row_number <= p_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'entryDate', p.entry_date,
      'excerpt', p.excerpt,
      'wordCount', p.word_count,
      'completed', p.completed,
      'updatedAt', p.updated_at
    ) order by p.entry_date desc), '[]'::jsonb),
    (select count(*) > p_limit from candidates),
    min(p.entry_date)
  into v_items, v_has_more, v_next_cursor
  from page p;

  return jsonb_build_object(
    'items', v_items,
    'hasMore', v_has_more,
    'nextCursor', case when v_has_more then v_next_cursor else null end
  );
end;
$$;

revoke all on function public.get_entry_history(text, date, date, date, integer) from public;
grant execute on function public.get_entry_history(text, date, date, date, integer) to authenticated;
