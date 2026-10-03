"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ActionState } from "@/components/forms";
import { categoryLabel, formatDateTime } from "@/lib/format";
import { sendMail } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

function refresh(eventId: string) {
  revalidatePath("/");
  revalidatePath(`/evenementen/${eventId}`);
  revalidatePath(`/beheer/evenementen/${eventId}`);
}

export async function registerForCategory(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("event_id"));
  const memberId = String(formData.get("member_id") ?? "");
  const partnerId = String(formData.get("partner_id") ?? "");
  if (!memberId) return { error: "Kies wie je inschrijft." };

  const supabase = await createClient();
  const { data: entryId, error } = await supabase.rpc("register_for_category", {
    p_category_id: String(formData.get("category_id")),
    p_member_id: memberId,
    p_partner_id: partnerId || null,
  });
  if (error) return { error: error.message };

  await mailPlayers(entryId as string);
  refresh(eventId);
  return { message: "Ingeschreven." };
}

export async function addPartner(_: ActionState, formData: FormData): Promise<ActionState> {
  const eventId = String(formData.get("event_id"));
  const entryId = String(formData.get("entry_id"));
  const memberId = String(formData.get("member_id") ?? "");
  if (!memberId) return { error: "Kies een partner." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_partner", {
    p_entry_id: entryId,
    p_member_id: memberId,
  });
  if (error) return { error: error.message };

  await mailPlayers(entryId);
  refresh(eventId);
  return {};
}

export async function withdrawRegistration(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("event_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_registration", {
    p_entry_id: String(formData.get("entry_id")),
    p_member_id: String(formData.get("member_id")),
  });
  if (error) return { error: error.message };

  refresh(eventId);
  return {};
}

// Lets every player of a fresh registration know they are registered, and
// by whom. Players registered earlier on the same entry get no new mail.
async function mailPlayers(entryId: string) {
  const supabase = await createClient();
  const [{ data: players }, { data: entry }] = await Promise.all([
    supabase.rpc("registration_mail_details", { p_entry_id: entryId }),
    supabase
      .from("entries")
      .select("category:event_categories ( sport, format, label, gender, max_ranking, event:events ( id, title, starts_at ) )")
      .eq("id", entryId)
      .single(),
  ]);
  if (!players?.length || !entry) return;

  const category = entry.category as unknown as Pick<Category, "sport" | "format" | "label" | "gender" | "max_ranking"> & {
    event: { id: string; title: string; starts_at: string };
  };
  const { event } = category;
  const head = await headers();
  const link = `${head.get("x-forwarded-proto") ?? "https"}://${head.get("host")}/evenementen/${event.id}`;
  const teammates = (players as { full_name: string }[]).map((p) => p.full_name);

  await Promise.all(
    (
      players as {
        full_name: string;
        email: string | null;
        registered_by_name: string | null;
        is_self: boolean;
      }[]
    )
      .filter((p) => p.email)
      .map((p) => {
        const partner = teammates.find((name) => name !== p.full_name);
        const lines = [
          `Dag ${p.full_name},`,
          "",
          `Je bent ingeschreven voor ${event.title} op ${formatDateTime(event.starts_at)}, ` +
            `in de reeks ${categoryLabel(category)}` +
            (partner ? `, samen met ${partner}.` : "."),
          p.registered_by_name && !p.is_self ? `${p.registered_by_name} schreef je in.` : "",
          "",
          `Bekijk wie er nog meedoet: ${link}`,
          "",
          "Sportieve groeten,",
          "TC Sint-Michiels",
        ];
        return sendMail(p.email!, `Ingeschreven: ${event.title}`, lines.join("\n"));
      }),
  );
}
