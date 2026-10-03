import { Field, inputClass } from "@/components/ui";
import { SERIES_GENDERS } from "@/lib/series";
import type { Category } from "@/lib/types";

// Who may play, the maximum ranking, an optional name and a player limit.
export function SeriesFields({ category }: { category?: Category }) {
  return (
    <>
      <Field label="Voor">
        <select name="gender" defaultValue={category?.gender ?? ""} className={inputClass}>
          <option value="">Iedereen</option>
          {SERIES_GENDERS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Max. klassement">
        <input
          name="max_ranking"
          defaultValue={category?.max_ranking ?? ""}
          placeholder="Bv. 30 of P300"
          className={inputClass}
        />
      </Field>
      <Field label="Naam">
        <input
          name="label"
          defaultValue={category?.label ?? ""}
          placeholder="Optioneel"
          className={inputClass}
        />
      </Field>
      <Field label="Max. spelers">
        <input
          name="max_players"
          type="number"
          min={1}
          defaultValue={category?.max_players ?? ""}
          className={inputClass}
        />
      </Field>
    </>
  );
}
