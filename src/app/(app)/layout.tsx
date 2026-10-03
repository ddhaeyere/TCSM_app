import Link from "next/link";
import type { ReactNode } from "react";
import { isOrganiser, requireApprovedProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireApprovedProfile();

  return (
    <>
      <header className="sticky top-0 z-10 bg-court-700 text-white shadow">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 text-sm">
          <Link href="/" className="mr-auto text-lg font-extrabold tracking-tight">
            TCSM
          </Link>
          <Link href="/" className="hover:underline">
            Evenementen
          </Link>
          {isOrganiser(profile) && (
            <Link href="/beheer" className="hover:underline">
              Beheer
            </Link>
          )}
          <Link href="/profiel" className="hover:underline">
            Profiel
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
