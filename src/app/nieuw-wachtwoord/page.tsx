import type { Metadata } from "next";
import { updatePassword } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "Nieuw wachtwoord" };

export default function NewPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Card>
        <h1 className="mb-4 text-xl font-bold">Kies een nieuw wachtwoord</h1>
        <ActionForm action={updatePassword} className="space-y-4">
          <Field label="Nieuw wachtwoord" hint="Minstens 8 tekens">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className={inputClass}
            />
          </Field>
          <SubmitButton className="w-full">Opslaan</SubmitButton>
        </ActionForm>
      </Card>
    </main>
  );
}
