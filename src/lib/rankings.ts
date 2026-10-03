import type { PlayFormat, Profile, Sport } from "./types";

// Official rankings of Tennis en Padel Vlaanderen, lowest first.
// Adjust these lists when the federation changes its rankings.
export const RANKINGS: Record<Sport, string[]> = {
  // Tennis uses points: 3, 5, then steps of 5 up to 110.
  tennis: ["3", ...Array.from({ length: 22 }, (_, i) => String((i + 1) * 5))],
  padel: ["P50", "P100", "P200", "P300", "P400", "P500", "P700", "P1000"],
};

export const NO_RANKING = "Geen klassement";

export function rankingOptions(sport: Sport): string[] {
  return [NO_RANKING, ...RANKINGS[sport]];
}

export function isValidRanking(sport: Sport, ranking: string): boolean {
  return rankingOptions(sport).includes(ranking);
}

// The ranking a member used last time for this kind of category.
export function profileRanking(profile: Profile, sport: Sport, format: PlayFormat): string | null {
  if (sport === "padel") return profile.padel_ranking;
  return format === "singles" ? profile.tennis_singles_ranking : profile.tennis_doubles_ranking;
}
