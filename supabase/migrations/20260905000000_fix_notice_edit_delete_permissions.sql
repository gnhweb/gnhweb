drop policy if exists "notices_update_author_or_staff" on public.notices;
drop policy if exists "notices_delete_author_or_staff" on public.notices;

create policy "notices_update_author_or_teacher_chief"
on public.notices
for update
to authenticated
using (
  author_id = (select auth.uid())
  or has_any_active_role(array['teacher'::text, 'chief'::text])
)
with check (
  author_id = (select auth.uid())
  or has_any_active_role(array['teacher'::text, 'chief'::text])
);

create policy "notices_delete_author_or_teacher_chief"
on public.notices
for delete
to authenticated
using (
  author_id = (select auth.uid())
  or has_any_active_role(array['teacher'::text, 'chief'::text])
);