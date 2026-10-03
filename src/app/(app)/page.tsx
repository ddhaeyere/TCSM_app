import Link from "next/link";
import { respondToInvitation } from "@/app/actions/registrations";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, PageTitle, RankingSelect } from "@/components/ui";
import { requireApprovedProfile } from "@/lib/auth";
import { confirmedPlayers } from "@/lib/entries";
import {
  categoryLabel,
  formatDateTime,
  formatDay,
  hoursAgo,
  isRegistrationOpen,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { EVENT_SELECT, type ClubEvent, type Profile, type Sport } from "@/lib/types";

interface Invitation {
  entry_id: string;
  inviter: { full_name: string } | null;
  category: {
    sport: Sport;
    format: "singles" | "doubles";
    label: string | null;
    event: { id: string; title: string; starts_at: string };
  };
}

export default async function EventsPage() {
  const profile = await requireApprovedProfile();
  const supabase = await createClient();

  // Keep today's events visible for a while after they started.
  const since = hoursAgo(12);

  const [{ data: events }, { data: invitations }] = await Promise.all([
    supabase
      .from("events")
      .select(EVENT_SELECT)
      .gte("starts_at", since.toISOString())
      .order("starts_at"),
    supabase
      .from("entry_players")
      .select(
        `entry_id,
         inviter:profiles!entry_players_invited_by_fkey ( full_name ),
         category:event_categories ( sport, format, label, event:events ( id, title, starts_at ) )`,
      )
      .eq("profile_id", profile.id)
      .eq("confirmed", false),
  ]);

  const list = (events ?? []) as unknown as ClubEvent[];

  return (
    <>
      {((invitations ?? []) as unknown as Invitation[]).map((inv) => (
        <InvitationCard key={inv.entry_id} invitation={inv} profile={profile} />
      ))}

      <PageTitle sub="Zie wie er al meedoet en schrijf je in.">Clubevenementen</PageTitle>

      {list.length === 0 && (
        <Card>
          <p className="text-stone-600">Er staan nog geen evenementen gepland.</p>
        </Card>
      )}

      <div className="space-y-3">
        {list.map((event) => (
          <EventCard key={event.id} event={event} profileId={profile.id} />
        ))}
      </div>
    </>
  );
}

function EventCard({ event, profileId }: { event: ClubEvent; profileId: string }) {
  const { day, month } = formatDay(event.starts_at);
  const players = event.event_categories.flatMap(confirmedPlayers);
  const uniqueNames = [...new Map(players.map((p) => [p.profile_id, p.player?.full_name ?? ""])).values()];
  const joined = event.event_categories.some((c) =>
    c.entry_players.some((p) => p.profile_id === profileId && p.confirmed),
  );
  const open = isRegistrationOpen(event);
  const categories = [...event.event_categories].sort((a, b) => a.position - b.position);

  return (
    <Link href={`/evenementen/${event.id}`} className="block">
      <Card className="flex gap-4 transition hover:border-club-600">
        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-club-50 py-2 text-club-800">
          <span className="text-2xl leading-none font-bold">{day}</span>
          <span className="text-xs uppercase">{month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-stone-900">{event.title}</h2>
            {joined && <Badge tone="green">Je doet mee</Badge>}
            {!open && <Badge>Inschrijvingen gesloten</Badge>}
          </div>
          <p className="text-sm text-stone-600">{formatDateTime(event.starts_at)}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {categories.map((c) => (
              <Badge key={c.id} tone={c.sport === "padel" ? "club" : "neutral"}>
                {categoryLabel(c)}: {confirmedPlayers(c).length}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-sm text-stone-700">
            {uniqueNames.length === 0 ? (
              "Nog niemand ingeschreven. Wees de eerste!"
            ) : (
              <>
                <strong>{uniqueNames.length}</strong>{" "}
                {uniqueNames.length === 1 ? "speler doet" : "spelers doen"} mee:{" "}
                {uniqueNames.slice(0, 4).join(", ")}
                {uniqueNames.length > 4 && ` en ${uniqueNames.length - 4} anderen`}
              </>
            )}
          </p>
        </div>
      </Card>
    </Link>
  );
}

function InvitationCard({ invitation, profile }: { invitation: Invitation; profile: Profile }) {
  const { category } = invitation;
  const sport = category.sport;
  return (
    <Card className="mb-4 border-amber-300 bg-amber-50">
      <p className="text-sm text-stone-800">
        <strong>{invitation.inviter?.full_name ?? "Een clublid"}</strong> wil met jou spelen in{" "}
        <strong>{categoryLabel(category)}</strong> op{" "}
        <Link href={`/evenementen/${category.event.id}`} className="underline">
          {category.event.title}
        </Link>{" "}
        ({formatDateTime(category.event.starts_at)}).
      </p>
      <ActionForm action={respondToInvitation} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="entry_id" value={invitation.entry_id} />
        <input type="hidden" name="event_id" value={category.event.id} />
        <input type="hidden" name="sport" value={sport} />
        <div className="min-w-40 flex-1">
          <RankingSelect
            sport={sport}
            defaultValue={sport === "tennis" ? profile.tennis_ranking : profile.padel_ranking}
          />
        </div>
        <SubmitButton name="answer" value="accept">
          Ik speel mee
        </SubmitButton>
        <SubmitButton name="answer" value="decline" variant="secondary" formNoValidate>
          Nee, bedankt
        </SubmitButton>
      </ActionForm>
    </Card>
  );
}
