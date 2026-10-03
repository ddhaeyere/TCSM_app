import type { Category, Gender, SeriesGender, Sport } from "./types";

export const SERIES_GENDERS: { value: SeriesGender; label: string }[] = [
  { value: "heren", label: "Heren" },
  { value: "dames", label: "Dames" },
  { value: "gemengd", label: "Gemengd" },
];

const GENDER_LETTERS: Record<SeriesGender, string> = { heren: "h", dames: "d", gemengd: "g" };

type SeriesRules = Pick<Category, "sport" | "format" | "gender" | "max_ranking">;

export interface SeriesPlayer {
  full_name: string;
  gender: Gender | null;
  ranking: string | null;
}

// Points of a ranking: "15" is 15, "P300" is 300, no ranking is 0.
export function rankingPoints(ranking: string | null): number {
  return Number(ranking?.replace(/\D/g, "") || 0);
}

// The series code as the club writes it: "dd30" (dubbel dames, at most 30
// points together), "dg20", "eh5", "pg300". Null when the series has no
// gender and no maximum.
export function seriesCode(series: SeriesRules): string | null {
  if (!series.gender && !series.max_ranking) return null;
  const kind = series.sport === "padel" ? "p" : series.format === "singles" ? "e" : "d";
  const who = series.gender ? GENDER_LETTERS[series.gender] : "";
  const max = series.max_ranking ? rankingPoints(series.max_ranking) : "";
  return `${kind}${who}${max}`;
}

// The reason these players may not play together in the series, or null when
// they may. Mirrors public.assert_fits_series in the database, which has the
// final say; the app uses this to only offer members who fit.
export function seriesProblem(series: SeriesRules, players: SeriesPlayer[]): string | null {
  const max = series.max_ranking ? rankingPoints(series.max_ranking) : null;
  for (const p of players) {
    if (series.gender) {
      if (!p.gender) return `Het geslacht van ${p.full_name} staat niet in de ledenlijst`;
      if (series.gender === "heren" && p.gender !== "M")
        return `${p.full_name} kan niet meespelen in een herenreeks`;
      if (series.gender === "dames" && p.gender !== "V")
        return `${p.full_name} kan niet meespelen in een damesreeks`;
    }
    if (max !== null && rankingPoints(p.ranking) > max)
      return `${p.full_name} heeft een hoger klassement dan deze reeks`;
  }
  if (series.gender === "gemengd" && players.length === 2 && players[0].gender === players[1].gender)
    return "In een gemengde reeks speelt een heer samen met een dame";
  const total = players.reduce((sum, p) => sum + rankingPoints(p.ranking), 0);
  if (series.sport === "tennis" && max !== null && total > max)
    return `Samen ${total} punten, meer dan de ${max} van deze reeks`;
  return null;
}

// How a ranking reads next to a name: "15p" for tennis, "P300" for padel.
export function rankingLabel(sport: Sport, ranking: string | null): string {
  if (!ranking) return "";
  return sport === "tennis" ? `${ranking}p` : ranking;
}
