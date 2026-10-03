-- A series can only be changed in a way that still fits everyone already
-- registered: a mixed series with men in it cannot become a ladies' series,
-- a lower maximum ranking must still hold for every team, and the player
-- limit cannot drop below the number of players registered.
create function public.check_series_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  team record;
  players integer;
begin
  select count(*) into players from public.entry_players where category_id = new.id;
  if new.max_players is not null and new.max_players < players then
    raise exception 'Er zijn al % spelers ingeschreven, het maximum kan niet lager', players;
  end if;

  for team in
    select entry_id, array_agg(member_id) as members
    from public.entry_players where category_id = new.id
    group by entry_id
  loop
    begin
      perform public.assert_fits_series(new, team.members);
    exception when raise_exception then
      raise exception 'Deze aanpassing past niet bij een bestaande inschrijving: %', sqlerrm;
    end;
  end loop;
  return new;
end;
$$;

create trigger event_categories_check_change
  before update of gender, max_ranking, max_players on public.event_categories
  for each row
  when (
    old.gender is distinct from new.gender
    or old.max_ranking is distinct from new.max_ranking
    or old.max_players is distinct from new.max_players
  )
  execute function public.check_series_change();

revoke execute on function public.check_series_change() from public, anon, authenticated;
