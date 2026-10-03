import type { ReactNode } from "react";
import { rankingOptions } from "@/lib/rankings";
import type { Sport } from "@/lib/types";

export const inputClass =
  "mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 focus:border-court-600 focus:outline-none focus:ring-2 focus:ring-court-200";

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
  tone?: "neutral" | "green" | "amber" | "clay";
}) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700",
    green: "bg-court-100 text-court-800",
    amber: "bg-amber-100 text-amber-800",
    clay: "bg-clay-100 text-clay-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function RankingSelect({
  sport,
  defaultValue,
  name = "ranking",
}: {
  sport: Sport;
  defaultValue?: string | null;
  name?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required className={inputClass}>
      <option value="" disabled>
        Kies je klassement
      </option>
      {rankingOptions(sport).map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
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
