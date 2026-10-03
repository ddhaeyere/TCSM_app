import { registerForCategory } from "@/app/actions/registrations";
import { availableMembers, memberOption } from "@/components/entries-table";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, inputClass } from "@/components/ui";
import { groupEntries, placesLeft } from "@/lib/entries";
import { categoryLabel, plural } from "@/lib/format";
import { seriesCode } from "@/lib/series";
import type { Category, ClubEvent, ClubMember } from "@/lib/types";

// A series with its registration form: register yourself or any other member.
export function RegisterCard({
  event,
  category,
  me,
  members,
  open,
}: {
  event: ClubEvent;
  category: Category;
  me: ClubMember | null;
  members: ClubMember[];
  open: boolean;
}) {
  const entries = groupEntries(category);
  const left = placesLeft(category);
  const doubles = category.format === "doubles";
  const mine =
    me && entries.find((e) => e.players.some((p) => p.member_id === me.id));
  const teams = entries.filter((e) => e.kind === "team");
  const available = availableMembers(category, members);
  const option = memberOption(category);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {seriesCode(category) && (
            <span className="mr-2 text-club-700">{seriesCode(category)}</span>
          )}
          {categoryLabel(category)}
        </h2>
        <span className="text-sm text-stone-600">
          {plural(category.entry_players.length, "speler", "spelers")}
          {doubles && ` · ${plural(teams.length, "team", "teams")}`}
          {left !== null &&
            ` · ${left === 0 ? "volzet" : `nog ${left} plaatsen`}`}
        </span>
      </div>

      {mine && (
        <p className="mt-3 rounded-lg bg-club-50 p-3 text-sm text-club-900">
          <strong>Je bent ingeschreven</strong>
          {mine.kind === "team" &&
            ` samen met ${mine.players.find((p) => p.member_id !== me?.id)?.member?.full_name}`}
          {mine.kind === "looking" && " en je zoekt nog een partner"}.
        </p>
      )}

      {/* Registration form: yourself or any other member */}
      {open && left !== 0 && available.length > 0 && (
        <ActionForm
          action={registerForCategory}
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="category_id" value={category.id} />
          <Field label="Speler">
            <select
              name="member_id"
              defaultValue={me && !mine ? me.id : ""}
              required
              className={inputClass}
            >
              <option value="" disabled>
                Kies een speler
              </option>
              {available.map(option)}
            </select>
          </Field>
          {doubles ? (
            <Field label="Partner">
              <select name="partner_id" defaultValue="" className={inputClass}>
                <option value="">Zoekt nog een partner</option>
                {available.map(option)}
              </select>
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
          <SubmitButton>Inschrijven</SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}
