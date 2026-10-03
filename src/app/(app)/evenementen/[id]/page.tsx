import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntriesTable, SPORTS } from "@/components/entries-table";
import { RegisterCard } from "@/components/register-card";
import {
  getCurrentMember,
  isOrganiser,
  requireApprovedProfile,
} from "@/lib/auth";
import {
  formatDateTime,
  isRegistrationOpen,
  registrationClosesAt,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  EVENT_SELECT,
  MEMBER_COLUMNS,
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
