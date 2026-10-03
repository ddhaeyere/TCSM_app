import type { Metadata } from "next";
import { logout } from "@/app/actions/auth";
import { updateProfile } from "@/app/actions/profile";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageTitle, RankingField, inputClass } from "@/components/ui";
import { getCurrentMember, requireApprovedProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Profiel" };

const ROLE_LABELS = { member: "Lid", organiser: "Organisator", admin: "Beheerder" };

export default async function ProfilePage() {
  const profile = await requireApprovedProfile();
  const member = await getCurrentMember();

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
          {member ? (
            <>
              <RankingField
                sport="tennis"
                name="tennis_singles_ranking"
                label="Klassement tennis enkel"
                value={member.tennis_singles_ranking}
              />
              <RankingField
                sport="tennis"
                name="tennis_doubles_ranking"
                label="Klassement tennis dubbel"
                value={member.tennis_doubles_ranking}
              />
              <RankingField
                sport="padel"
                name="padel_ranking"
                label="Klassement padel"
                value={member.padel_ranking}
              />
            </>
          ) : (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Je account is nog niet gekoppeld aan de ledenlijst van de club, omdat je
              e-mailadres er niet in staat. Vraag een beheerder om het toe te voegen; daarna
              kan je je klassementen hier aanpassen en jezelf inschrijven.
            </p>
          )}
          <SubmitButton>Opslaan</SubmitButton>
        </ActionForm>
      </Card>
      <form action={logout} className="mt-6">
        <button className="text-sm text-stone-600 underline">Uitloggen</button>
      </form>
    </>
  );
}
