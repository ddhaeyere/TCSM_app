import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addPartner,
  registerForCategory,
  withdrawRegistration,
} from "@/app/actions/registrations";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, inputClass } from "@/components/ui";
import {
  getCurrentMember,
  isOrganiser,
  requireApprovedProfile,
} from "@/lib/auth";
import { groupEntries, placesLeft, type Entry } from "@/lib/entries";
import {
  categoryLabel,
  plural,
  formatDateTime,
  isRegistrationOpen,
  registrationClosesAt,
  sportLabel,
} from "@/lib/format";
import { memberRanking } from "@/lib/rankings";
import { compareSeries, rankingLabel, seriesName } from "@/lib/series";
import { createClient } from "@/lib/supabase/server";
import {
  EVENT_SELECT,
  MEMBER_COLUMNS,
  type Category,
  type ClubEvent,
  type ClubMember,
  type EntryPlayer,
  type Profile,
  type Sport,
} from "@/lib/types";

export const metadata: Metadata = { title: "Evenement" };

const SPORTS: Sport[] = ["tennis", "padel"];

export default async function EventPage({
  params,
}: PageProps<"/evenementen/[id]">) {
  const { id } = await params;
  const profile = await requireApprovedProfile();
  const me = await getCurrentMember();
  const supabase = await createClient();

  const [{ data }, { data: memberRows }] = await Promise.all([
    supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle(),
    supabase
      .from("club_members")
      .select(MEMBER_COLUMNS)
      .order("last_name")
      .order("first_name"),
  ]);
  if (!data) notFound();

  const event = data as unknown as ClubEvent;
  const members = (memberRows ?? []) as ClubMember[];
  const open = isRegistrationOpen(event);
  // Admins keep registering members after the deadline.
  const canRegister = open || isOrganiser(profile);
  const categories = [...event.event_categories].sort(
    (a, b) => a.position - b.position,
  );

  return (
    <>
      <Link href="/" className="text-sm text-club-700 underline">
        ← Alle evenementen
      </Link>

      <div className="mt-2 mb-4">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="mt-1 text-stone-700">
          {formatDateTime(event.starts_at)}
          {event.location && ` · ${event.location}`}
        </p>
        <p className="mt-1 text-sm text-stone-600">
          {open
            ? `Inschrijven kan tot ${formatDateTime(registrationClosesAt(event).toISOString())}.`
            : isOrganiser(profile)
              ? "De inschrijvingen zijn gesloten. Als beheerder kan je nog leden inschrijven."
              : "De inschrijvingen zijn gesloten."}
        </p>
        {event.description && (
          <p className="mt-3 whitespace-pre-line text-stone-800">
            {event.description}
          </p>
        )}
        {isOrganiser(profile) && (
          <Link
            href={`/beheer/evenementen/${event.id}`}
            className="mt-3 inline-block text-sm text-club-700 underline"
          >
            Evenement beheren
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {SPORTS.map((sport) => {
          const ofSport = categories.filter((c) => c.sport === sport);
          return (
            ofSport.length > 0 && (
              <EntriesTable
                key={sport}
                sport={sport}
                event={event}
                categories={ofSport}
                profile={profile}
                me={me}
                members={members}
                open={canRegister}
              />
            )
          );
        })}

        {canRegister && <h2 className="pt-2 text-xl font-bold">Inschrijven</h2>}
        {categories.map((category) => (
          <RegisterCard
            key={category.id}
            event={event}
            category={category}
            me={me}
            members={members}
            open={canRegister}
          />
        ))}
      </div>
    </>
  );
}

// Members who are not in this category yet.
function availableMembers(
  category: Category,
  members: ClubMember[],
): ClubMember[] {
  const taken = new Set(category.entry_players.map((p) => p.member_id));
  return members.filter((m) => !taken.has(m.id));
}

function memberOption(category: Category) {
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

function RegisterCard({
  event,
  category,
  me,
  members,
  open,
}: {
  event: ClubEvent;
  category: Category;
  me: ClubMember | null;
  members: ClubMember[];
  open: boolean;
}) {
  const entries = groupEntries(category);
  const left = placesLeft(category);
  const doubles = category.format === "doubles";
  const mine =
    me && entries.find((e) => e.players.some((p) => p.member_id === me.id));
  const teams = entries.filter((e) => e.kind === "team");
  const available = availableMembers(category, members);
  const option = memberOption(category);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{categoryLabel(category)}</h2>
        <span className="text-sm text-stone-600">
          {plural(category.entry_players.length, "speler", "spelers")}
          {doubles && ` · ${plural(teams.length, "team", "teams")}`}
          {left !== null &&
            ` · ${left === 0 ? "volzet" : `nog ${left} plaatsen`}`}
        </span>
      </div>

      {mine && (
        <p className="mt-3 rounded-lg bg-club-50 p-3 text-sm text-club-900">
          <strong>Je bent ingeschreven</strong>
          {mine.kind === "team" &&
            ` samen met ${mine.players.find((p) => p.member_id !== me?.id)?.member?.full_name}`}
          {mine.kind === "looking" && " en je zoekt nog een partner"}.
        </p>
      )}

      {/* Registration form: yourself or any other member */}
      {open && left !== 0 && available.length > 0 && (
        <ActionForm
          action={registerForCategory}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="category_id" value={category.id} />
          <Field label="Speler">
            <select
              name="member_id"
              defaultValue={me && !mine ? me.id : ""}
              required
              className={inputClass}
            >
              <option value="" disabled>
                Kies een speler
              </option>
              {available.map(option)}
            </select>
          </Field>
          {doubles ? (
            <Field label="Partner">
              <select name="partner_id" defaultValue="" className={inputClass}>
                <option value="">Zoekt nog een partner</option>
                {available.map(option)}
              </select>
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
          <SubmitButton>Inschrijven</SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}

interface Row {
  category: Category;
  entry: Entry;
  series: string | null;
}

// One table per sport: a line per team (or singles player) with the series
// it plays in and each player's ranking.
function EntriesTable({
  sport,
  event,
  categories,
  profile,
  me,
  members,
  open,
}: {
  sport: Sport;
  event: ClubEvent;
  categories: Category[];
  profile: Profile;
  me: ClubMember | null;
  members: ClubMember[];
  open: boolean;
}) {
  const rows: Row[] = categories.flatMap((category) =>
    groupEntries(category).map((entry) => ({
      category,
      entry,
      series: seriesName(
        category.sport,
        category.format,
        entry.players.map((p) => ({
          gender: p.member?.gender ?? null,
          ranking: p.ranking,
        })),
      ),
    })),
  );
  // Per category, by series; groupEntries keeps sign-up order and sort is
  // stable, so that order stays within a series.
  rows.sort(
    (a, b) =>
      a.category.position - b.category.position ||
      compareSeries(a.series, b.series),
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
      </div>
    </div>
  );

  const partnerCell = (row: Row) => {
    if (row.entry.kind === "team") return playerCell(row.entry.players[1], row);
    if (row.entry.kind !== "looking") return null;
    const available = availableMembers(row.category, members);
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
