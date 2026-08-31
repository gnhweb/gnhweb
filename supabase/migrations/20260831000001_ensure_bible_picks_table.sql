-- Fix: verses drawn in 말씀뽑기 (Bible Pick) were not showing up in the
-- history page. The client already inserts a full record into bible_picks
-- on every draw (src/pages/biblePick/page.tsx), but if the table/columns
-- are missing or out of sync the insert fails silently. This migration
-- makes sure the table and every column the app relies on actually exist.

create table if not exists public.bible_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  emotion text,
  situation text,
  verse text,
  reference text,
  practice text,
  prayers jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.bible_picks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.bible_picks add column if not exists emotion text;
alter table public.bible_picks add column if not exists situation text;
alter table public.bible_picks add column if not exists verse text;
alter table public.bible_picks add column if not exists reference text;
alter table public.bible_picks add column if not exists practice text;
alter table public.bible_picks add column if not exists prayers jsonb default '[]'::jsonb;
alter table public.bible_picks add column if not exists created_at timestamptz not null default now();

create index if not exists bible_picks_user_id_created_at_idx
  on public.bible_picks(user_id, created_at desc);

alter table public.bible_picks enable row level security;

drop policy if exists "bible_picks_select_own" on public.bible_picks;
create policy "bible_picks_select_own"
  on public.bible_picks for select
  using (auth.uid() = user_id);

drop policy if exists "bible_picks_insert_own" on public.bible_picks;
create policy "bible_picks_insert_own"
  on public.bible_picks for insert
  with check (auth.uid() = user_id);

drop policy if exists "bible_picks_delete_own" on public.bible_picks;
create policy "bible_picks_delete_own"
  on public.bible_picks for delete
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
