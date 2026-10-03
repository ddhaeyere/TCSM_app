import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addCategory,
  deleteCategory,
  deleteEvent,
  pairEntries,
  removePlayer,
  splitEntry,
  updateCategory,
  updateEvent,
} from "@/app/actions/events";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Field, PageTitle, inputClass } from "@/components/ui";
import { requireOrganiser } from "@/lib/auth";
import { confirmedPlayers, groupEntries } from "@/lib/entries";
import { CATEGORY_CHOICES, categoryLabel, plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { EVENT_SELECT, type Category, type ClubEvent } from "@/lib/types";
import { EventFields } from "../event-fields";

export const metadata: Metadata = { title: "Evenement beheren" };

export default async function ManageEventPage({ params }: PageProps<"/beheer/evenementen/[id]">) {
  const { id } = await params;
  await requireOrganiser();
  const supabase = await createClient();

  const { data } = await supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const event = data as unknown as ClubEvent;
  const categories = [...event.event_categories].sort((a, b) => a.position - b.position);

  return (
    <>
      <div className="flex justify-between text-sm">
        <Link href="/beheer" className="text-court-700 underline">
          ← Beheer
        </Link>
        <Link href={`/evenementen/${event.id}`} className="text-court-700 underline">
          Bekijk als lid
        </Link>
      </div>
      <PageTitle>{event.title}</PageTitle>

      <h2 className="mb-2 text-lg font-semibold">Inschrijvingen</h2>
      <div className="mb-6 space-y-4">
        {categories.map((category) => (
          <RegistrationsCard key={category.id} event={event} category={category} />
        ))}
      </div>

      <h2 className="mb-2 text-lg font-semibold">Categorieën</h2>
      <Card className="mb-6">
        <ul className="divide-y divide-stone-100">
          {categories.map((c) => (
            <li key={c.id} className="py-3">
              <p className="font-medium">{categoryLabel({ ...c, label: null })}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <ActionForm action={updateCategory} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="event_id" value={event.id} />
                  <input type="hidden" name="category_id" value={c.id} />
                  <Field label="Extra naam">
                    <input
                      name="label"
                      defaultValue={c.label ?? ""}
                      placeholder="Bv. Gemengd"
                      className={`${inputClass} w-36`}
                    />
                  </Field>
                  <Field label="Max. spelers">
                    <input
                      name="max_players"
                      type="number"
                      min={1}
                      defaultValue={c.max_players ?? ""}
                      className={`${inputClass} w-24`}
                    />
                  </Field>
                  <SubmitButton variant="secondary">Opslaan</SubmitButton>
                </ActionForm>
                {c.entry_players.length === 0 ? (
                  <ActionForm action={deleteCategory}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="category_id" value={c.id} />
                    <SubmitButton variant="danger" confirm="Deze categorie verwijderen?">
                      Verwijderen
                    </SubmitButton>
                  </ActionForm>
                ) : (
                  <span className="pb-2 text-xs text-stone-500">
                    Heeft inschrijvingen, kan niet verwijderd worden
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
        <ActionForm action={addCategory} className="mt-3 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
          <input type="hidden" name="event_id" value={event.id} />
          <Field label="Categorie">
            <select name="category" className={`${inputClass} w-36`}>
              {CATEGORY_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Extra naam">
            <input name="label" placeholder="Optioneel" className={`${inputClass} w-36`} />
          </Field>
          <Field label="Max. spelers">
            <input name="max_players" type="number" min={1} className={`${inputClass} w-24`} />
          </Field>
          <SubmitButton>Categorie toevoegen</SubmitButton>
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

function RegistrationsCard({ event, category }: { event: ClubEvent; category: Category }) {
  const entries = groupEntries(category);
  const looking = entries.filter((e) => e.kind === "looking");

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{categoryLabel(category)}</h3>
        <span className="text-sm text-stone-600">
          {plural(confirmedPlayers(category).length, "speler", "spelers")}
          {category.max_players != null && ` van max. ${category.max_players}`}
        </span>
      </div>

      {entries.length === 0 && <p className="mt-2 text-sm text-stone-600">Nog geen inschrijvingen.</p>}

      <ul className="mt-2 divide-y divide-stone-100 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
            {entry.players.map((p) => (
              <span key={p.profile_id} className="flex items-center gap-2">
                <span>
                  {p.player?.full_name}
                  {p.ranking && <span className="text-stone-500"> ({p.ranking})</span>}
                </span>
                {!p.confirmed && <Badge tone="amber">uitgenodigd</Badge>}
                {entry.kind === "team" && (
                  <ActionForm action={splitEntry}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="entry_id" value={entry.id} />
                    <input type="hidden" name="profile_id" value={p.profile_id} />
                    <SubmitButton variant="secondary" className="min-h-7 px-2 text-xs">
                      Loskoppelen
                    </SubmitButton>
                  </ActionForm>
                )}
                <ActionForm action={removePlayer}>
                  <input type="hidden" name="event_id" value={event.id} />
                  <input type="hidden" name="entry_id" value={entry.id} />
                  <input type="hidden" name="profile_id" value={p.profile_id} />
                  <SubmitButton
                    variant="danger"
                    className="min-h-7 px-2 text-xs"
                    confirm={`${p.player?.full_name} uitschrijven?`}
                  >
                    Verwijderen
                  </SubmitButton>
                </ActionForm>
              </span>
            ))}
            {entry.kind === "looking" && <Badge tone="amber">zoekt partner</Badge>}
          </li>
        ))}
      </ul>

      {looking.length >= 2 && (
        <ActionForm action={pairEntries} className="mt-3 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
          <input type="hidden" name="event_id" value={event.id} />
          {(["first", "second"] as const).map((name, i) => (
            <Field key={name} label={i === 0 ? "Koppel" : "met"}>
              <select name={name} defaultValue="" required className={`${inputClass} w-44`}>
                <option value="" disabled>
                  Kies een speler
                </option>
                {looking.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.players.at(0)?.player?.full_name}
                    {e.players.at(0)?.ranking && ` (${e.players.at(0)?.ranking})`}
                  </option>
                ))}
              </select>
            </Field>
          ))}
          <SubmitButton>Maak team</SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}
