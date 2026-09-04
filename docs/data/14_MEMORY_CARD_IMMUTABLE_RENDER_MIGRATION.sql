begin;

-- New cards are finalized once: the private result object must already exist
-- under the current trip/auth ownership path before metadata is inserted.
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
  and result_storage_path is not null
  and (storage.foldername(result_storage_path))[1] = memory_cards.trip_id::text
  and (storage.foldername(result_storage_path))[2] = (select auth.uid()::text)
  and cardinality(storage.foldername(result_storage_path)) = 2
  and storage.filename(result_storage_path) ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$'
  and jsonb_typeof(layout_json) = 'object'
  and layout_json ? 'caption'
  and (
    layout_json -> 'caption' = 'null'::jsonb
    or jsonb_typeof(layout_json -> 'caption') = 'string'
  )
  and case
    when jsonb_typeof(layout_json -> 'slots') = 'array' then
      not exists (
        select 1
        from jsonb_array_elements(layout_json -> 'slots') slot
        where jsonb_typeof(slot) is distinct from 'object'
          or jsonb_typeof(slot -> 'slotId') is distinct from 'string'
          or nullif(btrim(slot ->> 'slotId'), '') is null
          or jsonb_typeof(slot -> 'photoId') is distinct from 'string'
          or nullif(btrim(slot ->> 'photoId'), '') is null
          or jsonb_typeof(slot -> 'placement') is distinct from 'object'
          or case
            when jsonb_typeof(slot #> '{placement,zoom}') = 'number' then
              (slot #>> '{placement,zoom}')::numeric < 1
            else true
          end
          or case
            when jsonb_typeof(slot #> '{placement,rotation}') = 'number' then
              (slot #>> '{placement,rotation}')::numeric < -180
              or (slot #>> '{placement,rotation}')::numeric >= 180
            else true
          end
          or jsonb_typeof(slot #> '{placement,offsetX}') is distinct from 'number'
          or jsonb_typeof(slot #> '{placement,offsetY}') is distinct from 'number'
      )
      and not exists (
        select 1
        from jsonb_array_elements(layout_json -> 'slots') slot
        group by slot ->> 'photoId'
        having count(*) > 1
      )
      and case template_key
        when 'polaroid_moodboard' then
          jsonb_array_length(layout_json -> 'slots') = 6
          and layout_json #>> '{slots,0,slotId}' = 'p1'
          and layout_json #>> '{slots,1,slotId}' = 'p2'
          and layout_json #>> '{slots,2,slotId}' = 'p3'
          and layout_json #>> '{slots,3,slotId}' = 'p4'
          and layout_json #>> '{slots,4,slotId}' = 'p5'
          and layout_json #>> '{slots,5,slotId}' = 'p6'
        when 'four_cut' then
          jsonb_array_length(layout_json -> 'slots') = 4
          and layout_json #>> '{slots,0,slotId}' = 'f1'
          and layout_json #>> '{slots,1,slotId}' = 'f2'
          and layout_json #>> '{slots,2,slotId}' = 'f3'
          and layout_json #>> '{slots,3,slotId}' = 'f4'
        when 'editorial_collage' then
          jsonb_array_length(layout_json -> 'slots') in (4, 5)
          and layout_json #>> '{slots,0,slotId}' = 'e1'
          and layout_json #>> '{slots,1,slotId}' = 'e2'
          and layout_json #>> '{slots,2,slotId}' = 'e3'
          and layout_json #>> '{slots,3,slotId}' = 'e4'
          and (
            jsonb_array_length(layout_json -> 'slots') = 4
            or layout_json #>> '{slots,4,slotId}' = 'e5'
          )
        when 'postcard_duo' then
          jsonb_array_length(layout_json -> 'slots') = 2
          and layout_json #>> '{slots,0,slotId}' = 'pd1'
          and layout_json #>> '{slots,1,slotId}' = 'pd2'
        when 'scrapbook_trio' then
          jsonb_array_length(layout_json -> 'slots') = 3
          and layout_json #>> '{slots,0,slotId}' = 'st1'
          and layout_json #>> '{slots,1,slotId}' = 'st2'
          and layout_json #>> '{slots,2,slotId}' = 'st3'
        when 'film_contact_sheet' then
          jsonb_array_length(layout_json -> 'slots') = 6
          and layout_json #>> '{slots,0,slotId}' = 'fc1'
          and layout_json #>> '{slots,1,slotId}' = 'fc2'
          and layout_json #>> '{slots,2,slotId}' = 'fc3'
          and layout_json #>> '{slots,3,slotId}' = 'fc4'
          and layout_json #>> '{slots,4,slotId}' = 'fc5'
          and layout_json #>> '{slots,5,slotId}' = 'fc6'
        when 'one_moment' then
          jsonb_array_length(layout_json -> 'slots') = 1
          and layout_json #>> '{slots,0,slotId}' = 'om1'
        when 'instant_memory' then
          jsonb_array_length(layout_json -> 'slots') = 1
          and layout_json #>> '{slots,0,slotId}' = 'im1'
        else false
      end
    else false
  end
);

commit;
