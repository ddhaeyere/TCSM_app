-- Series rules: a series is for heren, dames or gemengd, and can have a
-- maximum ranking. Tennis compares the sum of the players' points with it
-- (dd30: two ladies with at most 30 points together); padel compares each
-- player's level (pg300: nobody above P300). Both are optional, so series
-- created before this migration keep accepting everyone.

create type public.series_gender as enum ('heren', 'dames', 'gemengd');

alter table public.event_categories
  add column gender public.series_gender,
  add column max_ranking text,
  add constraint event_categories_mixed_is_doubles
    check (gender is distinct from 'gemengd' or format = 'doubles');

-- Points of a ranking: "15" is 15, "P300" is 300, no ranking is 0.
create function public.ranking_points(p_ranking text)
returns integer
language sql immutable set search_path = ''
as $$
  select coalesce(nullif(regexp_replace(coalesce(p_ranking, ''), '[^0-9]', '', 'g'), '')::integer, 0);
$$;

-- Throws when these members together may not play in the series: wrong
-- gender, or a ranking above the series maximum.
create function public.assert_fits_series(p_category public.event_categories, p_members uuid[])
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  m record;
  men integer := 0;
  women integer := 0;
  total integer := 0;
  max_points integer := public.ranking_points(p_category.max_ranking);
begin
  for m in
    select full_name, gender, public.member_ranking(id, p_category) as ranking
    from public.club_members where id = any(p_members)
  loop
    if p_category.gender is not null then
      if m.gender is null then
        raise exception 'Het geslacht van % staat niet in de ledenlijst', m.full_name;
      end if;
      if p_category.gender = 'heren' and m.gender <> 'M' then
        raise exception '% kan niet meespelen in een herenreeks', m.full_name;
      end if;
      if p_category.gender = 'dames' and m.gender <> 'V' then
        raise exception '% kan niet meespelen in een damesreeks', m.full_name;
      end if;
      if m.gender = 'M' then men := men + 1; else women := women + 1; end if;
    end if;

    if p_category.max_ranking is not null
      and public.ranking_points(m.ranking) > max_points then
      raise exception '% (%) heeft een hoger klassement dan deze reeks (%)',
        m.full_name, coalesce(m.ranking, 'geen'), p_category.max_ranking;
    end if;
    total := total + public.ranking_points(m.ranking);
  end loop;

  if p_category.gender = 'gemengd' and (men > 1 or women > 1) then
    raise exception 'In een gemengde reeks speelt een heer samen met een dame';
  end if;

  -- Tennis: the points of both players together.
  if p_category.sport = 'tennis' and p_category.max_ranking is not null
    and total > max_points then
    raise exception 'Samen hebben jullie % punten, meer dan de % van deze reeks',
      total, max_points;
  end if;
end;
$$;

-- Registration functions, now checking the series rules.

create or replace function public.assert_not_registered(p_category_id uuid, p_member_id uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  name text;
begin
  select full_name into name from public.club_members where id = p_member_id;
  if name is null then
    raise exception 'Lid niet gevonden';
  end if;
  if exists (
    select 1 from public.entry_players
    where category_id = p_category_id and member_id = p_member_id
  ) then
    raise exception '% is al ingeschreven in deze reeks', name;
  end if;
end;
$$;

create or replace function public.register_for_category(
  p_category_id uuid,
  p_member_id uuid,
  p_partner_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  cat public.event_categories;
  taken integer;
  new_entry uuid;
begin
  if not public.is_approved() then
    raise exception 'Je account is nog niet goedgekeurd';
  end if;

  cat := public.category_for_registration(p_category_id);
  perform public.assert_fits_series(cat, array_remove(array[p_member_id, p_partner_id], null));

  if p_partner_id is not null then
    if cat.format = 'singles' then
      raise exception 'In het enkelspel speel je zonder partner';
    end if;
    if p_partner_id = p_member_id then
      raise exception 'Kies een andere partner';
    end if;
  end if;

  perform public.assert_not_registered(cat.id, p_member_id);
  if p_partner_id is not null then
    perform public.assert_not_registered(cat.id, p_partner_id);
  end if;

  if cat.max_players is not null then
    -- Serialise registrations per category so the limit cannot be overshot.
    perform 1 from public.event_categories where id = cat.id for update;
    select count(*) into taken from public.entry_players where category_id = cat.id;
    if taken + (case when p_partner_id is null then 1 else 2 end) > cat.max_players then
      raise exception 'Deze categorie is volzet';
    end if;
  end if;

  insert into public.entries (category_id) values (cat.id) returning id into new_entry;

  insert into public.entry_players (entry_id, category_id, member_id, ranking, registered_by)
  values (new_entry, cat.id, p_member_id, public.member_ranking(p_member_id, cat), auth.uid());

  if p_partner_id is not null then
    insert into public.entry_players (entry_id, category_id, member_id, ranking, registered_by)
    values (new_entry, cat.id, p_partner_id, public.member_ranking(p_partner_id, cat), auth.uid());
  end if;

  return new_entry;
end;
$$;

create or replace function public.add_partner(p_entry_id uuid, p_member_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cat public.event_categories;
  category uuid;
  players integer;
begin
  if not public.is_approved() then
    raise exception 'Je account is nog niet goedgekeurd';
  end if;

  select category_id, count(*) into category, players
  from public.entry_players where entry_id = p_entry_id group by category_id;
  if category is null then
    raise exception 'Inschrijving niet gevonden';
  end if;

  cat := public.category_for_registration(category);
  if cat.format <> 'doubles' or players <> 1 then
    raise exception 'Deze speler zoekt geen partner';
  end if;

  perform public.assert_not_registered(cat.id, p_member_id);
  perform public.assert_fits_series(
    cat,
    array(select member_id from public.entry_players where entry_id = p_entry_id) || p_member_id
  );

  insert into public.entry_players (entry_id, category_id, member_id, ranking, registered_by)
  values (p_entry_id, cat.id, p_member_id, public.member_ranking(p_member_id, cat), auth.uid());
end;
$$;

create or replace function public.organiser_pair_entries(p_entry_id uuid, p_other_entry_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a_category uuid;
  b_category uuid;
  a_count integer;
  b_count integer;
begin
  if not public.is_organiser() then
    raise exception 'Alleen beheerders kunnen spelers koppelen';
  end if;
  if p_entry_id = p_other_entry_id then
    raise exception 'Kies twee verschillende spelers';
  end if;

  select category_id, count(*) into a_category, a_count
  from public.entry_players where entry_id = p_entry_id group by category_id;
  select category_id, count(*) into b_category, b_count
  from public.entry_players where entry_id = p_other_entry_id group by category_id;

  if a_category is null or b_category is null or a_category <> b_category then
    raise exception 'Beide spelers moeten in dezelfde categorie ingeschreven zijn';
  end if;
  if a_count <> 1 or b_count <> 1 then
    raise exception 'Beide spelers moeten nog een partner zoeken';
  end if;
  if not exists (
    select 1 from public.event_categories where id = a_category and format = 'doubles'
  ) then
    raise exception 'Koppelen kan alleen in een dubbelcategorie';
  end if;

  perform public.assert_fits_series(
    (select c from public.event_categories c where c.id = a_category),
    array(
      select member_id from public.entry_players
      where entry_id in (p_entry_id, p_other_entry_id)
    )
  );

  update public.entry_players set entry_id = p_entry_id where entry_id = p_other_entry_id;
  delete from public.entries where id = p_other_entry_id;
end;
$$;

revoke execute on function
  public.ranking_points(text),
  public.assert_fits_series(public.event_categories, uuid[])
from public, anon, authenticated;
