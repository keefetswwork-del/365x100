-- Make AI chapters available to every profile while keeping the existing
-- per-publication and global spend controls enforced by the Edge Function.

create or replace function public.grant_default_ai_chapter_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.publication_entitlements (
    user_id,
    ai_enabled,
    generation_limit,
    section_regeneration_limit
  )
  values (new.user_id, true, 1, 5)
  on conflict (user_id) do update
  set
    ai_enabled = true,
    generation_limit = excluded.generation_limit,
    section_regeneration_limit = excluded.section_regeneration_limit,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.grant_default_ai_chapter_entitlement() from public;

drop trigger if exists grant_default_ai_chapter_entitlement_on_profile on public.profiles;

create trigger grant_default_ai_chapter_entitlement_on_profile
after insert on public.profiles
for each row
execute function public.grant_default_ai_chapter_entitlement();

insert into public.publication_entitlements (
  user_id,
  ai_enabled,
  generation_limit,
  section_regeneration_limit
)
select
  user_id,
  true,
  1,
  5
from public.profiles
on conflict (user_id) do update
set
  ai_enabled = true,
  generation_limit = excluded.generation_limit,
  section_regeneration_limit = excluded.section_regeneration_limit,
  updated_at = now();
