drop policy if exists quotes_insert_manager on public.quotes;
drop policy if exists quotes_update_manager on public.quotes;
drop policy if exists quotes_delete_manager on public.quotes;

create policy quotes_insert_manager on public.quotes for insert to authenticated with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = any (array['assistant_zone_leader'::text, 'zone_leader'::text, 'president'::text, 'teacher'::text, 'chief'::text])));
create policy quotes_update_manager on public.quotes for update to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = any (array['assistant_zone_leader'::text, 'zone_leader'::text, 'president'::text, 'teacher'::text, 'chief'::text]))) with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = any (array['assistant_zone_leader'::text, 'zone_leader'::text, 'president'::text, 'teacher'::text, 'chief'::text])));
create policy quotes_delete_manager on public.quotes for delete to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = any (array['assistant_zone_leader'::text, 'zone_leader'::text, 'president'::text, 'teacher'::text, 'chief'::text])));
