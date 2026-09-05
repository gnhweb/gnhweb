-- Image input policy: do not reject large/less-common image formats at the bucket layer.
-- The Supabase Free plan still enforces its platform-wide upload limit; this removes
-- the project-level 512KB restriction that would otherwise reject valid uploads.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = null
where id = 'Public';
