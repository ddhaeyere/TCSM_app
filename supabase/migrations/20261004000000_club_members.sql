-- Club member list.
--
-- Registrations now point to members of the club list instead of to login
-- accounts, so anyone with an account can register any member (themselves,
-- a partner, a family member). An account is linked to its member through
-- the email address. Rankings live on the member list and are copied onto
-- each registration.

create type public.gender as enum ('M', 'V');

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  last_name text not null,
  first_name text not null,
  full_name text generated always as (first_name || ' ' || last_name) stored,
  gender public.gender,
  email text,
  tennis_singles_ranking text,
  tennis_doubles_ranking text,
  padel_ranking text,
  -- The login account of this member, found through the email address.
  profile_id uuid unique references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index club_members_email_idx on public.club_members (lower(email));
create index club_members_name_idx on public.club_members (last_name, first_name);

-- Rankings moved to the member list.
alter table public.profiles drop column tennis_ranking, drop column padel_ranking;

-- ---------------------------------------------------------------------------
-- Registrations point to club members
-- ---------------------------------------------------------------------------

drop function public.respond_to_invitation(uuid, boolean, text);
drop function public.withdraw_registration(uuid);
drop function public.register_for_category(uuid, text, uuid);
drop function public.organiser_pair_entries(uuid, uuid);
drop function public.organiser_split_entry(uuid, uuid);
drop function public.organiser_remove_player(uuid, uuid);
drop function public.remember_ranking(uuid, public.sport, text);

-- Registrations made before the member list cannot be mapped to members.
drop table public.entry_players;
delete from public.entries;

create table public.entry_players (
  entry_id uuid not null references public.entries (id) on delete cascade,
  category_id uuid not null references public.event_categories (id) on delete cascade,
  member_id uuid not null references public.club_members (id) on delete cascade,
  -- Ranking at the moment of registering; stays as it was for this event.
  ranking text,
  -- The account that made the registration, which may be someone else.
  registered_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (entry_id, member_id),
  -- A member can be registered only once per category.
  unique (category_id, member_id)
);

create index entry_players_member_id_idx on public.entry_players (member_id);

alter table public.entry_players enable row level security;

create policy "entry players: approved members read"
  on public.entry_players for select to authenticated
  using (public.is_approved());

revoke all on public.entry_players from anon;
revoke insert, update, delete on public.entry_players from authenticated;

-- ---------------------------------------------------------------------------
-- Access to the member list
-- ---------------------------------------------------------------------------

alter table public.club_members enable row level security;

-- Approved members see the list, without email addresses.
create policy "club members: approved members read"
  on public.club_members for select to authenticated
  using (public.is_approved());

-- Members keep their own rankings up to date; admins edit everyone.
create policy "club members: update own or as admin"
  on public.club_members for update to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

revoke all on public.club_members from anon, authenticated;
grant select (
  id, last_name, first_name, full_name, gender,
  tennis_singles_ranking, tennis_doubles_ranking, padel_ranking, profile_id
) on public.club_members to authenticated;
grant update (tennis_singles_ranking, tennis_doubles_ranking, padel_ranking)
  on public.club_members to authenticated;

-- ---------------------------------------------------------------------------
-- Linking accounts to members
-- ---------------------------------------------------------------------------

-- Links accounts and members that share an email address. An account that
-- gets linked this way is approved: being on the club list is enough.
create function public.link_accounts_to_members()
returns void
language sql security definer set search_path = ''
as $$
  with linked as (
    update public.club_members m
    set profile_id = p.id
    from public.profiles p
    where m.profile_id is null
      and m.email is not null
      and lower(m.email) = lower(p.email)
      and not exists (select 1 from public.club_members o where o.profile_id = p.id)
    returning p.id
  )
  update public.profiles p
  set status = 'approved'
  from linked
  where p.id = linked.id and p.status = 'pending';
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from public.profiles) into is_first;

  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email),
    new.email,
    case when is_first then 'admin' else 'member' end::public.user_role,
    case when is_first then 'approved' else 'pending' end::public.account_status
  );

  perform public.link_accounts_to_members();
  return new;
end;
$$;

-- The member that belongs to the logged-in account, if any.
create function public.current_member_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.club_members where profile_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Registration functions
-- ---------------------------------------------------------------------------

-- The ranking of a member for the kind of category.
create function public.member_ranking(p_member_id uuid, p_category public.event_categories)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when p_category.sport = 'padel' then m.padel_ranking
    when p_category.format = 'singles' then m.tennis_singles_ranking
    else m.tennis_doubles_ranking
  end
  from public.club_members m where m.id = p_member_id;
$$;

-- Throws when the member already plays in the category.
create function public.assert_not_registered(p_category_id uuid, p_member_id uuid)
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
    raise exception '% is al ingeschreven in deze categorie', name;
  end if;
end;
$$;

-- Register a member, alone or with a partner (doubles). Registering alone
-- for doubles means "looking for a partner". Any approved account can
-- register any member of the club.
create function public.register_for_category(
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

  cat := public.assert_registration_open(p_category_id);

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

-- Add a partner to a member who is looking for one.
create function public.add_partner(p_entry_id uuid, p_member_id uuid)
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

  cat := public.assert_registration_open(category);
  if cat.format <> 'doubles' or players <> 1 then
    raise exception 'Deze speler zoekt geen partner';
  end if;

  perform public.assert_not_registered(cat.id, p_member_id);

  insert into public.entry_players (entry_id, category_id, member_id, ranking, registered_by)
  values (p_entry_id, cat.id, p_member_id, public.member_ranking(p_member_id, cat), auth.uid());
end;
$$;

-- Unregister a member. Allowed for the member themselves, for whoever made
-- the registration, and for organisers (also after the deadline). A partner
-- stays registered and is then looking for a partner again.
create function public.withdraw_registration(p_entry_id uuid, p_member_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  player public.entry_players;
begin
  select * into player from public.entry_players
  where entry_id = p_entry_id and member_id = p_member_id;
  if not found then
    raise exception 'Inschrijving niet gevonden';
  end if;

  if not public.is_organiser() then
    if not public.is_approved() or not (
      coalesce(player.registered_by = auth.uid(), false)
      or coalesce(player.member_id = public.current_member_id(), false)
    ) then
      raise exception 'Je kan alleen jezelf of wie jij inschreef uitschrijven';
    end if;
    perform public.assert_registration_open(player.category_id);
  end if;

  delete from public.entry_players where entry_id = p_entry_id and member_id = p_member_id;
  delete from public.entries e
  where e.id = p_entry_id
    and not exists (select 1 from public.entry_players p where p.entry_id = e.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Organiser functions
-- ---------------------------------------------------------------------------

-- Pair two members who registered alone for the same doubles category.
create function public.organiser_pair_entries(p_entry_id uuid, p_other_entry_id uuid)
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

  update public.entry_players set entry_id = p_entry_id where entry_id = p_other_entry_id;
  delete from public.entries where id = p_other_entry_id;
end;
$$;

-- Split a team: the second player gets an entry of their own again.
create function public.organiser_split_entry(p_entry_id uuid, p_member_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  player public.entry_players;
  new_entry uuid;
begin
  if not public.is_organiser() then
    raise exception 'Alleen beheerders kunnen teams splitsen';
  end if;

  select * into player from public.entry_players
  where entry_id = p_entry_id and member_id = p_member_id;
  if not found then
    raise exception 'Speler niet gevonden';
  end if;
  if (select count(*) from public.entry_players where entry_id = p_entry_id) < 2 then
    raise exception 'Deze speler heeft geen partner';
  end if;

  insert into public.entries (category_id) values (player.category_id) returning id into new_entry;
  update public.entry_players set entry_id = new_entry
  where entry_id = p_entry_id and member_id = p_member_id;
end;
$$;

-- Names and email addresses of the players of an entry, for the
-- confirmation mail. Only for whoever just made the registration.
create function public.registration_mail_details(p_entry_id uuid)
returns table (full_name text, email text, registered_by_name text, is_self boolean)
language sql stable security definer set search_path = ''
as $$
  select m.full_name, m.email, p.full_name, m.profile_id is not distinct from auth.uid()
  from public.entry_players ep
  join public.club_members m on m.id = ep.member_id
  left join public.profiles p on p.id = ep.registered_by
  where ep.entry_id = p_entry_id
    and ep.registered_by = auth.uid()
    and ep.created_at > now() - interval '5 minutes';
$$;

-- ---------------------------------------------------------------------------
-- Admin functions for the member list
-- ---------------------------------------------------------------------------

-- The member list with email addresses.
create function public.admin_list_members()
returns table (
  id uuid,
  last_name text,
  first_name text,
  full_name text,
  gender public.gender,
  email text,
  tennis_singles_ranking text,
  tennis_doubles_ranking text,
  padel_ranking text,
  profile_id uuid
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Alleen beheerders kunnen de ledenlijst beheren';
  end if;

  return query
  select m.id, m.last_name, m.first_name, m.full_name, m.gender, m.email,
         m.tennis_singles_ranking, m.tennis_doubles_ranking, m.padel_ranking, m.profile_id
  from public.club_members m
  order by m.last_name, m.first_name;
end;
$$;

-- Add or update members. Each row is a JSON object with last_name,
-- first_name, gender, email and the three rankings. A row matches an
-- existing member on email, or else on first and last name.
create function public.admin_import_members(p_rows jsonb)
returns table (added integer, updated integer)
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb;
  existing uuid;
  n_added integer := 0;
  n_updated integer := 0;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Alleen beheerders kunnen leden importeren';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_email := nullif(lower(trim(r ->> 'email')), '');
    existing := null;

    if v_email is not null then
      select id into existing from public.club_members where lower(email) = v_email;
    end if;
    if existing is null then
      select id into existing from public.club_members
      where lower(last_name) = lower(trim(r ->> 'last_name'))
        and lower(first_name) = lower(trim(r ->> 'first_name'))
      limit 1;
    end if;

    if existing is null then
      insert into public.club_members (
        last_name, first_name, gender, email,
        tennis_singles_ranking, tennis_doubles_ranking, padel_ranking
      ) values (
        trim(r ->> 'last_name'),
        trim(r ->> 'first_name'),
        nullif(r ->> 'gender', '')::public.gender,
        v_email,
        nullif(r ->> 'tennis_singles_ranking', ''),
        nullif(r ->> 'tennis_doubles_ranking', ''),
        nullif(r ->> 'padel_ranking', '')
      );
      n_added := n_added + 1;
    else
      update public.club_members set
        last_name = trim(r ->> 'last_name'),
        first_name = trim(r ->> 'first_name'),
        gender = coalesce(nullif(r ->> 'gender', '')::public.gender, gender),
        email = coalesce(v_email, email),
        tennis_singles_ranking = coalesce(nullif(r ->> 'tennis_singles_ranking', ''), tennis_singles_ranking),
        tennis_doubles_ranking = coalesce(nullif(r ->> 'tennis_doubles_ranking', ''), tennis_doubles_ranking),
        padel_ranking = coalesce(nullif(r ->> 'padel_ranking', ''), padel_ranking)
      where id = existing;
      n_updated := n_updated + 1;
    end if;
  end loop;

  perform public.link_accounts_to_members();
  return query select n_added, n_updated;
end;
$$;

-- Change one member's details.
create function public.admin_update_member(
  p_member_id uuid,
  p_last_name text,
  p_first_name text,
  p_gender public.gender,
  p_email text,
  p_tennis_singles_ranking text,
  p_tennis_doubles_ranking text,
  p_padel_ranking text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := nullif(lower(trim(p_email)), '');
begin
  if not public.is_admin() then
    raise exception 'Alleen beheerders kunnen leden aanpassen';
  end if;
  if exists (
    select 1 from public.club_members where lower(email) = v_email and id <> p_member_id
  ) then
    raise exception 'Een ander lid heeft al dit e-mailadres';
  end if;

  update public.club_members set
    last_name = trim(p_last_name),
    first_name = trim(p_first_name),
    gender = p_gender,
    email = v_email,
    -- A changed email address is linked again below.
    profile_id = case when lower(email) is distinct from v_email then null else profile_id end,
    tennis_singles_ranking = nullif(p_tennis_singles_ranking, ''),
    tennis_doubles_ranking = nullif(p_tennis_doubles_ranking, ''),
    padel_ranking = nullif(p_padel_ranking, '')
  where id = p_member_id;

  perform public.link_accounts_to_members();
end;
$$;

create function public.admin_delete_member(p_member_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Alleen beheerders kunnen leden verwijderen';
  end if;

  delete from public.club_members where id = p_member_id;
  -- Partners of the removed member are looking for a partner again;
  -- entries without players disappear.
  delete from public.entries e
  where not exists (select 1 from public.entry_players p where p.entry_id = e.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.current_member_id(),
  public.register_for_category(uuid, uuid, uuid),
  public.add_partner(uuid, uuid),
  public.withdraw_registration(uuid, uuid),
  public.organiser_pair_entries(uuid, uuid),
  public.organiser_split_entry(uuid, uuid),
  public.registration_mail_details(uuid),
  public.admin_list_members(),
  public.admin_import_members(jsonb),
  public.admin_update_member(uuid, text, text, public.gender, text, text, text, text),
  public.admin_delete_member(uuid)
to authenticated;

revoke execute on function
  public.link_accounts_to_members(),
  public.member_ranking(uuid, public.event_categories),
  public.assert_not_registered(uuid, uuid)
from authenticated;
