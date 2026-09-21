create table if not exists public.auth_identity (
  user_id uuid primary key references neon_auth."user"(id) on delete cascade
);

insert into public.auth_identity (user_id)
select id
from neon_auth."user"
on conflict (user_id) do nothing;

alter table public.auth_identity enable row level security;

drop policy if exists auth_identity_select_own on public.auth_identity;
create policy auth_identity_select_own
on public.auth_identity
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.auth_identity from anonymous;
grant select on public.auth_identity to authenticated;

drop function if exists public.current_auth_user_id();
