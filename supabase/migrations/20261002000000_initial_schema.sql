-- TCSM app: accounts, events, categories and registrations.
--
-- Members only see data once an admin approved their account.
-- Registrations change only through the functions at the bottom of this
-- file, so deadlines, capacity and partner rules are enforced in one place.

create type public.user_role as enum ('member', 'organiser', 'admin');
create type public.account_status as enum ('pending', 'approved', 'rejected');
create type public.sport as enum ('tennis', 'padel');
create type public.play_format as enum ('singles', 'doubles');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.user_role not null default 'member',
  status public.account_status not null default 'pending',
  -- Last ranking the member used, pre-filled on the next registration.
  tennis_ranking text,
  padel_ranking text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  -- Registrations close at this moment; when empty, at the start of the event.
  registration_deadline timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sport public.sport not null,
  format public.play_format not null,
  -- Optional extra name, for example "Gemengd" or "Heren".
  label text,
  max_players integer check (max_players > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index event_categories_event_id_idx on public.event_categories (event_id);

-- One entry is one player (singles) or one team (doubles).
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.event_categories (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index entries_category_id_idx on public.entries (category_id);

create table public.entry_players (
  entry_id uuid not null references public.entries (id) on delete cascade,
  category_id uuid not null references public.event_categories (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Ranking at the moment of registering; stays as it was for this event.
  ranking text,
  -- False while an invited partner has not accepted yet.
  confirmed boolean not null default true,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (entry_id, profile_id),
  unique (category_id, profile_id)
);

create index entry_players_profile_id_idx on public.entry_players (profile_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.is_approved()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

create function public.is_organiser()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved' and role in ('organiser', 'admin')
  );
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved' and role = 'admin'
  );
$$;

-- Every new account gets a profile. The very first account becomes an
-- approved admin, so the club can bootstrap without touching the database.
create function public.handle_new_user()
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_categories enable row level security;
alter table public.entries enable row level security;
alter table public.entry_players enable row level security;

-- Profiles: everyone sees their own; approved members see each other.
-- Email addresses are only readable by admins, through admin_list_profiles().
create policy "profiles: read own or as approved member"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_approved());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on public.profiles from anon, authenticated;
grant select (id, full_name, role, status, tennis_ranking, padel_ranking, created_at)
  on public.profiles to authenticated;
grant update (full_name, tennis_ranking, padel_ranking)
  on public.profiles to authenticated;

-- Events and categories: approved members read, organisers write.
create policy "events: approved members read"
  on public.events for select to authenticated
  using (public.is_approved());

create policy "events: organisers insert"
  on public.events for insert to authenticated
  with check (public.is_organiser());

create policy "events: organisers update"
  on public.events for update to authenticated
  using (public.is_organiser())
  with check (public.is_organiser());

create policy "events: organisers delete"
  on public.events for delete to authenticated
  using (public.is_organiser());

create policy "categories: approved members read"
  on public.event_categories for select to authenticated
  using (public.is_approved());

create policy "categories: organisers insert"
  on public.event_categories for insert to authenticated
  with check (public.is_organiser());

create policy "categories: organisers update"
  on public.event_categories for update to authenticated
  using (public.is_organiser())
  with check (public.is_organiser());

create policy "categories: organisers delete"
  on public.event_categories for delete to authenticated
  using (public.is_organiser());

-- Registrations: approved members read; writes go through the functions below.
create policy "entries: approved members read"
  on public.entries for select to authenticated
  using (public.is_approved());

create policy "entry players: approved members read"
  on public.entry_players for select to authenticated
  using (public.is_approved());

revoke all on public.events, public.event_categories, public.entries, public.entry_players
  from anon;
revoke insert, update, delete on public.entries, public.entry_players
  from authenticated;

-- ---------------------------------------------------------------------------
-- Registration functions
-- ---------------------------------------------------------------------------

-- Throws when registrations for the category are closed.
create function public.assert_registration_open(p_category_id uuid)
returns public.event_categories
language plpgsql stable security definer set search_path = ''
as $$
declare
  cat public.event_categories;
  closes_at timestamptz;
begin
  select * into cat from public.event_categories where id = p_category_id;
  if not found then
    raise exception 'Categorie niet gevonden';
  end if;

  select coalesce(e.registration_deadline, e.starts_at) into closes_at
  from public.events e where e.id = cat.event_id;

  if now() >= closes_at then
    raise exception 'De inschrijvingen voor dit evenement zijn gesloten';
  end if;

  return cat;
end;
$$;

create function public.remember_ranking(p_profile_id uuid, p_sport public.sport, p_ranking text)
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles
  set tennis_ranking = case when p_sport = 'tennis' then p_ranking else tennis_ranking end,
      padel_ranking = case when p_sport = 'padel' then p_ranking else padel_ranking end
  where id = p_profile_id;
$$;

-- Register the current member, alone or with an invited partner (doubles).
-- Registering alone for doubles means "looking for a partner".
create function public.register_for_category(
  p_category_id uuid,
  p_ranking text,
  p_partner_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cat public.event_categories;
  taken integer;
  new_entry uuid;
begin
  if not public.is_approved() then
    raise exception 'Je account is nog niet goedgekeurd';
  end if;

  cat := public.assert_registration_open(p_category_id);

  if coalesce(trim(p_ranking), '') = '' then
    raise exception 'Kies je klassement';
  end if;

  if exists (select 1 from public.entry_players where category_id = cat.id and profile_id = me) then
    raise exception 'Je bent al ingeschreven in deze categorie';
  end if;

  if p_partner_id is not null then
    if cat.format = 'singles' then
      raise exception 'In het enkel speel je zonder partner';
    end if;
    if p_partner_id = me then
      raise exception 'Je kan jezelf niet als partner kiezen';
    end if;
    if not exists (select 1 from public.profiles where id = p_partner_id and status = 'approved') then
      raise exception 'Partner niet gevonden';
    end if;
    if exists (select 1 from public.entry_players where category_id = cat.id and profile_id = p_partner_id) then
      raise exception 'Je partner is al ingeschreven in deze categorie';
    end if;
  end if;

  if cat.max_players is not null then
    -- Serialise registrations per category so the limit cannot be overshot.
    perform 1 from public.event_categories where id = cat.id for update;
    select count(*) into taken from public.entry_players where category_id = cat.id;
    if p_partner_id is not null then
      taken := taken + 1;
    end if;
    if taken + 1 > cat.max_players then
      raise exception 'Deze categorie is volzet';
    end if;
  end if;

  insert into public.entries (category_id) values (cat.id) returning id into new_entry;

  insert into public.entry_players (entry_id, category_id, profile_id, ranking, confirmed)
  values (new_entry, cat.id, me, trim(p_ranking), true);

  if p_partner_id is not null then
    insert into public.entry_players (entry_id, category_id, profile_id, confirmed, invited_by)
    values (new_entry, cat.id, p_partner_id, false, me);
  end if;

  perform public.remember_ranking(me, cat.sport, trim(p_ranking));

  return new_entry;
end;
$$;

-- Accept or decline an invitation to play as someone's partner.
create function public.respond_to_invitation(
  p_entry_id uuid,
  p_accept boolean,
  p_ranking text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cat public.event_categories;
  invite public.entry_players;
begin
  select * into invite from public.entry_players
  where entry_id = p_entry_id and profile_id = me and not confirmed;
  if not found then
    raise exception 'Uitnodiging niet gevonden';
  end if;

  if not p_accept then
    -- The inviter stays registered and is now looking for a partner.
    delete from public.entry_players where entry_id = p_entry_id and profile_id = me;
    return;
  end if;

  cat := public.assert_registration_open(invite.category_id);

  if coalesce(trim(p_ranking), '') = '' then
    raise exception 'Kies je klassement';
  end if;

  update public.entry_players
  set confirmed = true, ranking = trim(p_ranking)
  where entry_id = p_entry_id and profile_id = me;

  perform public.remember_ranking(me, cat.sport, trim(p_ranking));
end;
$$;

-- Unregister the current member from an entry. A partner who already
-- confirmed stays registered as looking for a partner; an invitation that
-- was not accepted yet is withdrawn together with the entry.
create function public.withdraw_registration(p_entry_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  mine public.entry_players;
begin
  select * into mine from public.entry_players
  where entry_id = p_entry_id and profile_id = me and confirmed;
  if not found then
    raise exception 'Inschrijving niet gevonden';
  end if;

  perform public.assert_registration_open(mine.category_id);

  delete from public.entry_players where entry_id = p_entry_id and profile_id = me;
  delete from public.entry_players where entry_id = p_entry_id and not confirmed;
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
    raise exception 'Alleen organisatoren kunnen spelers koppelen';
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

  update public.entry_players
  set entry_id = p_entry_id, confirmed = true
  where entry_id = p_other_entry_id;

  delete from public.entries where id = p_other_entry_id;
end;
$$;

-- Split a team: the second player gets an entry of their own again.
create function public.organiser_split_entry(p_entry_id uuid, p_profile_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  player public.entry_players;
  new_entry uuid;
begin
  if not public.is_organiser() then
    raise exception 'Alleen organisatoren kunnen teams splitsen';
  end if;

  select * into player from public.entry_players
  where entry_id = p_entry_id and profile_id = p_profile_id;
  if not found then
    raise exception 'Speler niet gevonden';
  end if;
  if (select count(*) from public.entry_players where entry_id = p_entry_id) < 2 then
    raise exception 'Deze speler heeft geen partner';
  end if;

  if exists (select 1 from public.entry_players where entry_id = p_entry_id and not confirmed) then
    raise exception 'Dit team is nog niet bevestigd; verwijder de uitnodiging in de plaats';
  end if;

  insert into public.entries (category_id) values (player.category_id) returning id into new_entry;
  update public.entry_players set entry_id = new_entry
  where entry_id = p_entry_id and profile_id = p_profile_id;
end;
$$;

-- Remove a player from an event, regardless of the deadline.
create function public.organiser_remove_player(p_entry_id uuid, p_profile_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_organiser() then
    raise exception 'Alleen organisatoren kunnen spelers verwijderen';
  end if;

  delete from public.entry_players where entry_id = p_entry_id and profile_id = p_profile_id;
  delete from public.entry_players where entry_id = p_entry_id and not confirmed;
  delete from public.entries e
  where e.id = p_entry_id
    and not exists (select 1 from public.entry_players p where p.entry_id = e.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin functions
-- ---------------------------------------------------------------------------

create function public.admin_list_profiles()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.user_role,
  status public.account_status,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Alleen beheerders kunnen accounts bekijken';
  end if;

  return query
  select p.id, p.full_name, p.email, p.role, p.status, p.created_at
  from public.profiles p
  order by p.status = 'pending' desc, p.full_name;
end;
$$;

create function public.admin_update_profile(
  p_profile_id uuid,
  p_status public.account_status default null,
  p_role public.user_role default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Alleen beheerders kunnen accounts aanpassen';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'Je kan je eigen account niet aanpassen';
  end if;

  update public.profiles
  set status = coalesce(p_status, status),
      role = coalesce(p_role, role)
  where id = p_profile_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.is_approved(),
  public.is_organiser(),
  public.is_admin(),
  public.register_for_category(uuid, text, uuid),
  public.respond_to_invitation(uuid, boolean, text),
  public.withdraw_registration(uuid),
  public.organiser_pair_entries(uuid, uuid),
  public.organiser_split_entry(uuid, uuid),
  public.organiser_remove_player(uuid, uuid),
  public.admin_list_profiles(),
  public.admin_update_profile(uuid, public.account_status, public.user_role)
to authenticated;

-- Internal helpers stay private.
revoke execute on function
  public.assert_registration_open(uuid),
  public.remember_ranking(uuid, public.sport, text),
  public.handle_new_user()
from authenticated;
