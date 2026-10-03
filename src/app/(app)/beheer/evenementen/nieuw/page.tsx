import type { Metadata } from "next";
import Link from "next/link";
import { createEvent } from "@/app/actions/events";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageTitle } from "@/components/ui";
import { requireOrganiser } from "@/lib/auth";
import { EventFields } from "../event-fields";

export const metadata: Metadata = { title: "Nieuw evenement" };

const CATEGORY_CHOICES = [
  { value: "tennis:doubles", label: "Tennis dubbel", checked: true },
  { value: "padel:doubles", label: "Padel dubbel", checked: true },
  { value: "tennis:singles", label: "Tennis enkel", checked: false },
  { value: "padel:singles", label: "Padel enkel", checked: false },
];

export default async function NewEventPage() {
  await requireOrganiser();

  return (
    <>
      <Link href="/beheer" className="text-sm text-court-700 underline">
        ← Beheer
      </Link>
      <PageTitle>Nieuw evenement</PageTitle>
      <Card>
        <ActionForm action={createEvent} className="space-y-6">
          <EventFields />
          <fieldset>
            <legend className="text-sm font-medium text-stone-700">Categorieën</legend>
            <p className="text-xs text-stone-500">
              Je kan daarna nog categorieën toevoegen, een naam geven of een maximum instellen.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CATEGORY_CHOICES.map((c) => (
                <label
                  key={c.value}
                  className="flex items-center gap-2 rounded-lg border border-stone-200 p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="categories"
                    value={c.value}
                    defaultChecked={c.checked}
                    className="size-4 accent-court-700"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton>Evenement aanmaken</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
