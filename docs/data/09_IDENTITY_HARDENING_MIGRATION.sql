begin;

do $$
declare
  duplicate_summary text;
begin
  select string_agg(
    format(
      'trip_id=%s family_member_id=%s claims=%s',
      trip_id,
      family_member_id,
      claim_count
    ),
    '; '
  )
  into duplicate_summary
  from (
    select trip_id, family_member_id, count(*) as claim_count
    from public.trip_memberships
    group by trip_id, family_member_id
    having count(*) > 1
    order by count(*) desc, trip_id, family_member_id
    limit 10
  ) duplicates;

  if duplicate_summary is not null then
    raise exception using
      message = 'Identity hardening blocked: duplicate family-member claims exist.',
      detail = duplicate_summary,
      hint = 'Resolve every duplicate membership manually, then rerun this migration.';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trip_memberships'::regclass
      and conname = 'trip_memberships_trip_family_member_key'
  ) then
    alter table public.trip_memberships
      add constraint trip_memberships_trip_family_member_key
      unique (trip_id, family_member_id);
  end if;
end
$$;

drop index if exists public.idx_trip_memberships_member;

drop policy if exists "Trip members can upload trip photos" on storage.objects;
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
      and (storage.foldername(name))[2] = (select auth.uid()::text)
  )
);

drop policy if exists "Owners can update own trip photo objects" on storage.objects;
create policy "Owners can update own trip photo objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trip-photos'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.trip_memberships tm
    where tm.auth_user_id = (select auth.uid())
      and tm.trip_id::text = (storage.foldername(name))[1]
      and (storage.foldername(name))[2] = (select auth.uid()::text)
  )
)
with check (
  bucket_id = 'trip-photos'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.trip_memberships tm
    where tm.auth_user_id = (select auth.uid())
      and tm.trip_id::text = (storage.foldername(name))[1]
      and (storage.foldername(name))[2] = (select auth.uid()::text)
  )
);

drop policy if exists "Trip members can upload memory card results" on storage.objects;
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
      and (storage.foldername(name))[2] = (select auth.uid()::text)
  )
);

commit;
