insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values
(
  'trip-photos',
  'trip-photos',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
),
(
  'memory-card-results',
  'memory-card-results',
  false,
  15728640,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Trip members can read trip photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'trip-photos'
  and exists (
    select 1
    from public.trip_memberships tm
    where tm.auth_user_id = (select auth.uid())
      and tm.trip_id::text = (storage.foldername(name))[1]
  )
);

create policy "Trip members can upload trip photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trip-photos'
  and exists (
    select 1
    from public.trip_memberships tm
    where tm.auth_user_id = (select auth.uid())
      and tm.trip_id::text = (storage.foldername(name))[1]
  )
);

create policy "Owners can update own trip photo objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trip-photos'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'trip-photos'
  and owner_id = (select auth.uid()::text)
);

create policy "Owners can delete own trip photo objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trip-photos'
  and owner_id = (select auth.uid()::text)
);

create policy "Trip members can read memory card results"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'memory-card-results'
  and exists (
    select 1
    from public.trip_memberships tm
    where tm.auth_user_id = (select auth.uid())
      and tm.trip_id::text = (storage.foldername(name))[1]
  )
);

create policy "Trip members can upload memory card results"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'memory-card-results'
  and exists (
    select 1
    from public.trip_memberships tm
    where tm.auth_user_id = (select auth.uid())
      and tm.trip_id::text = (storage.foldername(name))[1]
  )
);

create policy "Owners can delete own memory card results"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'memory-card-results'
  and owner_id = (select auth.uid()::text)
);
