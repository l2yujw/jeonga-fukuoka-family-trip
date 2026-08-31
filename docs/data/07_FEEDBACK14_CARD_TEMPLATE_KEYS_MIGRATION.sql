begin;

alter table public.memory_cards
drop constraint if exists memory_cards_template_key_check;

alter table public.memory_cards
add constraint memory_cards_template_key_check check (
  template_key in (
    'polaroid_moodboard',
    'four_cut',
    'editorial_collage',
    'postcard_duo',
    'scrapbook_trio',
    'film_contact_sheet'
  )
);

commit;
