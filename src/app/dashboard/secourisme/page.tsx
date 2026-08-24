"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,

  BarChart3,
  BellRing,
  Boxes,
  CalendarCheck2,
  CalendarClock,

  ChevronRight,
  ClipboardCheck,
  Eye,

  Package,
  Pill,
  RotateCcw,
  ShieldCheck,
  Tags,
  Truck,
  Users,

  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  access_role: string | null;
};

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

type SecourismeAccessLevel =
  | "admin"
  | "pharmacy_manager"
  | "supervisor"
  | "firefighter"
  | "none";

type RescueBagStatus =
  | "to_check"
  | "checked"
  | "checked_with_issue";

type RescueBag = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  status: RescueBagStatus;
  checked: boolean;
  latestCheck: {
    id: string;
    rawStatus: string;
    checkedAt: string;
    checkedBy: string | null;
    checkedByName: string | null;
    notes: string | null;
  } | null;
};

type RescueBagsResponse = {
  cycle: {
    timeZone: string;
    startsAt: string;
    endsAt: string;
    resetRule: string;
  };
  summary: {
    total: number;
    checked: number;
    checkedWithIssue: number;
    toCheck: number;
  };
  bags: RescueBag[];
};

const SECOURISME_ACCESS_ROLES = [
  "sapeur_pompier",
  "chef_centre",
  "adjoint_chef_centre",
  "responsable_pharmacie",
] as const;

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

function getAccessLevel(
  profile: Profile | null,
  businessRoleCodes: string[]
): SecourismeAccessLevel {
  if (profile?.access_role === "admin") {
    return "admin";
  }

  if (
    businessRoleCodes.includes(
      "responsable_pharmacie"
    )
  ) {
    return "pharmacy_manager";
  }

  if (
    businessRoleCodes.includes("chef_centre") ||
    businessRoleCodes.includes(
      "adjoint_chef_centre"
    )
  ) {
    return "supervisor";
  }

  if (
    businessRoleCodes.includes("sapeur_pompier")
  ) {
    return "firefighter";
  }

  return "none";
}

export default function SecourismePage() {
  const router = useRouter();

  const [isLoading, setIsLoading] =
    useState(true);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [
    businessRoleCodes,
    setBusinessRoleCodes,
  ] = useState<string[]>([]);
const [errorMessage, setErrorMessage] =
    useState("");

  const [bags, setBags] =
    useState<RescueBag[]>([]);

  const [bagsSummary, setBagsSummary] =
    useState<RescueBagsResponse["summary"]>({
      total: 0,
      checked: 0,
      checkedWithIssue: 0,
      toCheck: 0,
    });

  const [bagsError, setBagsError] =
    useState("");

  const [
    isRestockChooserOpen,
    setIsRestockChooserOpen,
  ] = useState(false);

  useEffect(() => {
    const loadAccess = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          router.replace("/");
          return;
        }

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(`
            id,
            first_name,
            last_name,
            access_role
          `)
          .eq("id", session.user.id)
          .single();

        if (profileError || !profileData) {
          throw new Error(
            "Impossible de récupérer votre profil."
          );
        }

        const {
          data: assignmentsData,
          error: assignmentsError,
        } = await supabase
          .from("profile_business_roles")
          .select(`
            business_roles!inner (
              code
            )
          `)
          .eq("profile_id", session.user.id);

        if (assignmentsError) {
          throw new Error(
            "Impossible de récupérer vos rôles métier."
          );
        }

        const codes = (
          (assignmentsData ??
            []) as BusinessRoleAssignment[]
        )
          .map(getBusinessRoleCode)
          .filter(
            (code): code is string =>
              Boolean(code)
          )
          .map((code) =>
            code.trim().toLowerCase()
          );

        setProfile(profileData as Profile);
        setBusinessRoleCodes(codes);

        const hasSecourismeAccess =
          (profileData as Profile).access_role === "admin" ||
          codes.some((code) =>
            SECOURISME_ACCESS_ROLES.includes(
              code as (typeof SECOURISME_ACCESS_ROLES)[number]
            )
          );

        if (hasSecourismeAccess) {
          const bagsResponse = await fetch(
            "/api/secourisme/sacs",
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
              cache: "no-store",
            }
          );

          const bagsResult =
            (await bagsResponse.json()) as
              | RescueBagsResponse
              | { error?: string };

          if (!bagsResponse.ok) {
            const apiError =
              "error" in bagsResult
                ? bagsResult.error
                : undefined;

            setBagsError(
              apiError ||
                "Impossible de récupérer l'état des sacs."
            );
          } else {
            const data =
              bagsResult as RescueBagsResponse;

            setBags(data.bags ?? []);
            setBagsSummary(
              data.summary ?? {
                total: 0,
                checked: 0,
                checkedWithIssue: 0,
                toCheck: 0,
              }
            );
            setBagsError("");
          }
        }
      } catch (error) {
        console.error(
          "Erreur accès Secourisme :",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadAccess();
  }, [router]);

  const accessLevel = useMemo(
    () =>
      getAccessLevel(
        profile,
        businessRoleCodes
      ),
    [profile, businessRoleCodes]
  );

  const canAccess =
    accessLevel !== "none";

  const canManagePharmacy =
    accessLevel === "admin" ||
    accessLevel === "pharmacy_manager";

  const isSupervisor =
    accessLevel === "supervisor";

  const isFirefighter =
    accessLevel === "firefighter";

  const canViewBagAnalytics =
    accessLevel === "admin" ||
    accessLevel === "pharmacy_manager" ||
    accessLevel === "supervisor";

  const accessLabel = useMemo(() => {
    switch (accessLevel) {
      case "admin":
        return "Administrateur";

      case "pharmacy_manager":
        return "Responsable pharmacie";

      case "supervisor":
        return "Droit de regard";

      case "firefighter":
        return "Sapeur-pompier";

      default:
        return "Accès non autorisé";
    }
  }, [accessLevel]);

  if (isLoading) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />

          <p className="mt-4 text-sm text-muted-foreground">
            Chargement du module Secourisme...
          </p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border border-red-400 bg-red-100 p-6 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-black">
            Impossible d&apos;ouvrir le module
            Secourisme
          </p>

          <p className="mt-2 text-sm">
            {errorMessage}
          </p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-7 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-strong text-muted-foreground">
            <ShieldCheck size={28} />
          </div>

          <h1 className="mt-5 text-2xl font-black">
            Accès Secourisme non autorisé
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Aucun de vos rôles actuels ne donne
            accès au module Secourisme.
          </p>

          <Link
            href="/dashboard"
            className="app-button-secondary mt-6 inline-flex rounded-xl px-4 py-3 text-sm font-bold"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
<main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
<header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-red-500">
                Secourisme
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                Accueil Secourisme
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Bonjour{" "}
                {profile?.first_name ??
                  "utilisateur"}
                . Cette page s&apos;adapte à
                vos droits dans le module.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-bold">
              {isSupervisor ? (
                <Eye size={16} />
              ) : (
                <ShieldCheck size={16} />
              )}

              {accessLabel}
            </div>
          </header>

          {canManagePharmacy && (
            <section className="mt-8">
              <SectionHeading
                title="Pharmacie"
                description="Gestion opérationnelle du stock et de son suivi."
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <DashboardCard
                  href="/dashboard/secourisme/alertes"
                  icon={BellRing}
                  title="Alertes"
                  description="Ruptures, stocks faibles et péremptions à surveiller."
                />

                <DashboardCard
                  href="/dashboard/secourisme/stock"
                  icon={Pill}
                  title="Stock pharmacie"
                  description="Articles, quantités, entrées, sorties et lots."
                />

                <DashboardCard
                  href="/dashboard/secourisme/peremptions"
                  icon={CalendarClock}
                  title="Péremptions"
                  description="Suivi global des lots et des échéances."
                />

                <DashboardCard
                  href="/dashboard/secourisme/mouvements"
                  icon={Package}
                  title="Mouvements"
                  description="Historique global des mouvements de stock."
                />

                <DashboardCard
                  href="/dashboard/secourisme/fournisseurs"
                  icon={Truck}
                  title="Fournisseurs"
                  description="Fournisseurs et références associées."
                />

                <DashboardCard
                  href="/dashboard/secourisme/categories"
                  icon={Tags}
                  title="Catégories"
                  description="Organisation des articles du stock."
                />
              </div>
            </section>
          )}

          {!isSupervisor && (
            <section className="mt-8">
              <SectionHeading
                title="Après intervention"
                description="Remise en condition rapide d'un sac après son utilisation."
              />

              <button
                type="button"
                onClick={() =>
                  setIsRestockChooserOpen(true)
                }
                className="group mt-5 flex w-full flex-col gap-4 rounded-3xl border border-blue-300 bg-blue-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-md dark:border-blue-900 dark:bg-blue-950/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-200 dark:bg-blue-950/70 dark:text-blue-300">
                    <RotateCcw size={20} />
                  </div>

                  <div>
                    <h3 className="font-black">
                      Réarmer un sac
                    </h3>

                    <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                      Après une intervention, sélectionnez le sac utilisé et remettez uniquement les consommables nécessaires.
                    </p>
                  </div>
                </div>

                <span className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300">
                  Choisir le sac
                  <ChevronRight size={18} />
                </span>
              </button>
            </section>
          )}

          <section className="mt-8">
            <SectionHeading
              title={
                isSupervisor
                  ? "Droit de regard — contrôles des sacs"
                  : "Contrôles des sacs"
              }
              description={
                isSupervisor
                  ? "Vue de supervision uniquement. Aucune action de gestion n'est disponible depuis ce profil."
                  : "État des trois sacs pour le contrôle hebdomadaire du lundi soir."
              }
            />

            <div className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Contrôle hebdomadaire du lundi soir
                  </p>

                  <h3 className="mt-2 text-xl font-black">
                    État des 3 sacs
                  </h3>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Chaque lundi à 12h00, les sacs repassent à
                    « À vérifier » pour préparer le contrôle du soir.
                  </p>
                </div>

                <div className="rounded-full border border-amber-400 bg-amber-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  Semaine en cours
                </div>
              </div>

              {bagsError ? (
                <div className="mt-6 rounded-2xl border border-red-300 bg-red-100 px-4 py-4 text-sm font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {bagsError}
                </div>
              ) : bags.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-border bg-surface-strong px-4 py-5 text-sm text-muted-foreground">
                  Aucun sac actif n&apos;a été trouvé.
                </div>
              ) : (
                <div className="mt-6 overflow-hidden rounded-2xl border border-border">
                  {bags.map((bag, index) => (
                    <BagStatusRow
                      key={bag.id}
                      code={bag.code}
                      name={bag.name}
                      status={bag.status}
                      latestCheck={bag.latestCheck}
                      last={index === bags.length - 1}
                      canOpen={!isSupervisor}
                    />
                  ))}
                </div>
              )}

              {isSupervisor && (
                <div className="mt-5 rounded-2xl border border-blue-300 bg-blue-100 px-4 py-3 text-sm font-semibold text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                  Droit de regard uniquement : vous pouvez consulter l'état des sacs,
                  sans action de gestion.
                </div>
              )}

              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Les statuts correspondent aux contrôles enregistrés depuis le dernier lundi à 12h00.
              </p>
            </div>

            {isSupervisor && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatusCard
                  icon={ClipboardCheck}
                  label="Contrôlés cette semaine"
                  value={String(
                    bagsSummary.checked +
                      bagsSummary.checkedWithIssue
                  )}
                  description="Sacs ayant un contrôle enregistré sur le cycle en cours."
                  tone="ok"
                />

                <StatusCard
                  icon={CalendarCheck2}
                  label="À contrôler"
                  value={String(bagsSummary.toCheck)}
                  description="Sacs n'ayant pas encore leur contrôle hebdomadaire."
                  tone="warning"
                />

                <StatusCard
                  icon={AlertTriangle}
                  label="Anomalies"
                  value={String(
                    bagsSummary.checkedWithIssue
                  )}
                  description="Contrôles ayant fait remonter une anomalie."
                  tone="danger"
                />
              </div>
            )}

            {canViewBagAnalytics && (
              <div className="mt-5">
                <Link
                  href="/dashboard/secourisme/sacs/historique"
                  className="group flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-400 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-strong text-foreground transition group-hover:bg-red-100 group-hover:text-red-700 dark:group-hover:bg-red-950/60 dark:group-hover:text-red-300">
                      <BarChart3 size={20} />
                    </div>

                    <div>
                      <h3 className="font-black">
                        Historique & statistiques des contrôles
                      </h3>

                      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                        Consultez les vérifications complètes, les anomalies, les remplacements,
                        les statistiques par sac et par contrôleur, avec export Excel.
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-red-600 dark:text-red-400">
                    Ouvrir
                    <ChevronRight size={18} />
                  </span>
                </Link>
              </div>
            )}
          </section>

          {accessLevel === "admin" && (
            <section className="mt-8">
              <SectionHeading
                title="Administration Secourisme"
                description="Vue complète du module et de ses composants."
              />

              <div className="mt-5 rounded-3xl border border-border bg-card p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-strong text-foreground">
                    <Users size={20} />
                  </div>

                  <div>
                    <h3 className="font-black">
                      Accès complet
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Le profil administrateur voit
                      l&apos;ensemble de la pharmacie
                      et du futur suivi des sacs.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>

      {isRestockChooserOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Choisir le sac à réarmer"
        >
          <div className="w-full max-w-xl rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-600 dark:text-blue-300">
                  Après intervention
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Quel sac voulez-vous réarmer ?
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Le numéro complet de l&apos;intervention vous sera demandé à l&apos;étape suivante.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsRestockChooserOpen(false)
                }
                className="app-button-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {bags.map((bag) => {
                const hrefByCode: Record<
                  string,
                  string
                > = {
                  ps_vpi:
                    "/dashboard/secourisme/sacs/psvpi?restock=1",
                  oxygenotherapie_vpi:
                    "/dashboard/secourisme/sacs/oxygenotherapie?restock=1",
                  oxy_vpi:
                    "/dashboard/secourisme/sacs/oxygenotherapie?restock=1",
                  ps_fpt:
                    "/dashboard/secourisme/sacs/psfpt?restock=1",
                };

                const href =
                  hrefByCode[bag.code];

                if (!href) {
                  return null;
                }

                return (
                  <Link
                    key={bag.id}
                    href={href}
                    onClick={() =>
                      setIsRestockChooserOpen(
                        false
                      )
                    }
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-4 transition hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                        <RotateCcw size={18} />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-black">
                          {bag.name}
                        </p>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Réarmement après intervention
                        </p>
                      </div>
                    </div>

                    <ChevronRight
                      size={18}
                      className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-blue-700"
                    />
                  </Link>
                );
              })}
            </div>

            {bags.length === 0 && (
              <div className="mt-6 rounded-2xl border border-border bg-surface-strong px-4 py-5 text-sm text-muted-foreground">
                Aucun sac actif n&apos;est disponible.
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setIsRestockChooserOpen(false)
              }
              className="app-button-secondary mt-5 min-h-11 w-full rounded-xl px-4 py-3 text-sm font-black"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-2xl font-black">
        {title}
      </h2>

      <p className="mt-1 text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function DashboardCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  const Icon = icon;

  return (
    <Link
      href={href}
      className="group rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-400 hover:shadow-md"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-strong text-foreground transition group-hover:bg-red-100 group-hover:text-red-700 dark:group-hover:bg-red-950/60 dark:group-hover:text-red-300">
        <Icon size={20} />
      </div>

      <h3 className="mt-4 text-lg font-black">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </Link>
  );
}

function BagStatusRow({
  code,
  name,
  status,
  latestCheck,
  last = false,
  canOpen = true,
}: {
  code: string;
  name: string;
  status: RescueBagStatus;
  latestCheck: RescueBag["latestCheck"];
  last?: boolean;
  canOpen?: boolean;
}) {
  const isChecked =
    status === "checked";

  const hasIssue =
    status === "checked_with_issue";

  const iconClass = isChecked
    ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
    : hasIssue
      ? "bg-orange-200 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300"
      : "bg-red-200 text-red-800 dark:bg-red-950/50 dark:text-red-300";

  const badgeClass = isChecked
    ? "border-emerald-400 bg-emerald-200 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
    : hasIssue
      ? "border-orange-400 bg-orange-200 text-orange-900 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300"
      : "border-red-400 bg-red-200 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300";

  const statusLabel = isChecked
    ? "Vérifié"
    : hasIssue
      ? "Vérifié — anomalie"
      : "À vérifier";

  const detail =
    latestCheck?.checkedByName
      ? `Contrôlé par ${latestCheck.checkedByName}`
      : latestCheck
        ? "Contrôle enregistré"
        : "Contrôle hebdomadaire";

  const hrefByCode: Record<string, string> = {
    ps_vpi: "/dashboard/secourisme/sacs/psvpi",
    oxygenotherapie_vpi:
      "/dashboard/secourisme/sacs/oxygenotherapie",
    ps_fpt: "/dashboard/secourisme/sacs/psfpt",
  };

  const href = hrefByCode[code];

  const rowContent = (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-4 sm:px-5 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          {hasIssue ? (
            <AlertTriangle size={18} />
          ) : (
            <ClipboardCheck size={18} />
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate font-black">
            {name}
          </p>

          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {detail}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`rounded-full border px-3 py-1.5 text-xs font-black ${badgeClass}`}
        >
          {statusLabel}
        </span>

        {canOpen && href && (
          <ChevronRight
            size={18}
            className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        )}
      </div>
    </div>
  );

  if (!canOpen || !href) {
    return rowContent;
  }

  return (
    <Link
      href={href}
      className="group block transition hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-inset"
      title={`Ouvrir le contrôle : ${name}`}
    >
      {rowContent}
    </Link>
  );
}

function StatusCard({
  icon,
  label,
  value,
  description,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  tone: "ok" | "warning" | "danger";
}) {
  const Icon = icon;

  const toneClass =
    tone === "ok"
      ? "border-emerald-400 bg-emerald-200 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
      : tone === "warning"
        ? "border-amber-400 bg-amber-200 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-red-400 bg-red-200 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl border ${toneClass}`}
      >
        <Icon size={20} />
      </div>

      <p className="mt-4 text-xs font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-3xl font-black">
        {value}
      </p>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
