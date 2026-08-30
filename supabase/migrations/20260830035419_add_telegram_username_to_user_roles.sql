alter table public.user_roles add column if not exists telegram_username text;
alter table public.user_roles drop constraint if exists user_roles_telegram_username_check;
alter table public.user_roles add constraint user_roles_telegram_username_check check (telegram_username is null or telegram_username ~ '^[A-Za-z0-9_]{5,32}$');
create index if not exists user_roles_telegram_username_idx on public.user_roles(telegram_username) where telegram_username is not null;
