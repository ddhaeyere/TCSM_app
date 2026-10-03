import type { Metadata } from "next";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "Inloggen" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { fout } = await searchParams;

  return (
    <Card>
      <h1 className="mb-4 text-xl font-bold">Inloggen</h1>
      {fout === "link" && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Deze link is verlopen of al gebruikt. Log in, of vraag een nieuwe link aan.
        </p>
      )}
      <ActionForm action={login} className="space-y-4">
        <Field label="E-mailadres">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Wachtwoord">
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>
        <SubmitButton className="w-full">Inloggen</SubmitButton>
      </ActionForm>
      <div className="mt-4 flex justify-between text-sm">
        <Link href="/registreren" className="font-medium text-club-700 underline">
          Account aanmaken
        </Link>
        <Link href="/wachtwoord-vergeten" className="text-stone-600 underline">
          Wachtwoord vergeten?
        </Link>
      </div>
    </Card>
  );
}
