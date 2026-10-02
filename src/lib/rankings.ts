import type { Sport } from "./types";

// Official rankings of Tennis en Padel Vlaanderen, lowest first.
// Adjust these lists when the federation changes its rankings.
export const RANKINGS: Record<Sport, string[]> = {
  tennis: [
    "C+30",
    "C+15/5",
    "C+15/4",
    "C+15/3",
    "C+15/2",
    "C+15/1",
    "C+15",
    "B+4/6",
    "B+2/6",
    "B0",
    "B-2/6",
    "B-4/6",
    "B-15",
    "B-15/1",
    "B-15/2",
    "B-15/4",
    "A nationaal",
    "A internationaal",
  ],
  padel: ["P50", "P100", "P200", "P300", "P400", "P500", "P700", "P1000"],
};

export const NO_RANKING = "Geen klassement";

export function rankingOptions(sport: Sport): string[] {
  return [NO_RANKING, ...RANKINGS[sport]];
}

export function isValidRanking(sport: Sport, ranking: string): boolean {
  return rankingOptions(sport).includes(ranking);
}
