import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { registerForCategory } from "@/app/actions/registrations";
import {
  EntriesTable,
  SPORTS,
  availableMembers,
  memberOption,
} from "@/components/entries-table";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, inputClass } from "@/components/ui";
import {
  getCurrentMember,
  isOrganiser,
  requireApprovedProfile,
} from "@/lib/auth";
import { groupEntries, placesLeft } from "@/lib/entries";
import {
  categoryLabel,
  plural,
  formatDateTime,
  isRegistrationOpen,
  registrationClosesAt,
} from "@/lib/format";
import { seriesCode } from "@/lib/series";
import { createClient } from "@/lib/supabase/server";
import {
  EVENT_SELECT,
  MEMBER_COLUMNS,
  type Category,
  type ClubEvent,
  type ClubMember,
} from "@/lib/types";

export const metadata: Metadata = { title: "Evenement" };

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
        <h2 className="text-lg font-semibold">
          {seriesCode(category) && (
            <span className="mr-2 text-club-700">{seriesCode(category)}</span>
          )}
          {categoryLabel(category)}
        </h2>
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
