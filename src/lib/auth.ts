import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { MEMBER_COLUMNS, type ClubMember, type Profile } from "./types";

export const PROFILE_COLUMNS = "id, full_name, role, status";

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

// The club member that belongs to the logged-in account, linked through the
// email address. Null when the account is not on the member list.
export const getCurrentMember = cache(async (): Promise<ClubMember | null> => {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("club_members")
    .select(MEMBER_COLUMNS)
    .eq("profile_id", profile.id)
    .maybeSingle();
  return (data as ClubMember | null) ?? null;
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
