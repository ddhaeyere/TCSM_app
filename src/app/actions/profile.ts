"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/forms";
import { getCurrentProfile } from "@/lib/auth";
import { isValidRanking } from "@/lib/rankings";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Je bent niet ingelogd." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const tennisSingles = String(formData.get("tennis_singles_ranking") ?? "");
  const tennisDoubles = String(formData.get("tennis_doubles_ranking") ?? "");
  const padel = String(formData.get("padel_ranking") ?? "");

  if (fullName.length < 2) return { error: "Vul je voor- en achternaam in." };
  for (const tennis of [tennisSingles, tennisDoubles]) {
    if (tennis && !isValidRanking("tennis", tennis)) return { error: "Ongeldig tennisklassement." };
  }
  if (padel && !isValidRanking("padel", padel)) return { error: "Ongeldig padelklassement." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      tennis_singles_ranking: tennisSingles || null,
      tennis_doubles_ranking: tennisDoubles || null,
      padel_ranking: padel || null,
    })
    .eq("id", profile.id);
  if (error) return { error: "Opslaan lukte niet." };

  revalidatePath("/", "layout");
  return { message: "Opgeslagen." };
}
