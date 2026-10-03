export type Sport = "tennis" | "padel";
export type PlayFormat = "singles" | "doubles";
export type UserRole = "member" | "organiser" | "admin";
export type AccountStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  status: AccountStatus;
  tennis_ranking: string | null;
  padel_ranking: string | null;
}

export interface EntryPlayer {
  entry_id: string;
  profile_id: string;
  ranking: string | null;
  confirmed: boolean;
  created_at: string;
  player: { full_name: string } | null;
}

export interface Category {
  id: string;
  sport: Sport;
  format: PlayFormat;
  label: string | null;
  max_players: number | null;
  position: number;
  entry_players: EntryPlayer[];
}

export interface ClubEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  registration_deadline: string | null;
  event_categories: Category[];
}

// Select string shared by the pages that show events with their registrations.
export const EVENT_SELECT = `
  id, title, description, location, starts_at, ends_at, registration_deadline,
  event_categories (
    id, sport, format, label, max_players, position,
    entry_players (
      entry_id, profile_id, ranking, confirmed, created_at,
      player:profiles!entry_players_profile_id_fkey ( full_name )
    )
  )
`;
