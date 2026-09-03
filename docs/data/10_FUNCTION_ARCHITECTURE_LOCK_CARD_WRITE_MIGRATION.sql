begin;

-- New writes use v3; existing v1/v2 rows are not rewritten.
alter table public.memory_cards
alter column layout_version set default 3;

revoke update on table public.memory_cards from authenticated;
revoke update (
  template_key,
  layout_version,
  layout_json,
  result_storage_path,
  updated_at
)
on table public.memory_cards
from authenticated;
drop policy if exists "Creators can update own memory cards"
on public.memory_cards;

drop policy if exists "Members can create own memory cards"
on public.memory_cards;

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

commit;
