-- Padel is always played as doubles.
alter table public.event_categories
  add constraint event_categories_padel_is_doubles
  check (sport <> 'padel' or format = 'doubles');
