export type Sport = "tennis" | "padel";
export type PlayFormat = "singles" | "doubles";
export type UserRole = "member" | "organiser" | "admin";
export type AccountStatus = "pending" | "approved" | "rejected";
export type Gender = "M" | "V";
export type SeriesGender = "heren" | "dames" | "gemengd";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  status: AccountStatus;
}

// A member of the club list. Registrations point to members, not accounts.
export interface ClubMember {
  id: string;
  last_name: string;
  first_name: string;
  full_name: string;
  gender: Gender | null;
  tennis_singles_ranking: string | null;
  tennis_doubles_ranking: string | null;
  padel_ranking: string | null;
  profile_id: string | null;
}

export const MEMBER_COLUMNS =
  "id, last_name, first_name, full_name, gender, tennis_singles_ranking, tennis_doubles_ranking, padel_ranking, profile_id";

export interface EntryPlayer {
  entry_id: string;
  member_id: string;
  ranking: string | null;
  registered_by: string | null;
  created_at: string;
  member: { full_name: string; gender: Gender | null } | null;
}

export interface Category {
  id: string;
  sport: Sport;
  format: PlayFormat;
  label: string | null;
  // Who may play, and the highest ranking allowed; null means anyone.
  gender: SeriesGender | null;
  max_ranking: string | null;
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
    id, sport, format, label, gender, max_ranking, max_players, position,
    entry_players (
      entry_id, member_id, ranking, registered_by, created_at,
      member:club_members ( full_name, gender )
    )
  )
`;
