-- Public image bucket guard
update storage.buckets
set file_size_limit = 524288,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'Public';
