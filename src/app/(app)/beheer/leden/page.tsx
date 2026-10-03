import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ClubMember } from "@/lib/types";

export const metadata: Metadata = { title: "Ledenlijst" };

export default async function MemberListPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_members");
  const members = (data ?? []) as (ClubMember & { email: string | null })[];

  return (
    <>
      <Link href="/beheer" className="text-sm text-club-700 underline">
        ← Beheer
      </Link>
      <PageTitle sub="Iedereen die ingeschreven kan worden. Met een account op hetzelfde e-mailadres kan een lid zelf inloggen.">
        Ledenlijst ({members.length})
      </PageTitle>

      <Link
        href="/beheer/leden/import"
        className="mb-4 inline-flex min-h-10 items-center rounded-lg bg-club-700 px-4 text-sm font-semibold text-white hover:bg-club-800"
      >
        Leden importeren
      </Link>

      <Card>
        {members.length === 0 && (
          <p className="text-sm text-stone-600">Nog geen leden. Importeer de ledenlijst van de club.</p>
        )}
        <ul className="divide-y divide-stone-100">
          {members.map((m) => (
            <li key={m.id}>
              <Link
                href={`/beheer/leden/${m.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
              >
                <span className="min-w-48 flex-1">
                  <span className="font-medium text-club-800 underline">
                    {m.last_name} {m.first_name}
                  </span>
                  <span className="block text-xs text-stone-600">{m.email ?? "geen e-mailadres"}</span>
                </span>
                <span className="text-xs text-stone-600">
                  Enkel {m.tennis_singles_ranking ?? "–"} · Dubbel {m.tennis_doubles_ranking ?? "–"} ·
                  Padel {m.padel_ranking ?? "–"}
                </span>
                {m.profile_id && <Badge tone="green">heeft account</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
