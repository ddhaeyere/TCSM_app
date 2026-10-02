"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/forms";
import { createClient } from "@/lib/supabase/server";
import type { AccountStatus, UserRole } from "@/lib/types";

const STATUSES: AccountStatus[] = ["pending", "approved", "rejected"];
const ROLES: UserRole[] = ["member", "organiser", "admin"];

export async function updateMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const status = String(formData.get("status") ?? "") as AccountStatus;
  const role = String(formData.get("role") ?? "") as UserRole;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_profile", {
    p_profile_id: String(formData.get("profile_id")),
    p_status: STATUSES.includes(status) ? status : null,
    p_role: ROLES.includes(role) ? role : null,
  });
  if (error) return { error: error.message };

  revalidatePath("/beheer/leden");
  revalidatePath("/beheer");
  return {};
}
