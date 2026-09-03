revoke all privileges
on table
  public.trips,
  public.family_members,
  public.trip_memberships,
  public.itinerary_items,
  public.photos,
  public.memory_cards
from authenticated, anon;

revoke update (
  template_key,
  layout_version,
  layout_json,
  result_storage_path,
  updated_at
)
on table public.memory_cards
from authenticated;

grant select
on table
  public.trips,
  public.family_members,
  public.trip_memberships,
  public.itinerary_items,
  public.photos,
  public.memory_cards
to authenticated, service_role;

grant insert, delete
on table public.photos, public.memory_cards
to authenticated;

grant update (caption, taken_at)
on table public.photos
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
using (
  uploader_auth_user_id = (select auth.uid())
  and exists (
    select 1
    from public.trip_memberships tm
    where tm.trip_id = photos.trip_id
      and tm.family_member_id = photos.uploader_member_id
      and tm.auth_user_id = (select auth.uid())
  )
)
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
  and layout_version = 3
  and layout_json -> 'version' = to_jsonb(layout_version)
  and result_storage_path is null
  and jsonb_typeof(layout_json) = 'object'
  and layout_json ? 'caption'
  and (
    layout_json -> 'caption' = 'null'::jsonb
    or jsonb_typeof(layout_json -> 'caption') = 'string'
  )
  and case
    when jsonb_typeof(layout_json -> 'slots') = 'array' then
      jsonb_array_length(layout_json -> 'slots') between 1 and 6
      and not exists (
        select 1
        from jsonb_array_elements(layout_json -> 'slots') slot
        where jsonb_typeof(slot) is distinct from 'object'
          or jsonb_typeof(slot -> 'slotId') is distinct from 'string'
          or nullif(btrim(slot ->> 'slotId'), '') is null
          or jsonb_typeof(slot -> 'photoId') is distinct from 'string'
          or nullif(btrim(slot ->> 'photoId'), '') is null
          or jsonb_typeof(slot -> 'placement') is distinct from 'object'
          or jsonb_typeof(slot #> '{placement,zoom}') is distinct from 'number'
          or jsonb_typeof(slot #> '{placement,rotation}') is distinct from 'number'
          or jsonb_typeof(slot #> '{placement,offsetX}') is distinct from 'number'
          or jsonb_typeof(slot #> '{placement,offsetY}') is distinct from 'number'
      )
    else false
  end
);

create policy "Creators can delete own memory cards"
on public.memory_cards
for delete
to authenticated
using (creator_auth_user_id = (select auth.uid()));
