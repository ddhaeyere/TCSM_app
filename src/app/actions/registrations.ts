"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/forms";
import { isValidRanking } from "@/lib/rankings";
import { createClient } from "@/lib/supabase/server";
import type { Sport } from "@/lib/types";

function refresh(eventId: string) {
  revalidatePath("/");
  revalidatePath(`/evenementen/${eventId}`);
}

export async function registerForCategory(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("event_id"));
  const categoryId = String(formData.get("category_id"));
  const sport = String(formData.get("sport")) as Sport;
  const ranking = String(formData.get("ranking") ?? "");
  const partnerId = String(formData.get("partner_id") ?? "");

  if (!isValidRanking(sport, ranking)) return { error: "Kies je klassement." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_for_category", {
    p_category_id: categoryId,
    p_ranking: ranking,
    p_partner_id: partnerId || null,
  });
  if (error) return { error: error.message };

  refresh(eventId);
  return {};
}

export async function respondToInvitation(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("event_id"));
  const sport = String(formData.get("sport")) as Sport;
  const accept = formData.get("answer") === "accept";
  const ranking = String(formData.get("ranking") ?? "");

  if (accept && !isValidRanking(sport, ranking)) return { error: "Kies je klassement." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_invitation", {
    p_entry_id: String(formData.get("entry_id")),
    p_accept: accept,
    p_ranking: accept ? ranking : null,
  });
  if (error) return { error: error.message };

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
  });
  if (error) return { error: error.message };

  refresh(eventId);
  return {};
}
