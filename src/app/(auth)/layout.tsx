import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 block text-center">
        <Image
          src="/logo.svg"
          alt="TC Sint-Michiels"
          width={218}
          height={59}
          priority
          className="mx-auto"
        />
        <span className="mt-3 block text-sm text-stone-600">Clubevenementen tennis en padel</span>
      </Link>
      {children}
    </main>
  );
}
