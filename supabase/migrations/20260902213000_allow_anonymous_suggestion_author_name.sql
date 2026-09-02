-- Anonymous suggestions intentionally have no display name.
alter table public.suggestions alter column author_name drop not null;
update public.suggestions set author_name = null where is_anonymous = true;
notify pgrst, 'reload schema';
