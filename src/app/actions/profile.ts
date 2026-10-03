"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/forms";
import { getCurrentMember, getCurrentProfile } from "@/lib/auth";
import { isValidRanking } from "@/lib/rankings";
import { createClient } from "@/lib/supabase/server";
import type { Sport } from "@/lib/types";

const RANKING_FIELDS: [string, Sport][] = [
  ["tennis_singles_ranking", "tennis"],
  ["tennis_doubles_ranking", "tennis"],
  ["padel_ranking", "padel"],
];

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Je bent niet ingelogd." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName.length < 2) return { error: "Vul je voor- en achternaam in." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", profile.id);
  if (error) return { error: "Opslaan lukte niet." };

  // Rankings belong to the member on the club list.
  const member = await getCurrentMember();
  if (member) {
    const rankings: Record<string, string | null> = {};
    for (const [field, sport] of RANKING_FIELDS) {
      const value = String(formData.get(field) ?? "");
      if (value && !isValidRanking(sport, value)) return { error: "Ongeldig klassement." };
      rankings[field] = value || null;
    }
    const { error: rankingError } = await supabase
      .from("club_members")
      .update(rankings)
      .eq("id", member.id);
    if (rankingError) return { error: "Je klassementen opslaan lukte niet." };
  }

  revalidatePath("/", "layout");
  return { message: "Opgeslagen." };
}
