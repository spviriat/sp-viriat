"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Ambulance,
  Backpack,
  BarChart3,
  BellRing,
  CalendarDays,
  CalendarClock,
  ClipboardCheck,
  FilePlus2,
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

type BusinessRoleAssignment = {
  business_roles:
    | { code: string }
    | { code: string }[]
    | null;
};

type ManagementLabel =
  | "Administrateur"
  | "Chef de centre"
  | "Adjoint chef de centre"
  | null;

type DashboardContextValue = {
  profile: Profile | null;
  canManageUsers: boolean;
  managementLabel: ManagementLabel;
  businessRoleCodes: string[];
  isAdmin: boolean;
  isChefCentre: boolean;
  isAdjointChefCentre: boolean;
  canSeeGuardMonitoring: boolean;
  canSeeSecourisme: boolean;
  canSeePharmacyMenu: boolean;
  isLoggingOut: boolean;
  handleLogout: () => void;
};

const DashboardContext =
  createContext<DashboardContextValue | null>(null);

export function useDashboardShell() {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error(
      "useDashboardShell doit être utilisé dans DashboardShell."
    );
  }

  return context;
}

const USER_MANAGEMENT_ROLES = [
  "chef_centre",
  "adjoint_chef_centre",
];

function getBusinessRoleCode(
  assignment: BusinessRoleAssignment
): string | null {
  if (!assignment.business_roles) return null;

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
  children: ReactNode;
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
  icon: Icon,
  label,
  open,
  badge,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  open: boolean;
  badge?: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      title={!open ? label : undefined}
      className={`relative flex min-h-11 items-center rounded-xl text-sm font-bold transition ${
        open ? "gap-3 px-3" : "justify-center px-2"
      } ${
        active
          ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-muted-foreground dark:hover:bg-slate-900 dark:hover:text-white"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
        <Icon size={18} strokeWidth={1.9} />
      </span>

      {open && (
        <span className="min-w-0 flex-1 truncate">
          {label}
        </span>
      )}

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
  icon: Icon,
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
        <Icon size={19} strokeWidth={1.9} />
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-black">
        {label}
      </span>

      {badge && (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-black text-white">
          {badge}
        </span>
      )}

      <span className="text-lg text-muted-foreground">›</span>
    </Link>
  );
}

export default function DashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [isCheckingSession, setIsCheckingSession] =
    useState(true);
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [canManageUsers, setCanManageUsers] =
    useState(false);
  const [managementLabel, setManagementLabel] =
    useState<ManagementLabel>(null);
  const [businessRoleCodes, setBusinessRoleCodes] =
    useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] =
    useState(true);
  const [isMobileMoreOpen, setIsMobileMoreOpen] =
    useState(false);

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
            status,
            access_status
          `)
          .eq("id", session.user.id)
          .single();

      if (profileError || !profileData) {
        console.error(
          "Erreur lors de la récupération du profil :",
          profileError
        );
        await supabase.auth.signOut({ scope: "local" });
        router.replace("/");
        return;
      }

      if (profileData.status === "temporary_password") {
        router.replace("/auth/complete-profile");
        return;
      }

      if (
        profileData.access_status === "suspended" ||
        profileData.access_status === "archived"
      ) {
        await supabase.auth.signOut({ scope: "local" });

        const reason =
          profileData.access_status === "archived"
            ? "archived"
            : "suspended";

        router.replace(`/?access=${reason}`);
        return;
      }

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
        .eq("profile_id", session.user.id);

      if (businessRoleError) {
        console.error(
          "Erreur lors de la récupération des rôles métier :",
          businessRoleError
        );
      }

      const roleCodes = (
        (businessRoleAssignments ??
          []) as BusinessRoleAssignment[]
      )
        .map(getBusinessRoleCode)
        .filter(
          (code): code is string => Boolean(code)
        );

      setBusinessRoleCodes(roleCodes);

      const isAdmin =
        profileData.access_role === "admin";
      const isChefCentre =
        roleCodes.includes("chef_centre");
      const isAdjointChefCentre =
        roleCodes.includes("adjoint_chef_centre");
      const hasManagementRole = roleCodes.some(
        (code) => USER_MANAGEMENT_ROLES.includes(code)
      );

      setCanManageUsers(
        isAdmin || hasManagementRole
      );

      if (isAdmin) {
        setManagementLabel("Administrateur");
      } else if (isChefCentre) {
        setManagementLabel("Chef de centre");
      } else if (isAdjointChefCentre) {
        setManagementLabel("Adjoint chef de centre");
      } else {
        setManagementLabel(null);
      }

      setProfile(profileData as Profile);
      setIsCheckingSession(false);
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) router.replace("/");
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    setIsMobileMoreOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    router.replace("/");

    void supabase.auth
      .signOut({ scope: "local" })
      .then(({ error }) => {
        if (error) {
          console.error(
            "Erreur lors de la déconnexion :",
            error
          );
        }
      });
  };

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-3xl border border-border bg-card px-8 py-7 text-center shadow-xl">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />
          <p className="mt-4 font-semibold text-foreground">
            Chargement de l&apos;application...
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
  const canSeeGuardMonitoring =
    isAdmin ||
    isChefCentre ||
    isAdjointChefCentre;
  const isFirefighter =
    businessRoleCodes.includes("sapeur_pompier");
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

  const canCreateIntervention =
    isAdmin ||
    isChefCentre ||
    isAdjointChefCentre ||
    isFirefighter;

  const canSeeInterventionTracking =
    isAdmin ||
    isChefCentre ||
    isAdjointChefCentre;

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname === href ||
        pathname.startsWith(`${href}/`);

  const contextValue: DashboardContextValue = {
    profile,
    canManageUsers,
    managementLabel,
    businessRoleCodes,
    isAdmin,
    isChefCentre,
    isAdjointChefCentre,
    canSeeGuardMonitoring,
    canSeeSecourisme,
    canSeePharmacyMenu,
    isLoggingOut,
    handleLogout,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="app-page min-h-screen pb-28 lg:pb-10">
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
              onClick={() =>
                setIsSidebarOpen((value) => !value)
              }
              className="mb-4 flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-surface-soft font-bold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              title={
                isSidebarOpen
                  ? "Réduire le menu"
                  : "Ouvrir le menu"
              }
            >
              <Menu size={19} strokeWidth={2} />
              {isSidebarOpen && <span>Menu</span>}
            </button>

            <nav className="space-y-5">
              <SidebarSection
                title="Mon espace"
                open={isSidebarOpen}
              >
                <SidebarItem href="/dashboard" icon={House} label="Accueil" open={isSidebarOpen} active={isActive("/dashboard")} />
                <SidebarItem href="/dashboard/materiel" icon={Package} label="Mon matériel" open={isSidebarOpen} active={isActive("/dashboard/materiel")} />
                <SidebarItem href="/dashboard/sac" icon={Backpack} label="Mon sac" open={isSidebarOpen} active={isActive("/dashboard/sac")} />
                <SidebarItem href="/dashboard/verifications" icon={ClipboardCheck} label="Vérifications" open={isSidebarOpen} active={isActive("/dashboard/verifications")} />
                <SidebarItem href="/dashboard/disponibilites" icon={CalendarDays} label="Disponibilités" open={isSidebarOpen} active={pathname === "/dashboard/disponibilites"} />

                {canSeeGuardMonitoring && (
                  <SidebarItem
                    href="/dashboard/disponibilites/suivi"
                    icon={BarChart3}
                    label="Suivi des gardes"
                    open={isSidebarOpen}
                    active={isActive("/dashboard/disponibilites/suivi")}
                  />
                )}
              </SidebarSection>

              <SidebarSection
                title="Interventions"
                open={isSidebarOpen}
              >
                <SidebarItem
                  href="/dashboard/interventions"
                  icon={Truck}
                  label="Interventions"
                  open={isSidebarOpen}
                  active={pathname === "/dashboard/interventions"}
                />

                {canCreateIntervention && (
                  <SidebarItem
                    href="/dashboard/interventions/nouvelle"
                    icon={FilePlus2}
                    label="Créer une intervention"
                    open={isSidebarOpen}
                    active={isActive("/dashboard/interventions/nouvelle")}
                  />
                )}

                {canSeeInterventionTracking && (
                  <SidebarItem
                    href="/dashboard/interventions/suivi"
                    icon={BarChart3}
                    label="Suivi des interventions"
                    open={isSidebarOpen}
                    active={isActive("/dashboard/interventions/suivi")}
                  />
                )}
              </SidebarSection>

              <SidebarSection
                title="Vie de la caserne"
                open={isSidebarOpen}
              >
                <SidebarItem href="/dashboard/actualites" icon={Newspaper} label="Actualités" open={isSidebarOpen} badge="1" active={isActive("/dashboard/actualites")} />
                <SidebarItem href="/dashboard/evenements-indesirables" icon={TriangleAlert} label="Événements indésirables" open={isSidebarOpen} active={isActive("/dashboard/evenements-indesirables")} />
                <SidebarItem href="/dashboard/documents" icon={FolderOpen} label="Documents" open={isSidebarOpen} active={isActive("/dashboard/documents")} />
                <SidebarItem href="/dashboard/annuaire" icon={Users} label="Annuaire" open={isSidebarOpen} active={isActive("/dashboard/annuaire")} />
                <SidebarItem href="/dashboard/planning" icon={CalendarDays} label="Planning" open={isSidebarOpen} active={isActive("/dashboard/planning")} />
              </SidebarSection>

              {canSeeSecourisme && (
                <SidebarSection
                  title="Secourisme"
                  open={isSidebarOpen}
                >
                  <SidebarItem href="/dashboard/secourisme" icon={Ambulance} label="Secourisme" open={isSidebarOpen} active={pathname === "/dashboard/secourisme"} />

                  {canSeePharmacyMenu && (
                    <>
                      <SidebarItem href="/dashboard/secourisme/alertes" icon={BellRing} label="Alertes" open={isSidebarOpen} active={isActive("/dashboard/secourisme/alertes")} />
                      <SidebarItem href="/dashboard/secourisme/stock" icon={Pill} label="Stock pharmacie" open={isSidebarOpen} active={isActive("/dashboard/secourisme/stock")} />
                      <SidebarItem href="/dashboard/secourisme/peremptions" icon={CalendarClock} label="Péremptions" open={isSidebarOpen} active={isActive("/dashboard/secourisme/peremptions")} />
                      <SidebarItem href="/dashboard/secourisme/fournisseurs" icon={Truck} label="Fournisseurs" open={isSidebarOpen} active={isActive("/dashboard/secourisme/fournisseurs")} />
                      <SidebarItem href="/dashboard/secourisme/categories" icon={Tags} label="Catégories" open={isSidebarOpen} active={isActive("/dashboard/secourisme/categories")} />
                    </>
                  )}
                </SidebarSection>
              )}

              {canManageUsers && (
                <SidebarSection
                  title="Administration"
                  open={isSidebarOpen}
                >
                  <SidebarItem
                    href="/dashboard/admin"
                    icon={Settings}
                    label="Utilisateurs"
                    open={isSidebarOpen}
                    active={isActive("/dashboard/admin")}
                  />
                </SidebarSection>
              )}
            </nav>

            {isSidebarOpen && (
              <div className="mt-auto pt-5">
                <div className="rounded-2xl border border-border bg-surface-soft p-3">
                  <p className="truncate text-sm font-extrabold">
                    {profile
                      ? `${profile.first_name} ${profile.last_name}`.trim()
                      : "Utilisateur"}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {managementLabel ||
                      profile?.grade ||
                      profile?.role ||
                      "Membre"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        <div
          className={`transition-[padding] duration-300 ${
            isSidebarOpen
              ? "lg:pl-64"
              : "lg:pl-20"
          }`}
        >
          {children}
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
                    <MobileMoreLink href="/dashboard/sac" icon={Backpack} label="Mon sac" onNavigate={() => setIsMobileMoreOpen(false)} />
                    <MobileMoreLink href="/dashboard/verifications" icon={ClipboardCheck} label="Vérifications" onNavigate={() => setIsMobileMoreOpen(false)} />
                    <MobileMoreLink href="/dashboard/disponibilites" icon={CalendarDays} label="Disponibilités" onNavigate={() => setIsMobileMoreOpen(false)} />

                    {canSeeGuardMonitoring && (
                      <MobileMoreLink
                        href="/dashboard/disponibilites/suivi"
                        icon={BarChart3}
                        label="Suivi des gardes"
                        onNavigate={() =>
                          setIsMobileMoreOpen(false)
                        }
                      />
                    )}
                  </div>
                </section>

                <section>
                  <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-500">
                    Interventions
                  </p>

                  <div className="grid gap-2">
                    <MobileMoreLink
                      href="/dashboard/interventions"
                      icon={Truck}
                      label="Interventions"
                      emphasized
                      onNavigate={() => setIsMobileMoreOpen(false)}
                    />

                    {canCreateIntervention && (
                      <MobileMoreLink
                        href="/dashboard/interventions/nouvelle"
                        icon={FilePlus2}
                        label="Créer une intervention"
                        onNavigate={() => setIsMobileMoreOpen(false)}
                      />
                    )}

                    {canSeeInterventionTracking && (
                      <MobileMoreLink
                        href="/dashboard/interventions/suivi"
                        icon={BarChart3}
                        label="Suivi des interventions"
                        onNavigate={() => setIsMobileMoreOpen(false)}
                      />
                    )}
                  </div>
                </section>

                <section>
                  <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Vie de la caserne
                  </p>
                  <div className="grid gap-2">
                    <MobileMoreLink href="/dashboard/actualites" icon={Newspaper} label="Actualités" badge="1" onNavigate={() => setIsMobileMoreOpen(false)} />
                    <MobileMoreLink href="/dashboard/evenements-indesirables" icon={TriangleAlert} label="Événements indésirables" onNavigate={() => setIsMobileMoreOpen(false)} />
                    <MobileMoreLink href="/dashboard/documents" icon={FolderOpen} label="Documents" onNavigate={() => setIsMobileMoreOpen(false)} />
                    <MobileMoreLink href="/dashboard/annuaire" icon={Users} label="Annuaire" onNavigate={() => setIsMobileMoreOpen(false)} />
                    <MobileMoreLink href="/dashboard/planning" icon={CalendarDays} label="Planning" onNavigate={() => setIsMobileMoreOpen(false)} />
                  </div>
                </section>

                {canSeeSecourisme && (
                  <section>
                    <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-500">
                      Secourisme
                    </p>
                    <div className="grid gap-2">
                      <MobileMoreLink href="/dashboard/secourisme" icon={Ambulance} label="Accueil Secourisme" emphasized onNavigate={() => setIsMobileMoreOpen(false)} />

                      {canSeePharmacyMenu && (
                        <>
                          <MobileMoreLink href="/dashboard/secourisme/alertes" icon={BellRing} label="Alertes pharmacie" onNavigate={() => setIsMobileMoreOpen(false)} />
                          <MobileMoreLink href="/dashboard/secourisme/stock" icon={Pill} label="Stock pharmacie" onNavigate={() => setIsMobileMoreOpen(false)} />
                          <MobileMoreLink href="/dashboard/secourisme/peremptions" icon={CalendarClock} label="Péremptions" onNavigate={() => setIsMobileMoreOpen(false)} />
                          <MobileMoreLink href="/dashboard/secourisme/fournisseurs" icon={Truck} label="Fournisseurs" onNavigate={() => setIsMobileMoreOpen(false)} />
                          <MobileMoreLink href="/dashboard/secourisme/categories" icon={Tags} label="Catégories" onNavigate={() => setIsMobileMoreOpen(false)} />
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
                      <MobileMoreLink href="/dashboard/admin" icon={Settings} label="Gestion des utilisateurs" onNavigate={() => setIsMobileMoreOpen(false)} />
                    </div>
                  </section>
                )}
              </div>
            </section>
          </div>
        )}

        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border bg-sidebar/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
          <div className="mx-auto grid max-w-2xl grid-cols-5">
            <MobileBottomLink href="/dashboard" icon="🏠" label="Accueil" active={pathname === "/dashboard"} />
            <MobileBottomLink href="/dashboard/materiel" icon="🧰" label="Matériel" active={isActive("/dashboard/materiel")} />
            <MobileBottomLink href="/dashboard/disponibilites" icon="📅" label="Dispos" active={isActive("/dashboard/disponibilites")} />
            <MobileBottomLink href="/dashboard/messages" icon="💬" label="Messages" badge="1" active={isActive("/dashboard/messages")} />

            <button
              type="button"
              onClick={() =>
                setIsMobileMoreOpen(true)
              }
              className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-muted-foreground"
            >
              <span className="text-2xl">☰</span>
              <span className="text-xs font-semibold">
                Plus
              </span>
            </button>
          </div>
        </nav>
      </div>
    </DashboardContext.Provider>
  );
}

function MobileBottomLink({
  href,
  icon,
  label,
  badge,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  badge?: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex flex-col items-center gap-1 rounded-xl px-2 py-2 ${
        active
          ? "text-red-600"
          : "text-muted-foreground"
      }`}
    >
      <span className="text-2xl">{icon}</span>

      {badge && (
        <span className="absolute right-[25%] top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}

      <span
        className={`text-xs ${
          active ? "font-bold" : "font-semibold"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}