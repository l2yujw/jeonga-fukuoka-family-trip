begin;

alter table public.family_members
add column if not exists seat_order smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.family_members'::regclass
      and conname = 'family_members_seat_order_check'
  ) then
    alter table public.family_members
    add constraint family_members_seat_order_check
    check (seat_order is null or seat_order between 1 and 10);
  end if;
end
$$;

create unique index if not exists family_members_trip_seat_order_key
on public.family_members (trip_id, seat_order)
where seat_order is not null;

commit;
