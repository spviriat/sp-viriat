"use client";

import Link from "next/link";

import WelcomeSection from "@/components/dashboard/WelcomeSection";
import QuickAccess from "@/components/dashboard/QuickAccess";
import UpcomingEvents from "@/components/dashboard/UpcomingEvents";
import NextDuty from "@/components/dashboard/NextDuty";
import { useDashboardShell } from "@/components/dashboard/DashboardShell";

const quickAccessItems = [
  {
    title: "Mon matériel",
    icon: "🧰",
    href: "/dashboard/materiel",
  },
  {
    title: "Mon sac",
    icon: "🎒",
    href: "/dashboard/sac",
  },
  {
    title: "Vérifications",
    icon: "✅",
    href: "/dashboard/verifications",
  },
  {
    title: "Disponibilités",
    icon: "📅",
    href: "/dashboard/disponibilites",
  },
  {
    title: "Actualités",
    icon: "📰",
    href: "/dashboard/actualites",
    hasNotification: true,
  },
  {
    title: "Événements indésirables",
    icon: "⚠️",
    href: "/dashboard/evenements-indesirables",
  },
  {
    title: "Documents",
    icon: "📁",
    href: "/dashboard/documents",
  },
  {
    title: "Annuaire",
    icon: "👥",
    href: "/dashboard/annuaire",
  },
];

const upcomingEvents = [
  {
    day: "15",
    month: "JUIN",
    title: "Manœuvre départementale",
    location: "Caserne de Viriat",
    time: "08:00",
  },
  {
    day: "14",
    month: "JUIL.",
    title: "Cérémonie du 14 juillet",
    location: "Place de la Mairie",
    time: "10:30",
  },
];

export default function DashboardPage() {
  const {
    profile,
    canManageUsers,
    managementLabel,
    isLoggingOut,
    handleLogout,
  } = useDashboardShell();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <WelcomeSection profile={profile} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Link
            href="/dashboard/verifications"
            className="flex items-center gap-4 rounded-3xl border border-red-200 bg-red-50 p-5 transition hover:border-red-300 hover:shadow-md active:scale-[0.99] dark:border-red-900 dark:bg-red-950/30"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-600 text-2xl text-white">
              ⚠️
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-bold text-red-600">
                Rappel important
              </p>
              <h2 className="mt-1 text-lg font-extrabold">
                Vérification des ARI
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pense à vérifier ton ARI avant la garde.
              </p>
            </div>

            <span className="text-3xl text-red-600">
              ›
            </span>
          </Link>

          <QuickAccess items={quickAccessItems} />
          <UpcomingEvents events={upcomingEvents} />
        </div>

        <aside className="space-y-6">
          <NextDuty />

          <Link
            href="/dashboard/notifications"
            className="flex items-center gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 transition hover:shadow-md active:scale-[0.99] dark:border-amber-900 dark:bg-amber-950/30"
          >
            <div className="text-3xl">⚠️</div>

            <div className="min-w-0 flex-1">
              <p className="font-extrabold">
                Pense-bête
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                N&apos;oublie pas ta tenue de sport pour
                l&apos;entraînement.
              </p>
            </div>

            <span className="text-3xl">›</span>
          </Link>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Mon compte
            </p>

            <div className="mt-3 space-y-1">
              <p className="font-extrabold text-foreground">
                {profile
                  ? `${profile.first_name} ${profile.last_name}`.trim()
                  : "Profil indisponible"}
              </p>

              <p className="text-sm font-medium capitalize text-red-600">
                {profile?.role || "Utilisateur"}
              </p>

              {profile?.grade && (
                <p className="text-sm text-muted-foreground">
                  {profile.grade}
                </p>
              )}

              {managementLabel && (
                <div className="pt-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span>✓</span>
                    {managementLabel}
                  </span>
                </div>
              )}

              {profile?.fonction && (
                <p className="pt-1 text-sm text-muted-foreground">
                  {profile.fonction}
                </p>
              )}
            </div>

            {canManageUsers && (
              <Link
                href="/dashboard/admin"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <span>⚙️</span>
                <span>Gestion des utilisateurs</span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-3 w-full rounded-2xl border border-red-200 px-5 py-3 font-bold text-red-600 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/30 sm:hidden"
            >
              {isLoggingOut
                ? "Déconnexion..."
                : "Se déconnecter"}
            </button>
          </section>
        </aside>
      </div>
    </main>
  );
}