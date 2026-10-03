import { addPartner, withdrawRegistration } from "@/app/actions/registrations";
import { splitEntry } from "@/app/actions/events";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, inputClass } from "@/components/ui";
import { isOrganiser } from "@/lib/auth";
import { groupEntries, type Entry } from "@/lib/entries";
import { plural, sportLabel } from "@/lib/format";
import { memberRanking } from "@/lib/rankings";
import { rankingLabel, seriesCode, seriesProblem, type SeriesPlayer } from "@/lib/series";
import type {
  Category,
  ClubEvent,
  ClubMember,
  EntryPlayer,
  Profile,
  Sport,
} from "@/lib/types";

export const SPORTS: Sport[] = ["tennis", "padel"];

function asPlayer(m: ClubMember, category: Category): SeriesPlayer {
  return {
    full_name: m.full_name,
    gender: m.gender,
    ranking: memberRanking(m, category.sport, category.format),
  };
}

// Members who are not in this category yet and fit its series, alone or
// together with the given teammate.
export function availableMembers(
  category: Category,
  members: ClubMember[],
  teammate?: ClubMember,
): ClubMember[] {
  const taken = new Set(category.entry_players.map((p) => p.member_id));
  const team = teammate ? [asPlayer(teammate, category)] : [];
  return members.filter(
    (m) => !taken.has(m.id) && seriesProblem(category, [...team, asPlayer(m, category)]) === null,
  );
}

export function memberOption(category: Category) {
  return function MemberOption(m: ClubMember) {
    const ranking = memberRanking(m, category.sport, category.format);
    return (
      <option key={m.id} value={m.id}>
        {ranking
          ? `${m.full_name} (${rankingLabel(category.sport, ranking)})`
          : m.full_name}
      </option>
    );
  };
}

interface Row {
  category: Category;
  entry: Entry;
  series: string | null;
}

// One table per sport: a line per team (or singles player) with the series
// it plays in and each player's ranking.
export function EntriesTable({
  sport,
  event,
  categories,
  profile,
  me,
  members,
  open,
  manage = false,
}: {
  sport: Sport;
  event: ClubEvent;
  categories: Category[];
  profile: Profile;
  me: ClubMember | null;
  members: ClubMember[];
  open: boolean;
  // Event management: organisers can also split teams.
  manage?: boolean;
}) {
  // Per series, in the order the organiser added them; groupEntries keeps
  // sign-up order within a series.
  const rows: Row[] = [...categories]
    .sort((a, b) => a.position - b.position)
    .flatMap((category) =>
      groupEntries(category).map((entry) => ({
        category,
        entry,
        series: seriesCode(category) ?? category.label,
      })),
    );
  const hasDoubles = categories.some((c) => c.format === "doubles");

  // Who may unregister a player: the player, whoever registered them, and organisers.
  const canWithdraw = (p: EntryPlayer) =>
    open &&
    (isOrganiser(profile) ||
      p.registered_by === profile.id ||
      (me !== null && p.member_id === me.id));

  // Name on the first line; ranking and the withdraw link below it.
  const playerCell = (p: EntryPlayer, row: Row) => (
    <div>
      <div
        className={me && p.member_id === me.id ? "font-semibold" : undefined}
      >
        {p.member?.full_name ?? "Onbekend"}
      </div>
      <div className="text-xs text-stone-500">
        {rankingLabel(sport, p.ranking) || "geen klassement"}
        {canWithdraw(p) && (
          <ActionForm action={withdrawRegistration} className="inline">
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="entry_id" value={row.entry.id} />
            <input type="hidden" name="member_id" value={p.member_id} />
            {" · "}
            <SubmitButton
              variant="link"
              confirm={`${p.member?.full_name ?? "Deze speler"} uitschrijven?`}
            >
              uitschrijven
            </SubmitButton>
          </ActionForm>
        )}
        {manage && row.entry.kind === "team" && p === row.entry.players[1] && (
          <ActionForm action={splitEntry} className="inline">
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="entry_id" value={row.entry.id} />
            <input type="hidden" name="member_id" value={p.member_id} />
            {" · "}
            <SubmitButton variant="link">loskoppelen</SubmitButton>
          </ActionForm>
        )}
      </div>
    </div>
  );

  const partnerCell = (row: Row) => {
    if (row.entry.kind === "team") return playerCell(row.entry.players[1], row);
    if (row.entry.kind !== "looking") return null;
    const first = members.find((m) => m.id === row.entry.players[0].member_id);
    const available = availableMembers(row.category, members, first);
    return (
      <div>
        <span className="text-amber-700 italic">Zoekt een partner</span>
        {open && available.length > 0 && (
          <ActionForm action={addPartner} className="mt-1 space-y-1">
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="entry_id" value={row.entry.id} />
            <select
              name="member_id"
              defaultValue=""
              required
              aria-label="Partner"
              className={`${inputClass} mt-0 min-w-0 py-1 text-sm`}
            >
              <option value="" disabled>
                Kies een partner
              </option>
              {available.map(memberOption(row.category))}
            </select>
            <SubmitButton variant="secondary">Toevoegen</SubmitButton>
          </ActionForm>
        )}
      </div>
    );
  };

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{sportLabel(sport)}</h2>
        <span className="text-sm text-stone-600">
          {plural(
            rows.length,
            hasDoubles ? "inschrijving" : "speler",
            hasDoubles ? "inschrijvingen" : "spelers",
          )}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-stone-600">Nog niemand ingeschreven.</p>
      ) : (
        <div className="mt-3">
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs tracking-wide text-stone-500 uppercase">
                <th className="w-16 py-2 pr-2 font-medium">Reeks</th>
                <th className="py-2 pr-3 font-medium">
                  {hasDoubles ? "Speler 1" : "Speler"}
                </th>
                {hasDoubles && <th className="py-2 font-medium">Speler 2</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.entry.id}
                  className={`border-b border-stone-100 align-top last:border-0 ${
                    row.entry.kind === "looking" ? "bg-amber-50" : ""
                  }`}
                >
                  <td className="py-2 pr-2 font-semibold break-words text-club-700">
                    {row.series ?? "–"}
                  </td>
                  <td className="py-2 pr-3">
                    {playerCell(row.entry.players[0], row)}
                  </td>
                  {hasDoubles && <td className="py-2">{partnerCell(row)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
