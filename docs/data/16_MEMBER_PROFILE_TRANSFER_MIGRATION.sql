-- Unapplied. Explicit Home switch only; call from the authenticated server route.
begin;

create or replace function public.transfer_trip_membership_for_switch(
  p_trip_id uuid,
  p_auth_user_id uuid,
  p_target_member_id uuid,
  p_expected_membership_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_membership_id uuid;
  previous_member_id uuid;
  target_boarded_at timestamptz;
begin
  -- ponytail: serialize switches per 10-person trip; ordered finer locks if scale requires it.
  perform 1 from public.trips where id = p_trip_id for update;
  if not found then raise exception 'Unknown trip.'; end if;

  select tm.id, tm.family_member_id
  into current_membership_id, previous_member_id
  from public.trip_memberships tm
  where tm.trip_id = p_trip_id and tm.auth_user_id = p_auth_user_id
  for update;
  if not found then raise exception 'Current membership is required.'; end if;

  select fm.boarded_at into target_boarded_at
  from public.family_members fm
  where fm.id = p_target_member_id and fm.trip_id = p_trip_id
  for update;
  if not found then raise exception 'Target member is outside the requested trip.'; end if;

  perform 1 from public.trip_memberships tm
  where tm.trip_id = p_trip_id and tm.family_member_id = p_target_member_id
  for update;

  perform 1 from public.family_members fm
  where fm.id = previous_member_id and fm.trip_id = p_trip_id
  for update;
  if not found then raise exception 'Current member is outside the requested trip.'; end if;

  -- A lost successful response can retry the same target without another transfer.
  if previous_member_id = p_target_member_id then
    update public.family_members
    set boarded_at = coalesce(boarded_at, now())
    where id = p_target_member_id and trip_id = p_trip_id
    returning boarded_at into target_boarded_at;
    return jsonb_build_object('status', 'already_target', 'boarded_at', target_boarded_at);
  end if;

  -- Reject revoked/stale intents inside the transaction, including takeover races.
  if p_expected_membership_id is null or current_membership_id <> p_expected_membership_id then
    raise exception 'Switch membership has changed.';
  end if;

  delete from public.trip_memberships
  where trip_id = p_trip_id
    and (auth_user_id = p_auth_user_id or family_member_id = p_target_member_id);

  insert into public.trip_memberships (trip_id, family_member_id, auth_user_id)
  values (p_trip_id, p_target_member_id, p_auth_user_id);

  update public.family_members
  set boarded_at = null
  where id = previous_member_id and trip_id = p_trip_id;

  update public.family_members
  set boarded_at = coalesce(boarded_at, now())
  where id = p_target_member_id and trip_id = p_trip_id
  returning boarded_at into target_boarded_at;

  return jsonb_build_object('status', 'transferred', 'boarded_at', target_boarded_at);
end;
$$;

revoke all on function public.transfer_trip_membership_for_switch(uuid, uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.transfer_trip_membership_for_switch(uuid, uuid, uuid, uuid)
to service_role;

commit;
