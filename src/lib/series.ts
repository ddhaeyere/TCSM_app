import type { Gender, PlayFormat, Sport } from "./types";

export interface SeriesPlayer {
  gender: Gender | null;
  ranking: string | null;
}

// Letter for who plays: heren, dames or gemengd.
function genderLetter(players: SeriesPlayer[]): string {
  const genders = new Set(players.map((p) => p.gender));
  if (genders.has(null)) return "";
  if (genders.size > 1) return "g";
  return genders.has("M") ? "h" : "d";
}

function points(ranking: string | null): number {
  const n = Number(ranking);
  return Number.isFinite(n) ? n : 0;
}

// Padel levels count by their number: P300 is 300.
function padelLevel(ranking: string | null): number {
  return ranking ? points(ranking.replace(/^P/i, "")) : 0;
}

// The series a registration plays in, as the club writes them: "dd30"
// (dubbel dames, up to 30 points together), "dg" gemengd, "dh" heren; "eh5"
// (enkel heren, 5 points); "pg300" (padel gemengd, level of the stronger
// player). Null while a partner is missing.
export function seriesName(
  sport: Sport,
  format: PlayFormat,
  players: SeriesPlayer[],
): string | null {
  if (players.length === 0) return null;
  if (format === "doubles" && players.length < 2) return null;
  const who = genderLetter(players);

  if (sport === "padel") {
    const level = Math.max(...players.map((p) => padelLevel(p.ranking)));
    return `p${who}${level || "?"}`;
  }

  if (format === "singles") {
    return `e${who}${points(players[0].ranking)}`;
  }

  // Doubles: the two rankings together, rounded up to the next ten.
  const total = players.reduce((sum, p) => sum + points(p.ranking), 0);
  return `d${who}${Math.max(10, Math.ceil(total / 10) * 10)}`;
}

// Sorts series names: by kind first, then by level.
export function compareSeries(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const kind = (s: string) => s.replace(/[\d?]+$/, "");
  const level = (s: string) => Number(s.match(/\d+$/)?.[0] ?? 0);
  return kind(a).localeCompare(kind(b)) || level(a) - level(b);
}

// How a ranking reads next to a name: "15p" for tennis, "P300" for padel.
export function rankingLabel(sport: Sport, ranking: string | null): string {
  if (!ranking) return "";
  return sport === "tennis" ? `${ranking}p` : ranking;
}
