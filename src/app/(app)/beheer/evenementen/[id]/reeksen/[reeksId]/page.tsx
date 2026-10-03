import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCategory, updateCategory } from "@/app/actions/events";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageTitle } from "@/components/ui";
import { requireOrganiser } from "@/lib/auth";
import { categoryLabel } from "@/lib/format";
import { seriesCode } from "@/lib/series";
import { createClient } from "@/lib/supabase/server";
import { EVENT_SELECT, type ClubEvent } from "@/lib/types";
import { SeriesFields } from "../../../series-fields";

export const metadata: Metadata = { title: "Reeks aanpassen" };

export default async function EditSeriesPage({
  params,
}: PageProps<"/beheer/evenementen/[id]/reeksen/[reeksId]">) {
  const { id, reeksId } = await params;
  await requireOrganiser();
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle();
  const event = data as unknown as ClubEvent | null;
  const category = event?.event_categories.find((c) => c.id === reeksId);
  if (!event || !category) notFound();

  const players = category.entry_players.length;

  return (
    <>
      <Link href={`/beheer/evenementen/${event.id}`} className="text-sm text-club-700 underline">
        ← {event.title}
      </Link>
      <PageTitle
        sub={
          players > 0
            ? `${players} ingeschreven. Een aanpassing moet passen bij wie al ingeschreven is.`
            : "Nog niemand ingeschreven."
        }
      >
        {seriesCode(category) ? `${seriesCode(category)} · ` : ""}
        {categoryLabel(category)}
      </PageTitle>

      <Card className="mb-6">
        <ActionForm action={updateCategory} className="grid grid-cols-2 items-end gap-3">
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="category_id" value={category.id} />
          <SeriesFields category={category} />
          <SubmitButton>Opslaan</SubmitButton>
        </ActionForm>
      </Card>

      {players === 0 ? (
        <ActionForm action={deleteCategory}>
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="category_id" value={category.id} />
          <SubmitButton variant="danger" confirm="Deze reeks verwijderen?">
            Reeks verwijderen
          </SubmitButton>
        </ActionForm>
      ) : (
        <p className="text-sm text-stone-600">
          Een reeks met inschrijvingen kan je niet verwijderen. Schrijf eerst iedereen uit.
        </p>
      )}
    </>
  );
}
