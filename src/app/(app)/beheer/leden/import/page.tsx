import type { Metadata } from "next";
import Link from "next/link";
import { importMembers } from "@/app/actions/members";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Leden importeren" };

const EXAMPLE = `Naam\tVoornaam\tGeslacht\tEnkel\tDubbel\tPadel\tE-mail
De Meyer\tSien\tV\t3 ptn\t5 ptn\tP50\tsien@voorbeeld.be`;

export default async function ImportMembersPage() {
  await requireAdmin();

  return (
    <>
      <Link href="/beheer/leden" className="text-sm text-club-700 underline">
        ← Ledenlijst
      </Link>
      <PageTitle sub="Kopieer de lijst uit Excel en plak ze hieronder, of kies een CSV-bestand.">
        Leden importeren
      </PageTitle>

      <Card>
        <ActionForm action={importMembers} className="space-y-4">
          <Field
            label="Ledenlijst"
            hint='De eerste regel bevat de kolomnamen: Naam, Voornaam, Geslacht, Enkel, Dubbel, Padel en E-mail. Alleen Naam en Voornaam zijn verplicht. Een lid dat al bestaat (zelfde e-mailadres of zelfde naam) wordt bijgewerkt.'
          >
            <textarea
              name="text"
              rows={10}
              placeholder={EXAMPLE}
              className={`${inputClass} font-mono text-sm`}
            />
          </Field>
          <Field label="Of kies een CSV-bestand">
            <input name="file" type="file" accept=".csv,.txt,.tsv,text/csv" className="mt-1 block text-sm" />
          </Field>
          <SubmitButton>Importeren</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
