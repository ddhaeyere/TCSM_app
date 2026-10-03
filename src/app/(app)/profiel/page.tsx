import type { Metadata } from "next";
import { logout } from "@/app/actions/auth";
import { updateProfile } from "@/app/actions/profile";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";
import { requireApprovedProfile } from "@/lib/auth";
import { rankingOptions } from "@/lib/rankings";
import type { Sport } from "@/lib/types";

export const metadata: Metadata = { title: "Profiel" };

const ROLE_LABELS = { member: "Lid", organiser: "Organisator", admin: "Beheerder" };

export default async function ProfilePage() {
  const profile = await requireApprovedProfile();

  return (
    <>
      <PageTitle sub={ROLE_LABELS[profile.role]}>Mijn profiel</PageTitle>
      <Card>
        <ActionForm action={updateProfile} className="space-y-4">
          <Field label="Voor- en achternaam">
            <input
              name="full_name"
              defaultValue={profile.full_name}
              required
              className={inputClass}
            />
          </Field>
          <RankingField
            sport="tennis"
            name="tennis_singles_ranking"
            label="Klassement tennis enkel"
            value={profile.tennis_singles_ranking}
          />
          <RankingField
            sport="tennis"
            name="tennis_doubles_ranking"
            label="Klassement tennis dubbel"
            value={profile.tennis_doubles_ranking}
          />
          <RankingField
            sport="padel"
            name="padel_ranking"
            label="Klassement padel"
            value={profile.padel_ranking}
          />
          <SubmitButton>Opslaan</SubmitButton>
        </ActionForm>
      </Card>
      <form action={logout} className="mt-6">
        <button className="text-sm text-stone-600 underline">Uitloggen</button>
      </form>
    </>
  );
}

function RankingField({
  sport,
  name,
  label,
  value,
}: {
  sport: Sport;
  name: string;
  label: string;
  value: string | null;
}) {
  return (
    <Field
      label={label}
      hint="Wordt ingevuld bij je volgende inschrijving. Je kan het daar nog aanpassen."
    >
      <select name={name} defaultValue={value ?? ""} className={inputClass}>
        <option value="">Niet ingevuld</option>
        {rankingOptions(sport).map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </Field>
  );
}
