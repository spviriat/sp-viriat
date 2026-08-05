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

type BusinessRoleAssignment = {
  business_roles:
    | {
        code: string;
      }
    | {
        code: string;
      }[]
    | null;
};

const USER_MANAGEMENT_ROLES = [
  "chef_centre",
  "adjoint_chef_centre",
];

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

function getBusinessRoleCode(
  assignment: BusinessRoleAssignment
): string | null {
  if (!assignment.business_roles) {
    return null;
  }

  if (Array.isArray(assignment.business_roles)) {
    return assignment.business_roles[0]?.code ?? null;
  }

  return assignment.business_roles.code;
}

export default function DashboardPage() {
  const router = useRouter();

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  /*
   * Autorise l'accès à la gestion des utilisateurs pour :
   *
   * - Administrateur
   * - Chef de centre
   * - Adjoint chef de centre
   */

  const [canManageUsers, setCanManageUsers] = useState(false);

  const [managementLabel, setManagementLabel] = useState<
    "Administrateur" | "Chef de centre" | "Adjoint chef de centre" | null
  >(null);

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

      /*
       * =====================================================
       * 1. Récupération du profil
       * =====================================================
       */

      const { data: profileData, error: profileError } =
        await supabase
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
            access_role,
            theme,
            matricule,
            status
          `)
          .eq("id", session.user.id)
          .single();

      if (profileError || !profileData) {
        console.error(
          "Erreur lors de la récupération du profil :",
          profileError
        );

        await supabase.auth.signOut({
          scope: "local",
        });

        router.replace("/");
        return;
      }

      /*
       * =====================================================
       * 2. Première connexion
       * =====================================================
       */

      if (
        profileData.status ===
        "temporary_password"
      ) {
        router.replace(
          "/auth/complete-profile"
        );

        return;
      }

      /*
       * =====================================================
       * 3. Récupération des rôles métier
       * =====================================================
       */

      const {
        data: businessRoleAssignments,
        error: businessRoleError,
      } = await supabase
        .from("profile_business_roles")
        .select(`
          business_roles!inner (
            code
          )
        `)
        .eq(
          "profile_id",
          session.user.id
        );

      if (businessRoleError) {
        console.error(
          "Erreur lors de la récupération des rôles métier :",
          businessRoleError
        );
      }

      const businessRoleCodes = (
        (businessRoleAssignments ??
          []) as BusinessRoleAssignment[]
      )
        .map(getBusinessRoleCode)
        .filter(
          (code): code is string =>
            Boolean(code)
        );

      /*
       * =====================================================
       * 4. Calcul des droits de gestion
       * =====================================================
       */

      const isAdmin =
        profileData.access_role === "admin";

      const isChefCentre =
        businessRoleCodes.includes(
          "chef_centre"
        );

      const isAdjointChefCentre =
        businessRoleCodes.includes(
          "adjoint_chef_centre"
        );

      const hasManagementRole =
        businessRoleCodes.some((code) =>
          USER_MANAGEMENT_ROLES.includes(
            code
          )
        );

      setCanManageUsers(
        isAdmin || hasManagementRole
      );

      if (isAdmin) {
        setManagementLabel(
          "Administrateur"
        );
      } else if (isChefCentre) {
        setManagementLabel(
          "Chef de centre"
        );
      } else if (
        isAdjointChefCentre
      ) {
        setManagementLabel(
          "Adjoint chef de centre"
        );
      } else {
        setManagementLabel(null);
      }

      setProfile(profileData as Profile);
      setIsCheckingSession(false);
    };

    void checkSession();

    /*
     * =====================================================
     * Surveillance de la session
     * =====================================================
     */

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!session) {
            router.replace("/");
          }
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  /*
   * =====================================================
   * DÉCONNEXION
   * =====================================================
   */

  const handleLogout = () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    router.replace("/");

    void supabase.auth
      .signOut({
        scope: "local",
      })
      .then(({ error }) => {
        if (error) {
          console.error(
            "Erreur lors de la déconnexion :",
            error
          );
        }
      });
  };

  /*
   * =====================================================
   * CHARGEMENT
   * =====================================================
   */

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="rounded-3xl bg-white px-8 py-7 text-center shadow-xl dark:bg-slate-900">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

          <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
            Chargement de
            l&apos;application...
          </p>
        </div>
      </main>
    );
  }

  /*
   * =====================================================
   * PAGE
   * =====================================================
   */

  return (
    <main className="min-h-screen bg-slate-100 pb-28 text-slate-950 dark:bg-slate-950 dark:text-white lg:pb-10">
      <DashboardHeader
        profile={profile}
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <WelcomeSection
          profile={profile}
        />

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

                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Pense à vérifier ton
                  ARI avant la garde.
                </p>
              </div>

              <span className="text-3xl text-red-600">
                ›
              </span>
            </Link>

            <QuickAccess
              items={quickAccessItems}
            />

            <UpcomingEvents
              events={upcomingEvents}
            />
          </div>

          <aside className="space-y-6">
            <NextDuty />

            <Link
              href="/dashboard/notifications"
              className="flex items-center gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 transition hover:shadow-md active:scale-[0.99] dark:border-amber-900 dark:bg-amber-950/30"
            >
              <div className="text-3xl">
                ⚠️
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-extrabold">
                  Pense-bête
                </p>

                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  N&apos;oublie pas ta
                  tenue de sport pour
                  l&apos;entraînement.
                </p>
              </div>

              <span className="text-3xl">
                ›
              </span>
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
                  {profile?.role ||
                    "Utilisateur"}
                </p>

                {profile?.grade && (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
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
                  <p className="pt-1 text-sm text-slate-500">
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

                  <span>
                    Gestion des utilisateurs
                  </span>
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
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-red-600"
          >
            <span className="text-2xl">
              🏠
            </span>

            <span className="text-xs font-bold">
              Accueil
            </span>
          </Link>

          <Link
            href="/dashboard/materiel"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">
              🧰
            </span>

            <span className="text-xs font-semibold">
              Matériel
            </span>
          </Link>

          <Link
            href="/dashboard/planning"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">
              📅
            </span>

            <span className="text-xs font-semibold">
              Planning
            </span>
          </Link>

          <Link
            href="/dashboard/messages"
            className="relative flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">
              💬
            </span>

            <span className="absolute right-[25%] top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              1
            </span>

            <span className="text-xs font-semibold">
              Messages
            </span>
          </Link>

          <Link
            href="/dashboard/plus"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">
              ☰
            </span>

            <span className="text-xs font-semibold">
              Plus
            </span>
          </Link>
        </div>
      </nav>
    </main>
  );
}