import type { Metadata } from "next";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "Account aanmaken" };

export default function SignupPage() {
  return (
    <Card>
      <h1 className="text-xl font-bold">Account aanmaken</h1>
      <p className="mt-1 mb-4 text-sm text-stone-600">
        Gebruik het e-mailadres dat de club van je heeft, dan kan je meteen aan de slag. Anders keurt een beheerder je account eerst goed.
      </p>
      <ActionForm action={signup} className="space-y-4">
        <Field label="Voor- en achternaam">
          <input name="full_name" autoComplete="name" required className={inputClass} />
        </Field>
        <Field label="E-mailadres">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Wachtwoord" hint="Minstens 8 tekens">
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={inputClass}
          />
        </Field>
        <SubmitButton className="w-full">Account aanmaken</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-sm">
        Al een account?{" "}
        <Link href="/login" className="font-medium text-club-700 underline">
          Inloggen
        </Link>
      </p>
    </Card>
  );
}
