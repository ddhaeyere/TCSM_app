import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  registerForCategory,
  respondToInvitation,
  withdrawRegistration,
} from "@/app/actions/registrations";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Field, RankingSelect, inputClass } from "@/components/ui";
import { isOrganiser, requireApprovedProfile } from "@/lib/auth";
import { confirmedPlayers, groupEntries, placesLeft, type Entry } from "@/lib/entries";
import {
  categoryLabel,
  plural,
  formatDateTime,
  isRegistrationOpen,
  registrationClosesAt,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { EVENT_SELECT, type Category, type ClubEvent, type Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Evenement" };

export default async function EventPage({ params }: PageProps<"/evenementen/[id]">) {
  const { id } = await params;
  const profile = await requireApprovedProfile();
  const supabase = await createClient();

  const [{ data }, { data: members }] = await Promise.all([
    supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name").eq("status", "approved").order("full_name"),
  ]);
  if (!data) notFound();

  const event = data as unknown as ClubEvent;
  const open = isRegistrationOpen(event);
  const categories = [...event.event_categories].sort((a, b) => a.position - b.position);

  return (
    <>
      <Link href="/" className="text-sm text-court-700 underline">
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
            className="mt-3 inline-block text-sm text-court-700 underline"
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
            members={(members ?? []) as { id: string; full_name: string }[]}
            open={open}
          />
        ))}
      </div>
    </>
  );
}

function playerName(entry: Entry, index: number): string {
  return entry.players.at(index)?.player?.full_name ?? "Onbekend";
}

function withRanking(entry: Entry, index: number): string {
  const p = entry.players.at(index);
  if (!p) return "";
  return p.ranking ? `${playerName(entry, index)} (${p.ranking})` : playerName(entry, index);
}

function CategoryCard({
  event,
  category,
  profile,
  members,
  open,
}: {
  event: ClubEvent;
  category: Category;
  profile: Profile;
  members: { id: string; full_name: string }[];
  open: boolean;
}) {
  const entries = groupEntries(category);
  const mine = entries.find((e) => e.players.some((p) => p.profile_id === profile.id));
  const myPlayer = mine?.players.find((p) => p.profile_id === profile.id);
  const left = placesLeft(category);
  const count = confirmedPlayers(category).length;
  const doubles = category.format === "doubles";
  const lastRanking = category.sport === "tennis" ? profile.tennis_ranking : profile.padel_ranking;

  const teams = entries.filter((e) => e.kind === "team" || e.kind === "awaiting");
  const looking = entries.filter((e) => e.kind === "looking");
  const singles = entries.filter((e) => e.kind === "single");

  const taken = new Set(category.entry_players.map((p) => p.profile_id));
  const partnerOptions = members.filter((m) => !taken.has(m.id));

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{categoryLabel(category)}</h2>
        <span className="text-sm text-stone-600">
          {plural(count, "speler", "spelers")}
          {doubles && ` · ${plural(entries.filter((e) => e.kind === "team").length, "team", "teams")}`}
          {left !== null && ` · ${left === 0 ? "volzet" : `nog ${left} plaatsen`}`}
        </span>
      </div>

      {/* The member's own registration */}
      {mine && myPlayer && (
        <div className="mt-3 rounded-lg bg-court-50 p-3 text-sm text-court-900">
          {!myPlayer.confirmed ? (
            <>
              <p>
                <strong>{playerName(mine, 0)}</strong> wil met jou spelen.
              </p>
              {open && (
                <ActionForm action={respondToInvitation} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="entry_id" value={mine.id} />
                  <input type="hidden" name="event_id" value={event.id} />
                  <input type="hidden" name="sport" value={category.sport} />
                  <div className="min-w-40 flex-1">
                    <RankingSelect sport={category.sport} defaultValue={lastRanking} />
                  </div>
                  <SubmitButton name="answer" value="accept">
                    Ik speel mee
                  </SubmitButton>
                  <SubmitButton name="answer" value="decline" variant="secondary" formNoValidate>
                    Nee, bedankt
                  </SubmitButton>
                </ActionForm>
              )}
            </>
          ) : (
            <>
              <p>
                <strong>Je bent ingeschreven</strong>
                {myPlayer.ranking && ` als ${myPlayer.ranking}`}
                {mine.kind === "team" &&
                  ` samen met ${mine.players.find((p) => p.profile_id !== profile.id)?.player?.full_name}`}
                {mine.kind === "awaiting" &&
                  `. ${mine.players.find((p) => !p.confirmed)?.player?.full_name} moet nog bevestigen`}
                {mine.kind === "looking" && ". Je zoekt nog een partner"}.
              </p>
              {open && (
                <ActionForm action={withdrawRegistration} className="mt-2">
                  <input type="hidden" name="entry_id" value={mine.id} />
                  <input type="hidden" name="event_id" value={event.id} />
                  <SubmitButton
                    variant="danger"
                    confirm="Wil je je echt uitschrijven?"
                  >
                    Uitschrijven
                  </SubmitButton>
                </ActionForm>
              )}
            </>
          )}
        </div>
      )}

      {/* Registration form */}
      {!mine && open && left !== 0 && (
        <ActionForm action={registerForCategory} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="category_id" value={category.id} />
          <input type="hidden" name="sport" value={category.sport} />
          <Field label="Je klassement">
            <RankingSelect sport={category.sport} defaultValue={lastRanking} />
          </Field>
          {doubles ? (
            <Field label="Partner">
              <select name="partner_id" defaultValue="" className={inputClass}>
                <option value="">Ik zoek nog een partner</option>
                {partnerOptions
                  .filter((m) => m.id !== profile.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
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
                <li key={e.id}>{withRanking(e, 0)}</li>
              ))}
            </ol>
          )}
          {teams.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-stone-700">Teams</h3>
              <ul className="space-y-1">
                {teams.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {withRanking(e, 0)} & {e.kind === "team" ? withRanking(e, 1) : playerName(e, 1)}
                    </span>
                    {e.kind === "awaiting" && <Badge tone="amber">wacht op bevestiging</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {looking.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-stone-700">Zoekt nog een partner</h3>
              <ul className="flex flex-wrap gap-2">
                {looking.map((e) => (
                  <li key={e.id}>
                    <Badge tone="amber">{withRanking(e, 0)}</Badge>
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
