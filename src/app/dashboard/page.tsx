"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/profile";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import WelcomeSection from "@/components/dashboard/WelcomeSection";
import QuickAccess from "@/components/dashboard/QuickAccess";
import UpcomingEvents from "@/components/dashboard/UpcomingEvents";
import NextDuty from "@/components/dashboard/NextDuty";

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
  const router = useRouter();

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        router.replace("/");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(`
  id,
  first_name,
  last_name,
  grade,
  fonction,
  telephone,
  avatar_url,
  role,
  theme,
  matricule,
  status
`)
        .eq("id", session.user.id)
        .single();

      if (profileError) {
        console.error(
          "Erreur lors de la récupération du profil :",
          profileError
        );
      } else {
        setProfile(profileData);
      }

      setIsCheckingSession(false);
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    router.replace("/");

    void supabase.auth.signOut({ scope: "local" }).then(({ error }) => {
      if (error) {
        console.error("Erreur lors de la déconnexion :", error);
      }
    });
  };

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="rounded-3xl bg-white px-8 py-7 text-center shadow-xl dark:bg-slate-900">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

          <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
            Chargement de l&apos;application...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-28 text-slate-950 dark:bg-slate-950 dark:text-white lg:pb-10">
      <DashboardHeader
  profile={profile}
  isLoggingOut={isLoggingOut}
  onLogout={handleLogout}
/>
    

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
                <p className="font-bold text-red-600">Rappel important</p>

                <h2 className="mt-1 text-lg font-extrabold">
                  Vérification des ARI
                </h2>

                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Pense à vérifier ton ARI avant la garde.
                </p>
              </div>

              <span className="text-3xl text-red-600">›</span>
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
                <p className="font-extrabold">Pense-bête</p>

                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  N&apos;oublie pas ta tenue de sport pour l&apos;entraînement.
                </p>
              </div>

              <span className="text-3xl">›</span>
            </Link>

            <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Mon compte
              </p>

              <div className="mt-3 space-y-1">
                <p className="font-extrabold text-slate-900 dark:text-white">
                  {profile
                    ? `${profile.first_name} ${profile.last_name}`.trim()
                    : "Profil indisponible"}
                </p>

                <p className="text-sm font-medium capitalize text-red-600">
                  {profile?.role || "Utilisateur"}
                </p>

                {profile?.grade && (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {profile.grade}
                  </p>
                )}

                {profile?.fonction && (
                  <p className="text-sm text-slate-500">
                    {profile.fonction}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="mt-5 w-full rounded-2xl border border-red-200 px-5 py-3 font-bold text-red-600 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/30 sm:hidden"
              >
                {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
              </button>
            </section>
          </aside>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-red-600"
          >
            <span className="text-2xl">🏠</span>
            <span className="text-xs font-bold">Accueil</span>
          </Link>

          <Link
            href="/dashboard/materiel"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">🧰</span>
            <span className="text-xs font-semibold">Matériel</span>
          </Link>

          <Link
            href="/dashboard/planning"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">📅</span>
            <span className="text-xs font-semibold">Planning</span>
          </Link>

          <Link
            href="/dashboard/messages"
            className="relative flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">💬</span>

            <span className="absolute right-[25%] top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              1
            </span>

            <span className="text-xs font-semibold">Messages</span>
          </Link>

          <Link
            href="/dashboard/plus"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">☰</span>
            <span className="text-xs font-semibold">Plus</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}