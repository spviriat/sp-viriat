import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";

export default function ProfileHeader() {
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          aria-label="Retour au tableau de bord"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-500"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white sm:flex">
            <UserRound className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">
              Mon compte
            </p>

            <h1 className="truncate text-xl font-extrabold text-slate-950 dark:text-white sm:text-2xl">
              Mon profil
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
}