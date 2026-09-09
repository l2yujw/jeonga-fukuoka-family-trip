begin;

-- DB-FIRST release gate: apply only after separate approval and isolated RLS tests.
-- Existing SQL07–14 and rows are unchanged. v3 writers remain valid during rollout.
-- Pure bounded metadata validation; pixel fit and result bytes are checked by the renderer.
create or replace function public.is_memory_card_watercolor_v4(template text, value jsonb)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $$
declare
  slot_ids text[]; date_keys text[]; text_rules jsonb; primary_key text;
  field record; slot jsonb; placement jsonb; v text; n numeric; i integer;
  photo_ids text[] := array[]::text[]; expected_date date;
begin
  if jsonb_typeof(value) is distinct from 'object'
    or value - array['version','templateRevision','slots','textValues','dateValues','caption'] <> '{}'::jsonb
    or (select count(*) from jsonb_object_keys(value)) <> 6
    or value->'version' is distinct from '4'::jsonb
    or value->>'templateRevision' is distinct from 'watercolor-2026-v1'
    or octet_length(value::text) > 32768 then return false; end if;
  case template
    when 'polaroid_moodboard' then
      slot_ids := array['p1','p2','p3','p4'];
      text_rules := '{"main_title":[34,2],"subtitle":[54,2],"photo.p1.caption":[42,2],"photo.p2.caption":[42,2],"photo.p3.caption":[42,2],"photo.p4.caption":[42,2],"footer_note":[100,3]}'::jsonb;
      date_keys := array['trip.start','trip.end'];
      primary_key := 'main_title';
    when 'four_cut' then
      slot_ids := array['f1','f2','f3','f4'];
      text_rules := '{"vertical_title":[22,1],"vertical_subtitle":[36,1],"footer_note":[90,4]}'::jsonb;
      date_keys := array['trip.start','trip.end'];
      primary_key := 'vertical_title';
    when 'editorial_collage' then
      slot_ids := array['e1','e2','e3','e4','e5','e6'];
      text_rules := '{"main_title":[32,2],"subtitle":[45,2],"lead_note":[140,5],"photo.e2.title":[30,2],"photo.e2.note":[80,3],"photo.e3.title":[30,2],"photo.e3.note":[80,3],"photo.e4.title":[30,2],"photo.e4.note":[80,3],"photo.e5.title":[30,2],"photo.e5.note":[80,3],"photo.e6.title":[30,2],"photo.e6.note":[80,3],"closing_note":[120,3]}'::jsonb;
      date_keys := array['trip.start','trip.end'];
      primary_key := 'main_title';
    when 'postcard_duo' then
      slot_ids := array['pd1','pd2'];
      text_rules := '{"main_title":[30,2],"subtitle":[48,2],"photo.pd1.note":[100,3],"photo.pd2.note":[100,3],"location":[24,1]}'::jsonb;
      date_keys := array['trip.start','trip.end'];
      primary_key := 'main_title';
    when 'scrapbook_trio' then
      slot_ids := array['st1','st2','st3'];
      text_rules := '{"main_title":[30,2],"subtitle":[46,2],"photo.st1.title":[30,2],"photo.st1.note":[100,4],"photo.st2.title":[30,2],"photo.st2.note":[100,4],"photo.st3.title":[30,2],"photo.st3.note":[100,4],"footer_note":[96,3]}'::jsonb;
      date_keys := array['trip.start','trip.end'];
      primary_key := 'main_title';
    when 'film_contact_sheet' then
      slot_ids := array['fc1','fc2','fc3','fc4','fc5','fc6'];
      text_rules := '{"badge_title":[18,1],"main_title":[34,2],"photo.fc1.caption":[38,2],"photo.fc2.caption":[38,2],"photo.fc3.caption":[38,2],"photo.fc4.caption":[38,2],"photo.fc5.caption":[38,2],"photo.fc6.caption":[38,2],"footer_note":[72,2],"signoff":[40,1]}'::jsonb;
      date_keys := array['trip.start','trip.end','photo.fc1.date','photo.fc2.date','photo.fc3.date','photo.fc4.date','photo.fc5.date','photo.fc6.date'];
      primary_key := 'main_title';
    when 'one_moment' then
      slot_ids := array['om1'];
      text_rules := '{"overlay_title":[32,2],"overlay_subtitle":[54,2]}'::jsonb;
      date_keys := array['trip.start','trip.end'];
      primary_key := 'overlay_title';
    when 'instant_memory' then
      slot_ids := array['im1'];
      text_rules := '{"short_message":[38,2],"main_title":[34,2]}'::jsonb;
      date_keys := array['trip.start','trip.end'];
      primary_key := 'main_title';
    else return false;
  end case;
  if jsonb_typeof(value->'slots') is distinct from 'array'
    or jsonb_typeof(value->'textValues') is distinct from 'object'
    or jsonb_typeof(value->'dateValues') is distinct from 'object' then return false; end if;
  if jsonb_array_length(value->'slots') <> cardinality(slot_ids)
    or (select array_agg(k order by k) from jsonb_object_keys(value->'textValues') k)
       is distinct from (select array_agg(k order by k) from jsonb_object_keys(text_rules) k)
    or (select array_agg(k order by k) from jsonb_object_keys(value->'dateValues') k)
       is distinct from (select array_agg(k order by k) from unnest(date_keys) k)
    then return false; end if;
  for field in select * from jsonb_each(text_rules) loop
    if value->'textValues'->field.key = 'null'::jsonb then continue; end if;
    if jsonb_typeof(value->'textValues'->field.key) is distinct from 'string' then return false; end if;
    v := value->'textValues'->>field.key;
    if v <> normalize(v, NFC) or v ~ E'[\r\x01-\x08\x0B\x0C\x0E-\x1F\x7F]'
      or v !~ '[^[:space:]]'
      or char_length(normalize(v, NFC)) > (field.value->>0)::integer
      or char_length(v)-char_length(replace(v,E'\n',''))+1 > (field.value->>1)::integer
      then return false; end if;
  end loop;
  if value->'caption' is distinct from value->'textValues'->primary_key then return false; end if;
  foreach v in array date_keys loop
    if value->'dateValues'->v = 'null'::jsonb then continue; end if;
    if jsonb_typeof(value->'dateValues'->v) is distinct from 'string' then return false; end if;
    v := value->'dateValues'->>v;
    if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or substring(v,1,4)::integer < 1 then return false; end if;
    expected_date := make_date(substring(v,1,4)::integer,substring(v,6,2)::integer,substring(v,9,2)::integer);
    if to_char(expected_date,'YYYY-MM-DD') <> v then return false; end if;
  end loop;
  if ((value#>'{dateValues,trip.start}') = 'null'::jsonb) <> ((value#>'{dateValues,trip.end}') = 'null'::jsonb)
    or (value#>>'{dateValues,trip.start}') > (value#>>'{dateValues,trip.end}') then return false; end if;
  for i in 0..cardinality(slot_ids)-1 loop
    slot := value->'slots'->i;
    if jsonb_typeof(slot) is distinct from 'object' or slot - array['slotId','photoId','placement'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(slot)) <> 3
      or slot->>'slotId' is distinct from slot_ids[i+1]
      or jsonb_typeof(slot->'photoId') is distinct from 'string'
      or slot->>'photoId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or lower(slot->>'photoId') = any(photo_ids) then return false; end if;
    photo_ids := array_append(photo_ids,lower(slot->>'photoId'));
    placement := slot->'placement';
    if jsonb_typeof(placement) is distinct from 'object' or placement - array['zoom','rotation','offsetX','offsetY'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(placement)) <> 4 then return false; end if;
    for field in select * from jsonb_each(placement) loop
      if jsonb_typeof(field.value) is distinct from 'number' then return false; end if;
      n := field.value::text::numeric;
      if abs(n) > 10000 or (field.key='zoom' and n<1) or (field.key='rotation' and (n < -180 or n >= 180)) then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function public.is_memory_card_watercolor_v4(text,jsonb) from public, anon;
grant execute on function public.is_memory_card_watercolor_v4(text,jsonb) to authenticated;

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
  and layout_json -> 'version' = to_jsonb(layout_version)
  and result_storage_path is not null
  and (storage.foldername(result_storage_path))[1] = memory_cards.trip_id::text
  and (storage.foldername(result_storage_path))[2] = (select auth.uid()::text)
  and cardinality(storage.foldername(result_storage_path)) = 2
  and storage.filename(result_storage_path) ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$'
  and (
    (layout_version = 3 and (
jsonb_typeof(layout_json) = 'object'
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
    ))
    or (layout_version = 4
      and public.is_memory_card_watercolor_v4(template_key,layout_json)
      and not exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(layout_json->'slots')='array' then layout_json->'slots' else '[]'::jsonb end) s
        where not exists (
          select 1 from public.photos p where p.trip_id=memory_cards.trip_id and p.id::text=lower(s->>'photoId')
        )
      )
    )
  )
);

-- No UPDATE grant/policy, Storage replacement grant, historical UPDATE or backfill.
commit;
