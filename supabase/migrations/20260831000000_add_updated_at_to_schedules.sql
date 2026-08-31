-- Fix: editing a schedule fails with
-- "Could not find the 'updated_at' column of 'schedules' in the schema cache"
-- because the schedules table is missing the updated_at column that the
-- application code (src/pages/schedule/edit/page.tsx) writes to on every update.

alter table public.schedules add column if not exists updated_at timestamptz;

-- Backfill existing rows so updated_at is never null for pre-existing schedules.
update public.schedules set updated_at = created_at where updated_at is null;

alter table public.schedules alter column updated_at set default now();

-- Keep updated_at accurate automatically, even for updates that don't
-- explicitly set it (defense in depth alongside the client-side write).
create or replace function public.set_schedules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schedules_set_updated_at on public.schedules;
create trigger schedules_set_updated_at
  before update on public.schedules
  for each row
  execute function public.set_schedules_updated_at();

-- Refresh PostgREST's schema cache so the new column is picked up immediately.
notify pgrst, 'reload schema';
