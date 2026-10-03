import type { ReactNode } from "react";
import { rankingOptions } from "@/lib/rankings";
import type { Sport } from "@/lib/types";

export const inputClass =
  "mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 focus:border-club-600 focus:outline-none focus:ring-2 focus:ring-club-200";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-stone-500">{hint}</span>}
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-stone-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "club";
}) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    club: "bg-club-100 text-club-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

// A ranking dropdown for forms where the ranking may stay empty.
export function RankingField({
  sport,
  name,
  label,
  value,
}: {
  sport: Sport;
  name: string;
  label: string;
  value: string | null;
}) {
  return (
    <Field label={label}>
      <select name={name} defaultValue={value ?? ""} className={inputClass}>
        <option value="">Niet ingevuld</option>
        {rankingOptions(sport).map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold text-stone-900">{children}</h1>
      {sub && <p className="mt-1 text-sm text-stone-600">{sub}</p>}
    </div>
  );
}
