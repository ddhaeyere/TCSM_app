import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { Card } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Wachten op goedkeuring" };

export default async function WaitingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.status === "approved") redirect("/");

  const rejected = profile.status === "rejected";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Card>
        <h1 className="text-xl font-bold">
          {rejected ? "Geen toegang" : `Welkom, ${profile.full_name}`}
        </h1>
        <p className="mt-2 text-stone-700">
          {rejected
            ? "Je account is niet goedgekeurd. Denk je dat dit een vergissing is, neem dan contact op met het clubbestuur."
            : "Je account wacht op goedkeuring door een beheerder van de club. Zodra dat gebeurd is, zie je hier de evenementen."}
        </p>
        <form action={logout} className="mt-4">
          <button className="text-sm text-stone-600 underline">Uitloggen</button>
        </form>
      </Card>
    </main>
  );
}
