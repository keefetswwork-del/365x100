-- The hosted project was created with legacy Data API defaults that granted
-- anonymous access to new objects. Build 2 exposes writes only through
-- authenticated RPCs, so privileges must be granted explicitly.
revoke all on function public.is_valid_timezone(text) from anon;
revoke all on function public.set_profile_timezone(text) from anon;
revoke all on function public.save_entry(date, text, integer, bigint) from anon;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant all on functions to service_role;
