-- Use Neon Data API's verified JWT session as the single source of truth for
-- storage-worker authorization. This avoids duplicating JWT identity mapping
-- in the Cloudflare Worker.
create or replace function public.current_auth_user_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select nullif(auth.user_id(), '')::uuid
$$;

grant execute on function public.current_auth_user_id() to public;
