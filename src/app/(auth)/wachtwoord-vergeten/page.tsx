import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "Wachtwoord vergeten" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <h1 className="text-xl font-bold">Wachtwoord vergeten</h1>
      <p className="mt-1 mb-4 text-sm text-stone-600">
        We sturen je een link om een nieuw wachtwoord te kiezen.
      </p>
      <ActionForm action={requestPasswordReset} className="space-y-4">
        <Field label="E-mailadres">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <SubmitButton className="w-full">Stuur link</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-sm">
        <Link href="/login" className="text-court-700 underline">
          Terug naar inloggen
        </Link>
      </p>
    </Card>
  );
}
