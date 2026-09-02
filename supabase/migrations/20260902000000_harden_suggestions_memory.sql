-- 2026-09-02 privacy hardening.
alter table public.suggestions enable row level security;
drop policy if exists "누구나 건의사항 조회 가능" on public.suggestions;
drop policy if exists "suggestions_select_own" on public.suggestions;
create policy "suggestions_select_own" on public.suggestions for select using (auth.uid() = author_id);
drop policy if exists "suggestions_select_elevated" on public.suggestions;
create policy "suggestions_select_elevated" on public.suggestions for select using (get_user_role() = any(array['teacher'::text,'chief'::text]));
drop policy if exists "Non-member can delete photos" on public.memory_photos;
drop policy if exists "memory_photos_delete_own" on public.memory_photos;
create policy "memory_photos_delete_own" on public.memory_photos for delete using (auth.uid() = author_id);
drop policy if exists "get_public_bucket 13pqkcp_2" on storage.objects;
drop policy if exists "memory_objects_delete_own" on storage.objects;
create policy "memory_objects_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'Public' and name like 'memories/' || auth.uid()::text || '/%');
