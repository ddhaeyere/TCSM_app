"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/forms";
import { requireOrganiser } from "@/lib/auth";
import { CATEGORY_CHOICES, brusselsInputToIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { RANKINGS } from "@/lib/rankings";
import { SERIES_GENDERS } from "@/lib/series";
import type { PlayFormat, SeriesGender, Sport } from "@/lib/types";

// Reads a category choice such as "padel:doubles"; null when it is not one we offer.
function readCategoryChoice(value: unknown): [Sport, PlayFormat] | null {
  const choice = CATEGORY_CHOICES.find((c) => c.value === String(value));
  return choice ? (choice.value.split(":") as [Sport, PlayFormat]) : null;
}

// Reads who may play and the maximum ranking of a series; a string is an error.
function readSeriesRules(
  formData: FormData,
  sport: Sport,
  format: PlayFormat,
): { gender: SeriesGender | null; max_ranking: string | null } | string {
  const genderRaw = String(formData.get("gender") ?? "");
  const gender = SERIES_GENDERS.find((g) => g.value === genderRaw)?.value ?? null;
  if (gender === "gemengd" && format !== "doubles") return "Gemengd kan alleen in het dubbelspel.";

  const raw = String(formData.get("max_ranking") ?? "").trim().toUpperCase().replace(/\s*P(TN)?\.?$/, "");
  if (!raw) return { gender, max_ranking: null };
  if (sport === "tennis") {
    const points = Number(raw);
    if (!Number.isInteger(points) || points < 1)
      return "Het maximumklassement voor tennis is een aantal punten, bv. 30.";
    return { gender, max_ranking: String(points) };
  }
  const level = raw.startsWith("P") ? raw : `P${raw}`;
  if (!RANKINGS.padel.includes(level))
    return `Het maximumklassement voor padel is een niveau: ${RANKINGS.padel.join(", ")}.`;
  return { gender, max_ranking: level };
}

function refresh(eventId?: string) {
  revalidatePath("/");
  revalidatePath("/beheer");
  if (eventId) {
    revalidatePath(`/evenementen/${eventId}`);
    revalidatePath(`/beheer/evenementen/${eventId}`);
  }
}

type EventFields = {
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  registration_deadline: string | null;
};

function readEventFields(formData: FormData): EventFields | string {
  const title = String(formData.get("title") ?? "").trim();
  const startsAt = brusselsInputToIso(String(formData.get("starts_at") ?? ""));
  const endsRaw = String(formData.get("ends_at") ?? "");
  const deadlineRaw = String(formData.get("registration_deadline") ?? "");
  const endsAt = endsRaw ? brusselsInputToIso(endsRaw) : null;
  const deadline = deadlineRaw ? brusselsInputToIso(deadlineRaw) : null;

  if (!title) return "Geef het evenement een naam.";
  if (!startsAt) return "Kies wanneer het evenement begint.";
  if (endsAt && endsAt < startsAt) return "Het einde ligt voor het begin.";
  if (deadline && deadline > startsAt) return "De inschrijvingen moeten sluiten voor het begin.";

  return {
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    location: String(formData.get("location") ?? "").trim() || null,
    starts_at: startsAt,
    ends_at: endsAt,
    registration_deadline: deadline,
  };
}

function readMaxPlayers(value: FormDataEntryValue | null): number | null | string {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return "Het maximum aantal spelers moet een positief getal zijn.";
  return n;
}

export async function createEvent(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireOrganiser();
  const fields = readEventFields(formData);
  if (typeof fields === "string") return { error: fields };

  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from("events")
    .insert({ ...fields, created_by: profile.id })
    .select("id")
    .single();
  if (error || !event) return { error: "Evenement aanmaken lukte niet." };

  refresh(event.id);
  redirect(`/beheer/evenementen/${event.id}`);
}

export async function updateEvent(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireOrganiser();
  const eventId = String(formData.get("event_id"));
  const fields = readEventFields(formData);
  if (typeof fields === "string") return { error: fields };

  const supabase = await createClient();
  const { error } = await supabase.from("events").update(fields).eq("id", eventId);
  if (error) return { error: "Opslaan lukte niet." };

  refresh(eventId);
  return { message: "Opgeslagen." };
}

export async function deleteEvent(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireOrganiser();
  const eventId = String(formData.get("event_id"));
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return { error: "Verwijderen lukte niet." };

  refresh();
  redirect("/beheer");
}

export async function addCategory(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireOrganiser();
  const eventId = String(formData.get("event_id"));
  const choice = readCategoryChoice(formData.get("category"));
  const label = String(formData.get("label") ?? "").trim() || null;
  const maxPlayers = readMaxPlayers(formData.get("max_players"));

  if (!choice) return { error: "Kies tennis dubbel, tennis enkel of padel." };
  const [sport, format] = choice;
  if (typeof maxPlayers === "string") return { error: maxPlayers };
  const rules = readSeriesRules(formData, sport, format);
  if (typeof rules === "string") return { error: rules };

  const supabase = await createClient();
  const { count } = await supabase
    .from("event_categories")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  const { error } = await supabase.from("event_categories").insert({
    event_id: eventId,
    sport,
    format,
    label,
    ...rules,
    max_players: maxPlayers,
    position: count ?? 0,
  });
  if (error) return { error: "Reeks toevoegen lukte niet." };

  refresh(eventId);
  return {};
}

export async function updateCategory(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireOrganiser();
  const eventId = String(formData.get("event_id"));
  const label = String(formData.get("label") ?? "").trim() || null;
  const maxPlayers = readMaxPlayers(formData.get("max_players"));
  if (typeof maxPlayers === "string") return { error: maxPlayers };

  const supabase = await createClient();
  const categoryId = String(formData.get("category_id"));
  const { data: category } = await supabase
    .from("event_categories")
    .select("sport, format")
    .eq("id", categoryId)
    .single();
  if (!category) return { error: "Reeks niet gevonden." };
  const rules = readSeriesRules(formData, category.sport, category.format);
  if (typeof rules === "string") return { error: rules };

  const { error } = await supabase
    .from("event_categories")
    .update({ label, ...rules, max_players: maxPlayers })
    .eq("id", categoryId);
  if (error) return { error: "Opslaan lukte niet." };

  refresh(eventId);
  return { message: "Opgeslagen." };
}

export async function deleteCategory(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireOrganiser();
  const eventId = String(formData.get("event_id"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_categories")
    .delete()
    .eq("id", String(formData.get("category_id")));
  if (error) return { error: "Verwijderen lukte niet." };

  refresh(eventId);
  return {};
}

export async function pairEntries(_: ActionState, formData: FormData): Promise<ActionState> {
  const eventId = String(formData.get("event_id"));
  const first = String(formData.get("first") ?? "");
  const second = String(formData.get("second") ?? "");
  if (!first || !second) return { error: "Kies twee spelers." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("organiser_pair_entries", {
    p_entry_id: first,
    p_other_entry_id: second,
  });
  if (error) return { error: error.message };

  refresh(eventId);
  return {};
}

export async function splitEntry(_: ActionState, formData: FormData): Promise<ActionState> {
  const eventId = String(formData.get("event_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("organiser_split_entry", {
    p_entry_id: String(formData.get("entry_id")),
    p_member_id: String(formData.get("member_id")),
  });
  if (error) return { error: error.message };

  refresh(eventId);
  return {};
}
