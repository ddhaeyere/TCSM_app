import type { Category, EntryPlayer } from "./types";

export interface Entry {
  id: string;
  players: EntryPlayer[];
  // single: singles player · team: two players · looking: needs a partner
  kind: "single" | "team" | "looking";
}

export function groupEntries(category: Category): Entry[] {
  const byEntry = new Map<string, EntryPlayer[]>();
  for (const player of category.entry_players) {
    const list = byEntry.get(player.entry_id) ?? [];
    list.push(player);
    byEntry.set(player.entry_id, list);
  }

  const entries: Entry[] = [...byEntry.entries()].map(([id, players]) => {
    players.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    let kind: Entry["kind"];
    if (category.format === "singles") kind = "single";
    else if (players.length === 1) kind = "looking";
    else kind = "team";
    return { id, players, kind };
  });

  const firstSignup = (e: Entry) => Math.min(...e.players.map((p) => Date.parse(p.created_at)));
  return entries.sort((a, b) => firstSignup(a) - firstSignup(b));
}

export function placesLeft(category: Category): number | null {
  if (category.max_players == null) return null;
  return Math.max(0, category.max_players - category.entry_players.length);
}
