import type { Metadata } from "next";
import Link from "next/link";
import { createEvent } from "@/app/actions/events";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageTitle } from "@/components/ui";
import { requireOrganiser } from "@/lib/auth";
import { EventFields } from "../event-fields";

export const metadata: Metadata = { title: "Nieuw evenement" };

export default async function NewEventPage() {
  await requireOrganiser();

  return (
    <>
      <Link href="/beheer" className="text-sm text-club-700 underline">
        ← Beheer
      </Link>
      <PageTitle>Nieuw evenement</PageTitle>
      <Card>
        <ActionForm action={createEvent} className="space-y-6">
          <EventFields />
          <p className="text-sm text-stone-600">
            Na het aanmaken voeg je de reeksen toe, bijvoorbeeld dubbel dames tot 30 punten.
          </p>
          <SubmitButton>Evenement aanmaken</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
