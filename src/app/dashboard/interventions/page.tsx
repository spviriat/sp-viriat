"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock3,
  FilePenLine,
  FileText,
  History,
  Plus,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type InterventionHistory = {
  id: string;
  date_intervention: string;
  heure_depart: string | null;
  motif: string | null;
};

type DraftIntervention = {
  id: string;
  date_intervention: string;
  heure_depart: string | null;
  sous_type: string | null;
  numero_interne: string | null;
  numero_codis: string | null;
  statut: string;
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  access_role?: string | null;
};

type BusinessRoleRow = {
  business_roles:
    | {
        code: string | null;
      }
    | {
        code: string | null;
      }[]
    | null;
};

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatTime(value: string | null) {
  if (!value) {
    return "Heure non renseignée";
  }

  return value.slice(0, 5).replace(":", "h");
}

function getBusinessRoleCodes(rows: BusinessRoleRow[]) {
  const codes: string[] = [];

  for (const row of rows) {
    const roles = row.business_roles;

    if (!roles) {
      continue;
    }

    if (Array.isArray(roles)) {
      for (const role of roles) {
        if (role.code) {
          codes.push(role.code);
        }
      }
    } else if (roles.code) {
      codes.push(roles.code);
    }
  }

  return codes;
}

/* =========================================================
   PAGE
========================================================= */

export default function InterventionsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);

  const [history, setHistory] = useState<InterventionHistory[]>([]);

  const [drafts, setDrafts] = useState<DraftIntervention[]>([]);

  const [isCommand, setIsCommand] = useState(false);
  const [canResetNumbering, setCanResetNumbering] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  /* =======================================================
     CHARGEMENT
  ======================================================= */

  const loadPage = useCallback(async () => {
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

      const profileResult = await supabase
        .from("profiles")
        .select("id, first_name, last_name, access_role")
        .eq("id", session.user.id)
        .single();

      if (profileResult.error || !profileResult.data) {
        throw new Error(
          "Impossible de récupérer votre profil."
        );
      }

      const currentProfile =
        profileResult.data as Profile;

      setProfile(currentProfile);

      /* ---------------------------------------------------
         RÔLES MÉTIER
      --------------------------------------------------- */

      const rolesResult = await supabase
        .from("profile_business_roles")
        .select(
          `
          business_roles (
            code
          )
        `
        )
        .eq("profile_id", session.user.id);

      const roleCodes = getBusinessRoleCodes(
        (rolesResult.data ?? []) as BusinessRoleRow[]
      );

      const admin =
        currentProfile.access_role === "admin";

      const command =
        admin ||
        roleCodes.includes("chef_centre") ||
        roleCodes.includes("adjoint_chef_centre");

      const resetAllowed =
        admin || roleCodes.includes("chef_centre");

      setIsCommand(command);
      setCanResetNumbering(resetAllowed);

      /* ---------------------------------------------------
         HISTORIQUE LIMITÉ
      --------------------------------------------------- */

      const historyResult = await supabase.rpc(
        "get_interventions_history"
      );

      if (historyResult.error) {
        throw new Error(
          historyResult.error.message ||
            "Impossible de charger l'historique."
        );
      }

      setHistory(
        (historyResult.data ?? []) as InterventionHistory[]
      );

      /* ---------------------------------------------------
         MES BROUILLONS
      --------------------------------------------------- */

      const draftsResult = await supabase
  .from("interventions")
  .select(
    `
    id,
    date_intervention,
    heure_depart,
    sous_type,
    numero_interne,
    numero_codis,
    statut
  `
  )
  .eq("created_by", session.user.id)
  .eq("statut", "brouillon")
  .order("date_intervention", {
    ascending: false,
  });

      if (draftsResult.error) {
        throw new Error(
          draftsResult.error.message ||
            "Impossible de charger vos brouillons."
        );
      }

      setDrafts(
        (draftsResult.data ?? []) as DraftIntervention[]
      );
    } catch (error) {
      console.error(
        "Erreur chargement interventions :",
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
  }, [router]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  /* =======================================================
     RESET NUMÉROTATION
  ======================================================= */

  const resetNumbering = async () => {
    if (!canResetNumbering) {
      return;
    }

    setIsResetting(true);
    setResetError("");
    setResetMessage("");

    try {
      const currentYear = new Date().getFullYear();

      const { data, error } = await supabase.rpc(
        "reset_intervention_numbering",
        {
          target_year: currentYear,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = Array.isArray(data)
        ? data[0]
        : data;

      const nextNumber =
        result?.next_number ?? "nouvelle série";

      setResetMessage(
        `Numérotation réinitialisée. Prochaine intervention : ${nextNumber}.`
      );

      setResetOpen(false);
    } catch (error) {
      console.error(
        "Erreur reset numérotation :",
        error
      );

      setResetError(
        error instanceof Error
          ? error.message
          : "Impossible de réinitialiser la numérotation."
      );
    } finally {
      setIsResetting(false);
    }
  };

  /* =======================================================
     CHARGEMENT
  ======================================================= */

  if (isLoading) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />

          <p className="mt-4 text-sm text-muted-foreground">
            Chargement des interventions...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     ERREUR
  ======================================================= */

  if (errorMessage) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border border-red-400 bg-red-100 p-6 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-black">
            Impossible d&apos;ouvrir les interventions
          </p>

          <p className="mt-2 text-sm">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={() => void loadPage()}
            className="mt-5 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     AFFICHAGE
  ======================================================= */

  return (
    <div className="app-page min-h-screen">
      <main className="mx-auto w-full max-w-7xl p-4 pb-24 sm:p-6 lg:p-8">
        {/* HEADER */}

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-red-500">
              Opérationnel
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Interventions
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Créez les fiches d&apos;intervention et
              consultez l&apos;historique opérationnel du
              centre.
            </p>
          </div>

          <Link
            href="/dashboard/interventions/nouvelle"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700"
          >
            <Plus size={19} />
            Nouvelle intervention
          </Link>
        </header>

        {/* CARTES RÉSUMÉ */}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            icon={FilePenLine}
            label="Mes brouillons"
            value={drafts.length}
            description="Fiches à terminer"
          />

          <SummaryCard
            icon={History}
            label="Historique"
            value={history.length}
            description="Interventions terminées"
          />

          <SummaryCard
            icon={ShieldCheck}
            label="Accès"
            value={isCommand ? "Commandement" : "Pompier"}
            description={
              isCommand
                ? "Accès aux fiches complètes"
                : "Historique limité"
            }
          />
        </section>

        {/* BROUILLONS */}

        <section className="mt-7 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-border p-5 sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                En cours
              </p>

              <h2 className="mt-1 text-xl font-black">
                Mes brouillons
              </h2>
            </div>

            <FilePenLine
              size={22}
              className="text-muted-foreground"
            />
          </div>

          {drafts.length === 0 ? (
            <div className="p-6 text-center sm:p-10">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-strong">
                <FileText size={22} />
              </div>

              <p className="mt-4 font-black">
                Aucun brouillon
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Vos fiches non terminées apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {drafts.map((draft) => (
                <Link
                  key={draft.id}
                  href={`/dashboard/interventions/${draft.id}`}
                  className="flex items-center gap-4 p-4 transition hover:bg-surface-strong sm:p-5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    <FilePenLine size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">
                      {draft.sous_type ||
                        "Intervention sans motif"}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-muted-foreground">
                      <span>
                        {formatDate(
                          draft.date_intervention
                        )}
                      </span>

                      <span>
                        {formatTime(
                          draft.heure_depart
                        )}
                      </span>

                      {draft.numero_codis && (
                        <span>
                          CODIS {draft.numero_codis}
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    size={18}
                    className="shrink-0 text-muted-foreground"
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* HISTORIQUE */}

        <section className="mt-7 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
              Archives
            </p>

            <h2 className="mt-1 text-xl font-black">
              Historique des interventions
            </h2>

            {!isCommand && (
              <p className="mt-2 text-sm text-muted-foreground">
                L&apos;historique affiche uniquement la
                date, l&apos;heure et le motif.
              </p>
            )}
          </div>

          {history.length === 0 ? (
            <div className="p-6 text-center sm:p-10">
              <CalendarDays
                size={28}
                className="mx-auto text-muted-foreground"
              />

              <p className="mt-3 font-black">
                Aucune intervention terminée
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {history.map((intervention) => {
                const content = (
                  <>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
                      <Clock3 size={19} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-black">
                        {intervention.motif ||
                          "Intervention"}
                      </p>

                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-muted-foreground">
                        <span>
                          {formatDate(
                            intervention.date_intervention
                          )}
                        </span>

                        <span>
                          {formatTime(
                            intervention.heure_depart
                          )}
                        </span>
                      </div>
                    </div>

                    {isCommand && (
                      <ArrowRight
                        size={18}
                        className="shrink-0 text-muted-foreground"
                      />
                    )}
                  </>
                );

                if (isCommand) {
                  return (
                    <Link
                      key={intervention.id}
                      href={`/dashboard/interventions/${intervention.id}`}
                      className="flex items-center gap-4 p-4 transition hover:bg-surface-strong sm:p-5"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={intervention.id}
                    className="flex items-center gap-4 p-4 sm:p-5"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* NUMÉROTATION */}

        {canResetNumbering && (
          <section className="mt-7 rounded-3xl border border-red-300 bg-card p-5 shadow-sm dark:border-red-950 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    size={18}
                    className="text-red-500"
                  />

                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                    Administration
                  </p>
                </div>

                <h2 className="mt-2 text-xl font-black">
                  Numérotation des interventions
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Démarrez une nouvelle série de numéros
                  sans modifier les interventions déjà
                  enregistrées.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResetError("");
                  setResetOpen(true);
                }}
                className="app-button-secondary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black"
              >
                <RotateCcw size={17} />
                Réinitialiser
              </button>
            </div>

            {resetMessage && (
              <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                {resetMessage}
              </div>
            )}
          </section>
        )}

        {/* UTILISATEUR */}

        {profile && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Connecté en tant que{" "}
            <span className="font-bold">
              {profile.first_name} {profile.last_name}
            </span>
          </p>
        )}
      </main>

      {/* ===================================================
          MODALE RESET
      =================================================== */}

      {resetOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Réinitialiser la numérotation"
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => {
              if (!isResetting) {
                setResetOpen(false);
              }
            }}
            aria-label="Fermer"
          />

          <div className="relative z-10 w-full rounded-t-3xl border border-red-400 bg-card p-6 shadow-2xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
              <AlertTriangle size={23} />
            </div>

            <h2 className="mt-5 text-xl font-black">
              Réinitialiser la numérotation ?
            </h2>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              La prochaine intervention commencera avec
              une nouvelle série. Les numéros des
              interventions existantes ne seront pas
              modifiés.
            </p>

            {resetError && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm font-bold text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {resetError}
              </div>
            )}

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() =>
                  setResetOpen(false)
                }
                className="app-button-secondary min-h-12 rounded-xl px-4 text-sm font-black disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={isResetting}
                onClick={() =>
                  void resetNumbering()
                }
                className="min-h-12 rounded-xl bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isResetting
                  ? "Réinitialisation..."
                  : "Confirmer la réinitialisation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   COMPOSANTS
========================================================= */

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof FileText;
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
            {label}
          </p>

          <p className="mt-2 text-2xl font-black">
            {value}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}