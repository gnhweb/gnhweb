-- Add support for anonymous suggestions so a student's name isn't
-- exposed to reviewers (teacher/chief) or shown in the suggestions list.
alter table public.suggestions add column if not exists is_anonymous boolean not null default false;

notify pgrst, 'reload schema';
