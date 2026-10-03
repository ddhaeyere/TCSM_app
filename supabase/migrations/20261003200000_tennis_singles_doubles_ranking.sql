-- A tennis ranking can differ between singles and doubles, so profiles keep
-- one for each. The existing tennis ranking becomes the doubles ranking.

alter table public.profiles rename column tennis_ranking to tennis_doubles_ranking;
alter table public.profiles add column tennis_singles_ranking text;

grant select (tennis_singles_ranking) on public.profiles to authenticated;
grant update (tennis_singles_ranking) on public.profiles to authenticated;

-- Remember the ranking a member used, per sport and format, so it is
-- pre-filled next time. A trigger knows the category's format, which the
-- registration functions did not pass on.
create function public.remember_entry_ranking()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cat public.event_categories;
begin
  if new.ranking is null or not new.confirmed then
    return new;
  end if;

  select * into cat from public.event_categories where id = new.category_id;

  update public.profiles
  set tennis_singles_ranking = case
        when cat.sport = 'tennis' and cat.format = 'singles' then new.ranking
        else tennis_singles_ranking end,
      tennis_doubles_ranking = case
        when cat.sport = 'tennis' and cat.format = 'doubles' then new.ranking
        else tennis_doubles_ranking end,
      padel_ranking = case when cat.sport = 'padel' then new.ranking else padel_ranking end
  where id = new.profile_id;

  return new;
end;
$$;

revoke execute on function public.remember_entry_ranking() from public, anon, authenticated;

create trigger entry_players_remember_ranking
  after insert or update of ranking, confirmed on public.entry_players
  for each row execute function public.remember_entry_ranking();

-- register_for_category and respond_to_invitation still call this; the
-- trigger above now does the work.
create or replace function public.remember_ranking(p_profile_id uuid, p_sport public.sport, p_ranking text)
returns void
language sql security definer set search_path = ''
as $$
  select;
$$;
