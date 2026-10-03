import type { Category, EntryPlayer } from "./types";

export interface Entry {
  id: string;
  players: EntryPlayer[];
  // single: singles player · team: two confirmed players ·
  // awaiting: partner has not confirmed yet · looking: needs a partner
  kind: "single" | "team" | "awaiting" | "looking";
}

export function groupEntries(category: Category): Entry[] {
  const byEntry = new Map<string, EntryPlayer[]>();
  for (const player of category.entry_players) {
    const list = byEntry.get(player.entry_id) ?? [];
    list.push(player);
    byEntry.set(player.entry_id, list);
  }

  const entries: Entry[] = [...byEntry.entries()].map(([id, players]) => {
    players.sort((a, b) => Number(b.confirmed) - Number(a.confirmed));
    let kind: Entry["kind"];
    if (category.format === "singles") kind = "single";
    else if (players.length === 1) kind = "looking";
    else if (players.every((p) => p.confirmed)) kind = "team";
    else kind = "awaiting";
    return { id, players, kind };
  });

  const firstSignup = (e: Entry) => Math.min(...e.players.map((p) => Date.parse(p.created_at)));
  return entries.sort((a, b) => firstSignup(a) - firstSignup(b));
}

export function confirmedPlayers(category: Category): EntryPlayer[] {
  return category.entry_players.filter((p) => p.confirmed);
}

// Places taken, counting open invitations, as the database does.
export function placesLeft(category: Category): number | null {
  if (category.max_players == null) return null;
  return Math.max(0, category.max_players - category.entry_players.length);
}
