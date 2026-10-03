import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addPartner, registerForCategory, withdrawRegistration } from "@/app/actions/registrations";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, inputClass } from "@/components/ui";
import { getCurrentMember, isOrganiser, requireApprovedProfile } from "@/lib/auth";
import { groupEntries, placesLeft, type Entry } from "@/lib/entries";
import {
  categoryLabel,
  plural,
  formatDateTime,
  isRegistrationOpen,
  registrationClosesAt,
} from "@/lib/format";
import { memberRanking } from "@/lib/rankings";
import { createClient } from "@/lib/supabase/server";
import {
  EVENT_SELECT,
  MEMBER_COLUMNS,
  type Category,
  type ClubEvent,
  type ClubMember,
  type EntryPlayer,
  type Profile,
} from "@/lib/types";

export const metadata: Metadata = { title: "Evenement" };

export default async function EventPage({ params }: PageProps<"/evenementen/[id]">) {
  const { id } = await params;
  const profile = await requireApprovedProfile();
  const me = await getCurrentMember();
  const supabase = await createClient();

  const [{ data }, { data: members }] = await Promise.all([
    supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle(),
    supabase.from("club_members").select(MEMBER_COLUMNS).order("last_name").order("first_name"),
  ]);
  if (!data) notFound();

  const event = data as unknown as ClubEvent;
  const open = isRegistrationOpen(event);
  const categories = [...event.event_categories].sort((a, b) => a.position - b.position);

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
            : "De inschrijvingen zijn gesloten."}
        </p>
        {event.description && (
          <p className="mt-3 whitespace-pre-line text-stone-800">{event.description}</p>
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
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            event={event}
            category={category}
            profile={profile}
            me={me}
            members={(members ?? []) as ClubMember[]}
            open={open}
          />
        ))}
      </div>
    </>
  );
}

function withRanking(player: EntryPlayer | undefined): string {
  if (!player) return "";
  const name = player.member?.full_name ?? "Onbekend";
  return player.ranking ? `${name} (${player.ranking})` : name;
}

function CategoryCard({
  event,
  category,
  profile,
  me,
  members,
  open,
}: {
  event: ClubEvent;
  category: Category;
  profile: Profile;
  me: ClubMember | null;
  members: ClubMember[];
  open: boolean;
}) {
  const entries = groupEntries(category);
  const left = placesLeft(category);
  const doubles = category.format === "doubles";
  const mine = me && entries.find((e) => e.players.some((p) => p.member_id === me.id));

  const teams = entries.filter((e) => e.kind === "team");
  const looking = entries.filter((e) => e.kind === "looking");
  const singles = entries.filter((e) => e.kind === "single");

  // Members who are not in this category yet, with their ranking for it.
  const taken = new Set(category.entry_players.map((p) => p.member_id));
  const available = members.filter((m) => !taken.has(m.id));
  const option = (m: ClubMember) => {
    const ranking = memberRanking(m, category.sport, category.format);
    return (
      <option key={m.id} value={m.id}>
        {ranking ? `${m.full_name} (${ranking})` : m.full_name}
      </option>
    );
  };

  // Who may unregister a player: the player, whoever registered them, and organisers.
  const canWithdraw = (p: EntryPlayer) =>
    open &&
    (isOrganiser(profile) || p.registered_by === profile.id || (me !== null && p.member_id === me.id));

  const playerLine = (p: EntryPlayer | undefined, entry: Entry) =>
    p && (
      <span className="inline-flex items-center gap-1">
        {withRanking(p)}
        {canWithdraw(p) && (
          <ActionForm action={withdrawRegistration} className="inline">
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="entry_id" value={entry.id} />
            <input type="hidden" name="member_id" value={p.member_id} />
            <SubmitButton
              variant="link"
              confirm={`${p.member?.full_name ?? "Deze speler"} uitschrijven?`}
            >
              uitschrijven
            </SubmitButton>
          </ActionForm>
        )}
      </span>
    );

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{categoryLabel(category)}</h2>
        <span className="text-sm text-stone-600">
          {plural(category.entry_players.length, "speler", "spelers")}
          {doubles && ` · ${plural(teams.length, "team", "teams")}`}
          {left !== null && ` · ${left === 0 ? "volzet" : `nog ${left} plaatsen`}`}
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

      {/* Who is in */}
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-stone-600">Nog niemand ingeschreven.</p>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          {singles.length > 0 && (
            <ol className="list-inside list-decimal space-y-1">
              {singles.map((e) => (
                <li key={e.id}>{playerLine(e.players[0], e)}</li>
              ))}
            </ol>
          )}
          {teams.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-stone-700">Teams</h3>
              <ul className="space-y-1">
                {teams.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-2">
                    {playerLine(e.players[0], e)}
                    <span>&</span>
                    {playerLine(e.players[1], e)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {looking.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-stone-700">Zoekt nog een partner</h3>
              <ul className="space-y-2">
                {looking.map((e) => (
                  <li key={e.id} className="rounded-lg bg-amber-50 p-2">
                    {playerLine(e.players[0], e)}
                    {open && available.length > 0 && (
                      <ActionForm action={addPartner} className="mt-1 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="event_id" value={event.id} />
                        <input type="hidden" name="entry_id" value={e.id} />
                        <select
                          name="member_id"
                          defaultValue=""
                          required
                          aria-label="Partner"
                          className={`${inputClass} mt-0 w-auto min-w-48 flex-1 py-1.5 text-sm`}
                        >
                          <option value="" disabled>
                            Kies een partner
                          </option>
                          {available.map(option)}
                        </select>
                        <SubmitButton variant="secondary">Partner toevoegen</SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
