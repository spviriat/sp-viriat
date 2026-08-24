"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type PersonStat = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  first_departure: number;
  second_departure: number;
  observer: number;
  total: number;
};

type MonthStatistics = {
  year: number;
  month: number;
  days_in_month: number;
  first_departure: {
    complete_days: number;
    incomplete_days: number;
    empty_days: number;
    coverage_percentage: number;
    total_registrations: number;
  };
  second_departure: {
    average_per_day: number;
    full_days: number;
    total_registrations: number;
  };
  observer: {
    total_registrations: number;
  };
  people: PersonStat[];
};

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function displayName(person: PersonStat) {
  const lastName =
    person.last_name?.trim().toUpperCase() ?? "";

  const firstName =
    person.first_name?.trim() ?? "";

  return `${lastName} ${firstName}`.trim() || "Sapeur-pompier";
}

export default function GuardMonitoringPage() {
  const router = useRouter();

  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [statistics, setStatistics] =
    useState<MonthStatistics | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadStatistics = useCallback(async () => {
    setLoading(true);
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

      const { data, error } = await supabase.rpc(
        "get_guard_month_statistics",
        {
          p_year: year,
          p_month: month + 1,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      setStatistics(data as MonthStatistics);
    } catch (error) {
      console.error(
        "Erreur suivi des gardes :",
        error
      );

      setStatistics(null);

      const message =
        error instanceof Error
          ? error.message
          : "Impossible de charger les statistiques.";

      if (
        message
          .toLowerCase()
          .includes("autorisé")
      ) {
        setErrorMessage(
          "Cette page est réservée au commandement et aux administrateurs."
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setLoading(false);
    }
  }, [month, router, year]);

  useEffect(() => {
    void loadStatistics();
  }, [loadStatistics]);

  const previousMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((value) => value - 1);
    } else {
      setMonth((value) => value - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((value) => value + 1);
    } else {
      setMonth((value) => value + 1);
    }
  };

  const goToday = () => {
    const today = new Date();

    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  if (loading && !statistics) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />

          <p className="mt-4 text-sm text-muted-foreground">
            Chargement du suivi des gardes...
          </p>
        </div>
      </div>
    );
  }

  if (errorMessage && !statistics) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center p-5">
        <div className="w-full max-w-lg rounded-3xl border border-red-300 bg-card p-6 shadow-sm">
          <AlertTriangle
            size={32}
            className="text-red-600"
          />

          <h1 className="mt-4 text-xl font-black">
            Accès au suivi impossible
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {errorMessage}
          </p>

          <Link
            href="/dashboard/disponibilites"
            className="app-button-secondary mt-5 inline-flex rounded-xl px-4 py-3 text-sm font-black"
          >
            Retour aux disponibilités
          </Link>
        </div>
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  const first = statistics.first_departure;
  const second = statistics.second_departure;

  return (
    <div className="app-page min-h-screen">
      <main className="mx-auto w-full max-w-7xl p-4 pb-24 sm:p-6 lg:p-8">
        {/* HEADER */}

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-red-500">
              Commandement
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Suivi des gardes
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Suivi de la couverture opérationnelle et
              répartition des disponibilités du personnel.
            </p>
          </div>

          <Link
            href="/dashboard/disponibilites"
            className="app-button-secondary inline-flex w-fit rounded-xl px-4 py-3 text-sm font-black"
          >
            Calendrier des disponibilités
          </Link>
        </header>

        {/* NAVIGATION MOIS */}

        <section className="mt-6 flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Période analysée
            </p>

            <h2 className="mt-1 text-2xl font-black capitalize">
              {MONTHS[month]} {year}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={previousMonth}
              className="app-button-secondary flex h-11 w-11 items-center justify-center rounded-xl"
              aria-label="Mois précédent"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              onClick={goToday}
              className="app-button-secondary min-h-11 rounded-xl px-4 text-sm font-black"
            >
              Aujourd&apos;hui
            </button>

            <button
              type="button"
              onClick={nextMonth}
              className="app-button-secondary flex h-11 w-11 items-center justify-center rounded-xl"
              aria-label="Mois suivant"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </section>

        {/* KPI */}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={ShieldCheck}
            label="1er départ assuré"
            value={`${first.coverage_percentage} %`}
            description={`${first.complete_days}/${statistics.days_in_month} nuits à 2/2`}
            tone={
              first.coverage_percentage === 100
                ? "success"
                : "danger"
            }
          />

          <KpiCard
            icon={AlertTriangle}
            label="Nuits incomplètes"
            value={String(first.incomplete_days)}
            description={`${first.empty_days} nuit${
              first.empty_days > 1 ? "s" : ""
            } sans aucun 1er départ`}
            tone={
              first.incomplete_days === 0
                ? "success"
                : "danger"
            }
          />

          <KpiCard
            icon={Users}
            label="Moyenne 2e départ"
            value={`${second.average_per_day} / 4`}
            description={`${second.full_days} nuit${
              second.full_days > 1 ? "s" : ""
            } à 4/4`}
            tone="normal"
          />

          <KpiCard
            icon={BarChart3}
            label="Disponibilités"
            value={String(
              first.total_registrations +
                second.total_registrations +
                statistics.observer.total_registrations
            )}
            description="Inscriptions sur le mois"
            tone="normal"
          />
        </section>

        {/* COUVERTURE */}

        <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                Couverture opérationnelle
              </p>

              <h2 className="mt-1 text-xl font-black">
                Premier départ
              </h2>
            </div>

            <p className="text-3xl font-black">
              {first.coverage_percentage} %
            </p>
          </div>

          <div className="mt-5 h-4 overflow-hidden rounded-full bg-surface-strong">
            <div
              className={
                first.coverage_percentage === 100
                  ? "h-full rounded-full bg-emerald-500 transition-all"
                  : "h-full rounded-full bg-red-500 transition-all"
              }
              style={{
                width: `${Math.min(
                  first.coverage_percentage,
                  100
                )}%`,
              }}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <SmallStat
              value={first.complete_days}
              label="Assurées"
            />

            <SmallStat
              value={first.incomplete_days}
              label="Incomplètes"
            />

            <SmallStat
              value={first.empty_days}
              label="À 0/2"
            />
          </div>
        </section>

        {/* STATS PERSONNEL */}

        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
              Personnel
            </p>

            <h2 className="mt-1 text-xl font-black">
              Répartition par pompier
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Nombre de disponibilités enregistrées sur le
              mois sélectionné.
            </p>
          </div>

          {statistics.people.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucune disponibilité enregistrée pour ce mois.
            </div>
          ) : (
            <>
              {/* MOBILE */}

              <div className="divide-y divide-border md:hidden">
                {statistics.people.map((person) => (
                  <div
                    key={person.profile_id}
                    className="p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black">
                        {displayName(person)}
                      </p>

                      <span className="rounded-full bg-surface-strong px-3 py-1 text-sm font-black">
                        {person.total}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <PersonMobileStat
                        label="1er"
                        value={person.first_departure}
                      />

                      <PersonMobileStat
                        label="2e"
                        value={person.second_departure}
                      />

                      <PersonMobileStat
                        label="Obs."
                        value={person.observer}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP */}

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse">
                  <thead className="bg-surface-strong">
                    <tr className="text-left text-xs font-black uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-4">
                        Pompier
                      </th>

                      <th className="px-5 py-4 text-center">
                        1er départ
                      </th>

                      <th className="px-5 py-4 text-center">
                        2e départ
                      </th>

                      <th className="px-5 py-4 text-center">
                        Observateur
                      </th>

                      <th className="px-5 py-4 text-center">
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {statistics.people.map(
                      (person) => (
                        <tr
                          key={person.profile_id}
                          className="transition hover:bg-surface-strong/50"
                        >
                          <td className="px-5 py-4 font-bold">
                            {displayName(person)}
                          </td>

                          <td className="px-5 py-4 text-center font-black">
                            {person.first_departure}
                          </td>

                          <td className="px-5 py-4 text-center font-black">
                            {person.second_departure}
                          </td>

                          <td className="px-5 py-4 text-center font-black">
                            {person.observer}
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex min-w-10 justify-center rounded-full bg-surface-strong px-3 py-1 font-black">
                              {person.total}
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  description: string;
  tone: "success" | "danger" | "normal";
}) {
  const iconClass =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
      : tone === "danger"
        ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
        : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300";

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}
      >
        <Icon size={20} />
      </div>

      <p className="mt-4 text-sm font-bold text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-3xl font-black">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function SmallStat({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-strong px-3 py-4 text-center">
      <p className="text-2xl font-black">
        {value}
      </p>

      <p className="mt-1 text-xs font-bold text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function PersonMobileStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-surface-strong p-2 text-center">
      <p className="font-black">{value}</p>

      <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">
        {label}
      </p>
    </div>
  );
}