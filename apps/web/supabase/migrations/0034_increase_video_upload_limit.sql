-- Raise check-ins bucket limit to 500 MB (mentor feedback + student check-in videos).
-- Requires Supabase Pro global file size limit (Free plan max is 50 MB).

update storage.buckets
set file_size_limit = 524288000
where id = 'check-ins';
