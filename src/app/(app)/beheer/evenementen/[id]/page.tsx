import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addCategory,
  deleteCategory,
  deleteEvent,
  pairEntries,
  updateCategory,
  updateEvent,
} from "@/app/actions/events";
import { EntriesTable, SPORTS } from "@/components/entries-table";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";
import { getCurrentMember, requireOrganiser } from "@/lib/auth";
import { groupEntries } from "@/lib/entries";
import { CATEGORY_CHOICES, categoryLabel } from "@/lib/format";
import { SERIES_GENDERS, seriesCode } from "@/lib/series";
import { createClient } from "@/lib/supabase/server";
import {
  EVENT_SELECT,
  MEMBER_COLUMNS,
  type Category,
  type ClubEvent,
  type ClubMember,
} from "@/lib/types";
import { EventFields } from "../event-fields";

export const metadata: Metadata = { title: "Evenement beheren" };

export default async function ManageEventPage({
  params,
}: PageProps<"/beheer/evenementen/[id]">) {
  const { id } = await params;
  const profile = await requireOrganiser();
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
  const categories = [...event.event_categories].sort(
    (a, b) => a.position - b.position,
  );

  return (
    <>
      <div className="flex justify-between text-sm">
        <Link href="/beheer" className="text-club-700 underline">
          ← Beheer
        </Link>
        <Link
          href={`/evenementen/${event.id}`}
          className="text-club-700 underline"
        >
          Bekijk als lid
        </Link>
      </div>
      <PageTitle>{event.title}</PageTitle>

      <h2 className="mb-2 text-lg font-semibold">Inschrijvingen</h2>
      <div className="mb-6 space-y-4">
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
                open
                manage
              />
            )
          );
        })}
        {categories.length === 0 && (
          <p className="text-sm text-stone-600">Voeg hieronder eerst de reeksen toe.</p>
        )}
        {categories.map((category) => (
          <PairCard key={category.id} event={event} category={category} />
        ))}
      </div>

      <h2 className="mb-2 text-lg font-semibold">Reeksen</h2>
      <Card className="mb-6">
        <ul className="divide-y divide-stone-100">
          {categories.map((c) => (
            <li key={c.id} className="py-3 first:pt-0">
              <p className="font-medium">
                {seriesCode(c) && <span className="mr-2 text-club-700">{seriesCode(c)}</span>}
                {categoryLabel(c)}
              </p>
              <ActionForm action={updateCategory} className="mt-2 grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
                <input type="hidden" name="event_id" value={event.id} />
                <input type="hidden" name="category_id" value={c.id} />
                <SeriesFields category={c} />
                <SubmitButton variant="secondary">Opslaan</SubmitButton>
              </ActionForm>
              {c.entry_players.length === 0 ? (
                <ActionForm action={deleteCategory} className="mt-2">
                  <input type="hidden" name="event_id" value={event.id} />
                  <input type="hidden" name="category_id" value={c.id} />
                  <SubmitButton variant="link" confirm="Deze reeks verwijderen?">
                    Reeks verwijderen
                  </SubmitButton>
                </ActionForm>
              ) : (
                <p className="mt-2 text-xs text-stone-500">
                  Heeft inschrijvingen, kan niet verwijderd worden. Een nieuwe regel geldt alleen
                  voor nieuwe inschrijvingen.
                </p>
              )}
            </li>
          ))}
        </ul>
        <ActionForm
          action={addCategory}
          className={`grid grid-cols-2 items-end gap-2 sm:grid-cols-4 ${
            categories.length > 0 ? "mt-3 border-t border-stone-100 pt-3" : ""
          }`}
        >
          <input type="hidden" name="event_id" value={event.id} />
          <Field label="Sport">
            <select name="category" className={inputClass}>
              {CATEGORY_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <SeriesFields />
          <SubmitButton>Reeks toevoegen</SubmitButton>
        </ActionForm>
      </Card>

      <h2 className="mb-2 text-lg font-semibold">Gegevens</h2>
      <Card className="mb-6">
        <ActionForm action={updateEvent} className="space-y-4">
          <input type="hidden" name="event_id" value={event.id} />
          <EventFields event={event} />
          <SubmitButton>Opslaan</SubmitButton>
        </ActionForm>
      </Card>

      <ActionForm action={deleteEvent}>
        <input type="hidden" name="event_id" value={event.id} />
        <SubmitButton
          variant="danger"
          confirm="Dit evenement en alle inschrijvingen verwijderen? Dit kan niet ongedaan gemaakt worden."
        >
          Evenement verwijderen
        </SubmitButton>
      </ActionForm>
    </>
  );
}

// Who may play, the maximum ranking, an optional name and a player limit.
function SeriesFields({ category }: { category?: Category }) {
  return (
    <>
      <Field label="Voor">
        <select name="gender" defaultValue={category?.gender ?? ""} className={inputClass}>
          <option value="">Iedereen</option>
          {SERIES_GENDERS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Max. klassement">
        <input
          name="max_ranking"
          defaultValue={category?.max_ranking ?? ""}
          placeholder="Bv. 30 of P300"
          className={inputClass}
        />
      </Field>
      <Field label="Naam">
        <input
          name="label"
          defaultValue={category?.label ?? ""}
          placeholder="Optioneel"
          className={inputClass}
        />
      </Field>
      <Field label="Max. spelers">
        <input
          name="max_players"
          type="number"
          min={1}
          defaultValue={category?.max_players ?? ""}
          className={inputClass}
        />
      </Field>
    </>
  );
}

// Lets the organiser pair two members who are both looking for a partner.
function PairCard({
  event,
  category,
}: {
  event: ClubEvent;
  category: Category;
}) {
  const looking = groupEntries(category).filter((e) => e.kind === "looking");
  if (looking.length < 2) return null;

  return (
    <Card>
      <h3 className="font-semibold">
        {categoryLabel(category)}: zoeken een partner
      </h3>
      <ActionForm
        action={pairEntries}
        className="mt-2 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="event_id" value={event.id} />
        {(["first", "second"] as const).map((name, i) => (
          <Field key={name} label={i === 0 ? "Koppel" : "met"}>
            <select
              name={name}
              defaultValue=""
              required
              className={`${inputClass} w-44`}
            >
              <option value="" disabled>
                Kies een speler
              </option>
              {looking.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.players.at(0)?.member?.full_name}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <SubmitButton>Maak team</SubmitButton>
      </ActionForm>
    </Card>
  );
}
