import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export const PROFILE_COLUMNS = "id, full_name, role, status, tennis_singles_ranking, tennis_doubles_ranking, padel_ranking";

// The logged-in member's profile, or null when nobody is logged in.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .single();
  return (data as Profile | null) ?? null;
});

export async function requireApprovedProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "approved") redirect("/wachten");
  return profile;
}

export function isOrganiser(profile: Profile): boolean {
  return profile.role === "organiser" || profile.role === "admin";
}

export async function requireOrganiser(): Promise<Profile> {
  const profile = await requireApprovedProfile();
  if (!isOrganiser(profile)) redirect("/");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireApprovedProfile();
  if (profile.role !== "admin") redirect("/");
  return profile;
}
