"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ambulance,
  Backpack,
  BellRing,
  CalendarDays,
  CalendarClock,
  ClipboardCheck,
  FileText,
  FolderOpen,
  House,
  Menu,
  Newspaper,
  Package,
  Settings,
  Tags,
  TriangleAlert,
  Truck,
  Users,
  Pill,
  X,
  type LucideIcon,
} from "lucide-react";

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

function SidebarSection({
  title,
  open,
  children,
}: {
  title: string;
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      {open && (
        <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </p>
      )}
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function SidebarItem({
  href,
  icon,
  label,
  open,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  open: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      title={!open ? label : undefined}
      className={`relative flex min-h-11 items-center rounded-xl text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-muted-foreground dark:hover:bg-slate-900 dark:hover:text-white ${
        open ? "gap-3 px-3" : "justify-center px-2"
      }`}
    >
      {(() => {
        const Icon = icon;

        return (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-slate-600 shadow-sm  dark:text-muted-foreground">
            <Icon
              size={18}
              strokeWidth={1.9}
            />
          </span>
        );
      })()}

      {open && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {badge && (
        <span
          className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ${
            open ? "" : "absolute right-1 top-1"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function MobileMoreLink({
  href,
  icon,
  label,
  badge,
  emphasized = false,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: string;
  emphasized?: boolean;
  onNavigate: () => void;
}) {
  const Icon = icon;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 transition active:scale-[0.99] ${
        emphasized
          ? "border-red-400 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          : "border-border bg-background text-foreground hover:bg-surface-soft"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          emphasized
            ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
            : "bg-surface-strong text-muted-foreground"
        }`}
      >
        <Icon
          size={19}
          strokeWidth={1.9}
        />
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-black">
        {label}
      </span>

      {badge && (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-black text-white">
          {badge}
        </span>
      )}

      <span className="text-lg text-muted-foreground">
        ›
      </span>
    </Link>
  );
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

  const [businessRoleCodes, setBusinessRoleCodes] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

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

      setBusinessRoleCodes(businessRoleCodes);

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
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-3xl border border-border bg-card px-8 py-7 text-center shadow-xl">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

          <p className="mt-4 font-semibold text-foreground">
            Chargement de
            l&apos;application...
          </p>
        </div>
      </main>
    );
  }

  const isAdmin =
    profile?.access_role === "admin";

  const isChefCentre =
    businessRoleCodes.includes("chef_centre");

  const isAdjointChefCentre =
    businessRoleCodes.includes(
      "adjoint_chef_centre"
    );

  const isFirefighter =
    businessRoleCodes.includes(
      "sapeur_pompier"
    );

  const isPharmacyManager =
    businessRoleCodes.includes(
      "responsable_pharmacie"
    );

  const canSeeSecourisme =
    isAdmin ||
    isChefCentre ||
    isAdjointChefCentre ||
    isFirefighter ||
    isPharmacyManager;

  const canSeePharmacyMenu =
    isAdmin || isPharmacyManager;

  /*
   * =====================================================
   * PAGE
   * =====================================================
   */

  return (
    <main className="app-page pb-28 lg:pb-10">
      <DashboardHeader
        profile={profile}
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
      />

      <aside
        className={`app-sidebar fixed bottom-0 left-0 top-[78px] z-40 hidden border-r bg-sidebar/95 backdrop-blur-xl transition-all duration-300 lg:block ${
          isSidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((value) => !value)}
            className="mb-4 flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-surface-soft font-bold text-slate-700 transition hover:bg-slate-100  dark:text-slate-200 dark:hover:bg-slate-800"
            title={isSidebarOpen ? "Réduire le menu" : "Ouvrir le menu"}
          >
            <Menu
              size={19}
              strokeWidth={2}
            />
            {isSidebarOpen && <span>Menu</span>}
          </button>

          <nav className="space-y-5">
            <SidebarSection title="Mon espace" open={isSidebarOpen}>
              <SidebarItem href="/dashboard" icon={House} label="Accueil" open={isSidebarOpen} />
              <SidebarItem href="/dashboard/materiel" icon={Package} label="Mon matériel" open={isSidebarOpen} />
              <SidebarItem href="/dashboard/sac" icon={Backpack} label="Mon sac" open={isSidebarOpen} />
              <SidebarItem href="/dashboard/verifications" icon={ClipboardCheck} label="Vérifications" open={isSidebarOpen} />
              <SidebarItem href="/dashboard/disponibilites" icon={CalendarDays} label="Disponibilités" open={isSidebarOpen} />
            </SidebarSection>

            <SidebarSection title="Vie de la caserne" open={isSidebarOpen}>
              <SidebarItem href="/dashboard/actualites" icon={Newspaper} label="Actualités" open={isSidebarOpen} badge="1" />
              <SidebarItem href="/dashboard/evenements-indesirables" icon={TriangleAlert} label="Événements indésirables" open={isSidebarOpen} />
              <SidebarItem href="/dashboard/documents" icon={FolderOpen} label="Documents" open={isSidebarOpen} />
              <SidebarItem href="/dashboard/annuaire" icon={Users} label="Annuaire" open={isSidebarOpen} />
              <SidebarItem href="/dashboard/planning" icon={CalendarDays} label="Planning" open={isSidebarOpen} />
            </SidebarSection>

            {canSeeSecourisme && (
              <SidebarSection
                title="Secourisme"
                open={isSidebarOpen}
              >
                <SidebarItem
                  href="/dashboard/secourisme"
                  icon={Ambulance}
                  label="Secourisme"
                  open={isSidebarOpen}
                />

                {canSeePharmacyMenu && (
                  <>
                    <SidebarItem
                      href="/dashboard/secourisme/alertes"
                      icon={BellRing}
                      label="Alertes"
                      open={isSidebarOpen}
                    />

                    <SidebarItem
                      href="/dashboard/secourisme/stock"
                      icon={Pill}
                      label="Stock pharmacie"
                      open={isSidebarOpen}
                    />

                    <SidebarItem
                      href="/dashboard/secourisme/peremptions"
                      icon={CalendarClock}
                      label="Péremptions"
                      open={isSidebarOpen}
                    />

                    <SidebarItem
                      href="/dashboard/secourisme/fournisseurs"
                      icon={Truck}
                      label="Fournisseurs"
                      open={isSidebarOpen}
                    />

                    <SidebarItem
                      href="/dashboard/secourisme/categories"
                      icon={Tags}
                      label="Catégories"
                      open={isSidebarOpen}
                    />
                  </>
                )}
              </SidebarSection>
            )}

            {canManageUsers && (
              <SidebarSection title="Administration" open={isSidebarOpen}>
                <SidebarItem href="/dashboard/admin" icon={Settings} label="Utilisateurs" open={isSidebarOpen} />
              </SidebarSection>
            )}
          </nav>

          {isSidebarOpen && (
            <div className="mt-auto pt-5">
              <div className="rounded-2xl border border-border bg-surface-soft p-3 ">
                <p className="truncate text-sm font-extrabold">
                  {profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Utilisateur"}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {managementLabel || profile?.grade || profile?.role || "Membre"}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div
        className={`mx-auto max-w-7xl px-4 py-6 transition-[padding] duration-300 sm:px-6 lg:py-8 ${
          isSidebarOpen ? "lg:pl-72 lg:pr-8" : "lg:pl-28 lg:pr-8"
        }`}
      >
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

                <p className="mt-1 text-sm text-muted-foreground">
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

                <p className="mt-1 text-sm text-muted-foreground">
                  N&apos;oublie pas ta
                  tenue de sport pour
                  l&apos;entraînement.
                </p>
              </div>

              <span className="text-3xl">
                ›
              </span>
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
                  {profile?.role ||
                    "Utilisateur"}
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

      {isMobileMoreOpen && (
        <div
          className="fixed inset-0 z-[70] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu Plus"
        >
          <button
            type="button"
            onClick={() =>
              setIsMobileMoreOpen(false)
            }
            className="absolute inset-0 bg-black/60"
            aria-label="Fermer le menu"
          />

          <section className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur-xl">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">
                  Navigation
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Plus
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsMobileMoreOpen(false)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-soft text-foreground"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <section>
                <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  Mon espace
                </p>

                <div className="grid gap-2">
                  <MobileMoreLink
                    href="/dashboard/sac"
                    icon={Backpack}
                    label="Mon sac"
                    onNavigate={() =>
                      setIsMobileMoreOpen(false)
                    }
                  />

                  <MobileMoreLink
                    href="/dashboard/verifications"
                    icon={ClipboardCheck}
                    label="Vérifications"
                    onNavigate={() =>
                      setIsMobileMoreOpen(false)
                    }
                  />

                  <MobileMoreLink
                    href="/dashboard/disponibilites"
                    icon={CalendarDays}
                    label="Disponibilités"
                    onNavigate={() =>
                      setIsMobileMoreOpen(false)
                    }
                  />
                </div>
              </section>

              <section>
                <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  Vie de la caserne
                </p>

                <div className="grid gap-2">
                  <MobileMoreLink
                    href="/dashboard/actualites"
                    icon={Newspaper}
                    label="Actualités"
                    badge="1"
                    onNavigate={() =>
                      setIsMobileMoreOpen(false)
                    }
                  />

                  <MobileMoreLink
                    href="/dashboard/evenements-indesirables"
                    icon={TriangleAlert}
                    label="Événements indésirables"
                    onNavigate={() =>
                      setIsMobileMoreOpen(false)
                    }
                  />

                  <MobileMoreLink
                    href="/dashboard/documents"
                    icon={FolderOpen}
                    label="Documents"
                    onNavigate={() =>
                      setIsMobileMoreOpen(false)
                    }
                  />

                  <MobileMoreLink
                    href="/dashboard/annuaire"
                    icon={Users}
                    label="Annuaire"
                    onNavigate={() =>
                      setIsMobileMoreOpen(false)
                    }
                  />
                </div>
              </section>

              {canSeeSecourisme && (
                <section>
                  <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-500">
                    Secourisme
                  </p>

                  <div className="grid gap-2">
                    <MobileMoreLink
                      href="/dashboard/secourisme"
                      icon={Ambulance}
                      label="Accueil Secourisme"
                      emphasized
                      onNavigate={() =>
                        setIsMobileMoreOpen(false)
                      }
                    />

                    {canSeePharmacyMenu && (
                      <>
                        <MobileMoreLink
                          href="/dashboard/secourisme/alertes"
                          icon={BellRing}
                          label="Alertes pharmacie"
                          onNavigate={() =>
                            setIsMobileMoreOpen(false)
                          }
                        />

                        <MobileMoreLink
                          href="/dashboard/secourisme/stock"
                          icon={Pill}
                          label="Stock pharmacie"
                          onNavigate={() =>
                            setIsMobileMoreOpen(false)
                          }
                        />

                        <MobileMoreLink
                          href="/dashboard/secourisme/peremptions"
                          icon={CalendarClock}
                          label="Péremptions"
                          onNavigate={() =>
                            setIsMobileMoreOpen(false)
                          }
                        />

                        <MobileMoreLink
                          href="/dashboard/secourisme/fournisseurs"
                          icon={Truck}
                          label="Fournisseurs"
                          onNavigate={() =>
                            setIsMobileMoreOpen(false)
                          }
                        />

                        <MobileMoreLink
                          href="/dashboard/secourisme/categories"
                          icon={Tags}
                          label="Catégories"
                          onNavigate={() =>
                            setIsMobileMoreOpen(false)
                          }
                        />
                      </>
                    )}
                  </div>
                </section>
              )}

              {canManageUsers && (
                <section>
                  <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Administration
                  </p>

                  <div className="grid gap-2">
                    <MobileMoreLink
                      href="/dashboard/admin"
                      icon={Settings}
                      label="Gestion des utilisateurs"
                      onNavigate={() =>
                        setIsMobileMoreOpen(false)
                      }
                    />
                  </div>
                </section>
              )}
            </div>
          </section>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border bg-sidebar/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl  lg:hidden">
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
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-muted-foreground"
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
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-muted-foreground"
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
            className="relative flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-muted-foreground"
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

          <button
            type="button"
            onClick={() =>
              setIsMobileMoreOpen(true)
            }
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-muted-foreground"
          >
            <span className="text-2xl">
              ☰
            </span>

            <span className="text-xs font-semibold">
              Plus
            </span>
          </button>
        </div>
      </nav>
    </main>
  );
}