grant select
on table
  public.trips,
  public.family_members,
  public.trip_memberships,
  public.itinerary_items,
  public.photos,
  public.memory_cards
to authenticated, service_role;

grant insert, update, delete
on table public.photos, public.memory_cards
to authenticated;

grant insert
on table public.trip_memberships
to service_role;

grant update
on table public.family_members
to service_role;

create policy "Members can read own membership"
on public.trip_memberships
for select
to authenticated
using (auth_user_id = (select auth.uid()));

create policy "Trip members can read trip"
on public.trips
for select
to authenticated
using (
  exists (
    select 1
    from public.trip_memberships tm
    where tm.trip_id = trips.id
      and tm.auth_user_id = (select auth.uid())
  )
);

create policy "Trip members can read family roster"
on public.family_members
for select
to authenticated
using (
  exists (
    select 1
    from public.trip_memberships tm
    where tm.trip_id = family_members.trip_id
      and tm.auth_user_id = (select auth.uid())
  )
);

create policy "Trip members can read itinerary"
on public.itinerary_items
for select
to authenticated
using (
  exists (
    select 1
    from public.trip_memberships tm
    where tm.trip_id = itinerary_items.trip_id
      and tm.auth_user_id = (select auth.uid())
  )
);

create policy "Trip members can read photos"
on public.photos
for select
to authenticated
using (
  exists (
    select 1
    from public.trip_memberships tm
    where tm.trip_id = photos.trip_id
      and tm.auth_user_id = (select auth.uid())
  )
);

create policy "Members can insert own photos"
on public.photos
for insert
to authenticated
with check (
  uploader_auth_user_id = (select auth.uid())
  and exists (
    select 1
    from public.trip_memberships tm
    where tm.trip_id = photos.trip_id
      and tm.family_member_id = photos.uploader_member_id
      and tm.auth_user_id = (select auth.uid())
  )
);

create policy "Uploaders can update own photo metadata"
on public.photos
for update
to authenticated
using (uploader_auth_user_id = (select auth.uid()))
with check (uploader_auth_user_id = (select auth.uid()));

create policy "Uploaders can delete own photo metadata"
on public.photos
for delete
to authenticated
using (uploader_auth_user_id = (select auth.uid()));

create policy "Trip members can read memory cards"
on public.memory_cards
for select
to authenticated
using (
  exists (
    select 1
    from public.trip_memberships tm
    where tm.trip_id = memory_cards.trip_id
      and tm.auth_user_id = (select auth.uid())
  )
);

create policy "Members can create own memory cards"
on public.memory_cards
for insert
to authenticated
with check (
  creator_auth_user_id = (select auth.uid())
  and exists (
    select 1
    from public.trip_memberships tm
    where tm.trip_id = memory_cards.trip_id
      and tm.family_member_id = memory_cards.creator_member_id
      and tm.auth_user_id = (select auth.uid())
  )
);

create policy "Creators can update own memory cards"
on public.memory_cards
for update
to authenticated
using (creator_auth_user_id = (select auth.uid()))
with check (creator_auth_user_id = (select auth.uid()));

create policy "Creators can delete own memory cards"
on public.memory_cards
for delete
to authenticated
using (creator_auth_user_id = (select auth.uid()));
