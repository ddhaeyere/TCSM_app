import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 block text-center">
        <span className="text-3xl font-extrabold tracking-tight text-court-700">TCSM</span>
        <span className="mt-1 block text-sm text-stone-600">Clubevenementen tennis en padel</span>
      </Link>
      {children}
    </main>
  );
}
