begin;

create or replace function public.release_trip_membership_for_switch(
  p_trip_id uuid,
  p_auth_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_membership_id uuid;
  current_member_id uuid;
begin
  select tm.id, tm.family_member_id
  into current_membership_id, current_member_id
  from public.trip_memberships tm
  where tm.trip_id = p_trip_id
    and tm.auth_user_id = p_auth_user_id
  for update;

  if not found then
    return 'already_released';
  end if;

  perform 1
  from public.family_members fm
  where fm.id = current_member_id
    and fm.trip_id = p_trip_id
  for update;

  if not found then
    raise exception 'Membership family member is outside the requested trip.';
  end if;

  lock table public.photos in share row exclusive mode;
  lock table public.memory_cards in share row exclusive mode;

  if exists (
    select 1
    from public.photos p
    where p.trip_id = p_trip_id
      and p.uploader_auth_user_id = p_auth_user_id
  ) or exists (
    select 1
    from public.memory_cards mc
    where mc.trip_id = p_trip_id
      and mc.creator_auth_user_id = p_auth_user_id
  ) then
    return 'blocked_owned_content';
  end if;

  delete from public.trip_memberships tm
  where tm.id = current_membership_id
    and tm.trip_id = p_trip_id
    and tm.auth_user_id = p_auth_user_id;

  update public.family_members fm
  set boarded_at = null
  where fm.id = current_member_id
    and fm.trip_id = p_trip_id;

  return 'released';
end;
$$;

revoke all
on function public.release_trip_membership_for_switch(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.release_trip_membership_for_switch(uuid, uuid)
to service_role;

commit;
