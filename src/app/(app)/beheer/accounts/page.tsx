import type { Metadata } from "next";
import Link from "next/link";
import { updateAccount } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, PageTitle, inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AccountStatus, UserRole } from "@/lib/types";

export const metadata: Metadata = { title: "Accounts" };

interface Account {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
}

// Organisers still exist in the database, but the club only uses two roles:
// admins manage events and members, members register.
const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  member: "Lid",
  admin: "Beheerder",
};

export default async function AccountsPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_profiles");
  const members = (data ?? []) as Account[];

  const pending = members.filter((m) => m.status === "pending");
  const approved = members.filter((m) => m.status === "approved");
  const rejected = members.filter((m) => m.status === "rejected");

  return (
    <>
      <Link href="/beheer" className="text-sm text-club-700 underline">
        ← Beheer
      </Link>
      <PageTitle sub="Wie kan inloggen in de app. Wie met een e-mailadres uit de ledenlijst een account maakt, wordt automatisch goedgekeurd.">
        Accounts
      </PageTitle>

      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">Wachten op goedkeuring</h2>
        {pending.length === 0 && <p className="text-sm text-stone-600">Niemand.</p>}
        <ul className="divide-y divide-stone-100">
          {pending.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="flex-1">
                <span className="font-medium">{m.full_name}</span>
                <span className="block text-sm text-stone-600">{m.email}</span>
              </span>
              <ActionForm action={updateAccount} className="flex gap-2">
                <input type="hidden" name="profile_id" value={m.id} />
                <SubmitButton name="status" value="approved">
                  Goedkeuren
                </SubmitButton>
                <SubmitButton name="status" value="rejected" variant="secondary">
                  Weigeren
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">Goedgekeurd ({approved.length})</h2>
        <ul className="divide-y divide-stone-100">
          {approved.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-48 flex-1">
                <span className="font-medium">{m.full_name}</span>
                <span className="block text-sm text-stone-600">{m.email}</span>
              </span>
              {m.id === me.id ? (
                <Badge tone="green">{ROLE_LABELS[m.role] ?? "Organisator"} (jij)</Badge>
              ) : (
                <ActionForm action={updateAccount} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="profile_id" value={m.id} />
                  <select
                    name="role"
                    defaultValue={m.role}
                    aria-label={`Rol van ${m.full_name}`}
                    className={`${inputClass} mt-0 w-auto py-1.5 text-sm`}
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <SubmitButton variant="secondary">Rol opslaan</SubmitButton>
                  <SubmitButton
                    name="status"
                    value="rejected"
                    variant="danger"
                    confirm={`Toegang van ${m.full_name} intrekken?`}
                  >
                    Toegang intrekken
                  </SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {rejected.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Geweigerd</h2>
          <ul className="divide-y divide-stone-100">
            {rejected.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1">
                  <span className="font-medium">{m.full_name}</span>
                  <span className="block text-sm text-stone-600">{m.email}</span>
                </span>
                <ActionForm action={updateAccount}>
                  <input type="hidden" name="profile_id" value={m.id} />
                  <SubmitButton name="status" value="approved" variant="secondary">
                    Toch goedkeuren
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
