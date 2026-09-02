-- 2026-09-02 privacy and lock hardening.
alter table public.suggestions enable row level security;
drop policy if exists "누구나 건의사항 조회 가능" on public.suggestions;
drop policy if exists "suggestions_select_own" on public.suggestions;
create policy "suggestions_select_own" on public.suggestions for select using (auth.uid() = author_id);
drop policy if exists "suggestions_select_elevated" on public.suggestions;
create policy "suggestions_select_elevated" on public.suggestions for select using (get_user_role() = any(array['teacher'::text,'chief'::text]));

create or replace function public.null_anonymous_suggestion_author_name()
returns trigger language plpgsql security definer set search_path = public
as $$ begin if new.is_anonymous then new.author_name := null; end if; return new; end; $$;
drop trigger if exists suggestions_null_anonymous_author_name on public.suggestions;
create trigger suggestions_null_anonymous_author_name before insert or update on public.suggestions for each row execute function public.null_anonymous_suggestion_author_name();

drop policy if exists "Non-member can delete photos" on public.memory_photos;
drop policy if exists "memory_photos_delete_own" on public.memory_photos;
create policy "memory_photos_delete_own" on public.memory_photos for delete using (auth.uid() = author_id);
drop policy if exists "get_public_bucket 13pqkcp_2" on storage.objects;
drop policy if exists "memory_objects_delete_own" on storage.objects;
create policy "memory_objects_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'Public' and name like 'memories/' || auth.uid()::text || '/%');

update public.user_roles
set auto_logout_minutes = 30
where auto_logout_minutes is null or auto_logout_minutes not in (1,5,30,60,300);
