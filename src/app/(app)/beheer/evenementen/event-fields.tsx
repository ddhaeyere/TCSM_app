import { Field, inputClass } from "@/components/ui";
import { isoToBrusselsInput } from "@/lib/format";
import type { ClubEvent } from "@/lib/types";

export function EventFields({ event }: { event?: ClubEvent }) {
  return (
    <div className="space-y-4">
      <Field label="Naam">
        <input
          name="title"
          defaultValue={event?.title}
          required
          placeholder="Bv. Herfsttornooi dubbel"
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Begint op">
          <input
            name="starts_at"
            type="datetime-local"
            defaultValue={isoToBrusselsInput(event?.starts_at ?? null)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Eindigt op" hint="Optioneel">
          <input
            name="ends_at"
            type="datetime-local"
            defaultValue={isoToBrusselsInput(event?.ends_at ?? null)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Inschrijven kan tot" hint="Leeg laten: tot het begin van het evenement">
        <input
          name="registration_deadline"
          type="datetime-local"
          defaultValue={isoToBrusselsInput(event?.registration_deadline ?? null)}
          className={inputClass}
        />
      </Field>
      <Field label="Locatie" hint="Optioneel">
        <input name="location" defaultValue={event?.location ?? ""} className={inputClass} />
      </Field>
      <Field label="Beschrijving" hint="Optioneel: formule, prijs, wat er na het spelen gebeurt…">
        <textarea
          name="description"
          rows={4}
          defaultValue={event?.description ?? ""}
          className={inputClass}
        />
      </Field>
    </div>
  );
}
