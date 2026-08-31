create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  invite_token_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  display_role text not null,
  avatar_path text,
  seat_order smallint check (seat_order is null or seat_order between 1 and 10),
  boarded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trip_id, name)
);

create unique index if not exists family_members_trip_seat_order_key
on public.family_members (trip_id, seat_order)
where seat_order is not null;

create table if not exists public.trip_memberships (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trip_id, auth_user_id)
);

create index if not exists idx_trip_memberships_auth
on public.trip_memberships(auth_user_id);

create index if not exists idx_trip_memberships_member
on public.trip_memberships(trip_id, family_member_id);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_no smallint not null check (day_no between 1 and 31),
  sequence integer not null,
  time_label text,
  location_name text,
  title text not null,
  description text,
  item_type text,
  created_at timestamptz not null default now(),
  unique (trip_id, day_no, sequence)
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  uploader_member_id uuid not null references public.family_members(id),
  uploader_auth_user_id uuid not null references auth.users(id),
  storage_path text not null unique,
  original_filename text,
  mime_type text,
  caption text check (caption is null or char_length(caption) <= 300),
  taken_at timestamptz,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_photos_trip_created
on public.photos(trip_id, created_at desc);

create table if not exists public.memory_cards (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  creator_member_id uuid not null references public.family_members(id),
  creator_auth_user_id uuid not null references auth.users(id),
  template_key text not null check (
    template_key in (
      'polaroid_moodboard',
      'four_cut',
      'editorial_collage',
      'postcard_duo',
      'scrapbook_trio',
      'film_contact_sheet',
      'one_moment',
      'instant_memory'
    )
  ),
  layout_version integer not null default 1,
  layout_json jsonb not null,
  result_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cards_trip_created
on public.memory_cards(trip_id, created_at desc);

alter table public.trips enable row level security;
alter table public.family_members enable row level security;
alter table public.trip_memberships enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.photos enable row level security;
alter table public.memory_cards enable row level security;
