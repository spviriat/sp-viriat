"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  AlertTriangle,
  Ambulance,
  ArrowLeftRight,
  BellRing,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Eye,
  LayoutDashboard,
  Menu,
  Package,
  Pill,
  RefreshCw,
  Search,
  Tags,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type AlertStatus =
  | "new"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "ignored";

type AlertSeverity =
  | "critical"
  | "high"
  | "medium"
  | "info";

type AlertType =
  | "stock_out"
  | "low_stock"
  | "expired_lot"
  | "expiration_30"
  | "expiration_90";

type ArticleSummary = {
  id: string;
  name: string;
  quantity: number;
  minimum_quantity: number;
  location: string | null;
  is_active: boolean;
};

type ExpirationSummary = {
  id: string;
  medical_item_id: string;
  quantity: number;
  expiration_date: string;
  notes: string | null;
};

type MedicalAlert = {
  id: string;
  alert_key: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  medical_item_id: string | null;
  expiration_id: string | null;
  title: string;
  message: string | null;
  status: AlertStatus;
  ignored_reason: string | null;
  assigned_to: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  is_active_condition: boolean;
  article: ArticleSummary | null;
  expiration: ExpirationSummary | null;
};

type AlertsResponse = {
  alerts?: MedicalAlert[];
  permissions?: {
    canRead: boolean;
    canWrite: boolean;
  };
  error?: string;
};

type UpdateAlertResponse = {
  alert?: MedicalAlert;
  message?: string;
  error?: string;
};

type StatusFilter =
  | "all"
  | AlertStatus;

type SeverityFilter =
  | "all"
  | AlertSeverity;

export default function AlertesPage() {
  const router = useRouter();

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(true);

  const [
    alerts,
    setAlerts,
  ] = useState<MedicalAlert[]>([]);

  const [
    canWrite,
    setCanWrite,
  ] = useState(false);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    updatingAlertId,
    setUpdatingAlertId,
  ] = useState<string | null>(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      "all"
    );

  const [
    severityFilter,
    setSeverityFilter,
  ] =
    useState<SeverityFilter>(
      "all"
    );

  const [
    activeOnly,
    setActiveOnly,
  ] = useState(true);

  const getAccessToken =
    useCallback(async () => {
      const {
        data: {
          session,
        },
        error,
      } =
        await supabase.auth.getSession();

      if (
        error ||
        !session?.access_token
      ) {
        return null;
      }

      return session.access_token;
    }, []);

  const loadAlerts =
    useCallback(async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          router.replace("/");
          return;
        }

        const response =
          await fetch(
            "/api/secourisme/alertes",
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },

              cache: "no-store",
            }
          );

        const result =
          (await response.json()) as
            AlertsResponse;

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Les alertes n'ont pas pu être chargées."
          );
        }

        setAlerts(
          result.alerts ?? []
        );

        setCanWrite(
          Boolean(
            result.permissions
              ?.canWrite
          )
        );
      } catch (error) {
        console.error(
          "Erreur chargement alertes :",
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
    }, [
      getAccessToken,
      router,
    ]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const activeAlerts =
    useMemo(
      () =>
        alerts.filter(
          (alert) =>
            alert.is_active_condition &&
            alert.status !==
              "resolved" &&
            alert.status !==
              "ignored"
        ),
      [alerts]
    );

  const criticalCount =
    useMemo(
      () =>
        activeAlerts.filter(
          (alert) =>
            alert.severity ===
            "critical"
        ).length,
      [activeAlerts]
    );

  const highCount =
    useMemo(
      () =>
        activeAlerts.filter(
          (alert) =>
            alert.severity ===
            "high"
        ).length,
      [activeAlerts]
    );

  const inProgressCount =
    useMemo(
      () =>
        alerts.filter(
          (alert) =>
            alert.status ===
              "acknowledged" ||
            alert.status ===
              "in_progress"
        ).length,
      [alerts]
    );

  const filteredAlerts =
    useMemo(() => {
      const normalized =
        search
          .trim()
          .toLowerCase();

      return alerts.filter(
        (alert) => {
          const matchesSearch =
            !normalized ||
            alert.title
              .toLowerCase()
              .includes(
                normalized
              ) ||
            alert.message
              ?.toLowerCase()
              .includes(
                normalized
              ) ||
            alert.article?.name
              .toLowerCase()
              .includes(
                normalized
              );

          const matchesStatus =
            statusFilter ===
              "all" ||
            alert.status ===
              statusFilter;

          const matchesSeverity =
            severityFilter ===
              "all" ||
            alert.severity ===
              severityFilter;

          const matchesActive =
            !activeOnly ||
            alert.is_active_condition;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesSeverity &&
            matchesActive
          );
        }
      );
    }, [
      activeOnly,
      alerts,
      search,
      severityFilter,
      statusFilter,
    ]);

  const formatDateTime = (
    value: string
  ) =>
    new Intl.DateTimeFormat(
      "fr-FR",
      {
        dateStyle: "short",
        timeStyle: "short",
      }
    ).format(
      new Date(value)
    );

  const getSeverityLabel = (
    severity: AlertSeverity
  ) => {
    switch (severity) {
      case "critical":
        return "Critique";

      case "high":
        return "Urgente";

      case "medium":
        return "À surveiller";

      default:
        return "Information";
    }
  };

  const getSeverityClass = (
    severity: AlertSeverity
  ) => {
    switch (severity) {
      case "critical":
        return "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300";

      case "high":
        return "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300";

      case "medium":
        return "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";

      default:
        return "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
    }
  };

  const getStatusLabel = (
    status: AlertStatus
  ) => {
    switch (status) {
      case "new":
        return "Nouvelle";

      case "acknowledged":
        return "Prise en compte";

      case "in_progress":
        return "En cours";

      case "resolved":
        return "Résolue";

      case "ignored":
        return "Ignorée";
    }
  };

  const getStatusClass = (
    status: AlertStatus
  ) => {
    switch (status) {
      case "new":
        return "border-red-300 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";

      case "acknowledged":
        return "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300";

      case "in_progress":
        return "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300";

      case "resolved":
        return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";

      case "ignored":
        return "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400";
    }
  };

  const getAlertCardClass = (
    status: AlertStatus
  ) => {
    switch (status) {
      case "new":
        return "border-red-300 bg-red-50 shadow-sm dark:border-red-900/80 dark:bg-red-950/20";

      case "acknowledged":
        return "border-blue-300 bg-blue-50 shadow-sm dark:border-blue-900/80 dark:bg-blue-950/20";

      case "in_progress":
        return "border-violet-300 bg-violet-50 shadow-sm dark:border-violet-900/80 dark:bg-violet-950/20";

      case "resolved":
        return "border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-900/80 dark:bg-emerald-950/15";

      case "ignored":
        return "border-slate-300 bg-slate-50 opacity-80 dark:border-slate-800 dark:bg-slate-900/50";
    }
  };

  const getStatusAccentClass = (
    status: AlertStatus
  ) => {
    switch (status) {
      case "new":
        return "bg-red-500";

      case "acknowledged":
        return "bg-blue-500";

      case "in_progress":
        return "bg-violet-500";

      case "resolved":
        return "bg-emerald-500";

      case "ignored":
        return "bg-slate-500";
    }
  };

  const handleStatusChange =
    async (
      alert: MedicalAlert,
      nextStatus:
        AlertStatus
    ) => {
      let ignoredReason:
        string | null = null;

      if (
        nextStatus ===
        "ignored"
      ) {
        ignoredReason =
          window.prompt(
            "Pourquoi cette alerte doit-elle être ignorée ?"
          );

        if (
          !ignoredReason?.trim()
        ) {
          return;
        }
      }

      setUpdatingAlertId(
        alert.id
      );
      setErrorMessage("");
      setSuccessMessage("");

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          router.replace("/");
          return;
        }

        const response =
          await fetch(
            "/api/secourisme/alertes",
            {
              method: "PATCH",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  id: alert.id,

                  status:
                    nextStatus,

                  ignoredReason,
                }),
            }
          );

        const result =
          (await response.json()) as
            UpdateAlertResponse;

        if (
          !response.ok ||
          !result.alert
        ) {
          throw new Error(
            result.error ??
              "Le statut n'a pas pu être modifié."
          );
        }

        setAlerts(
          (current) =>
            current.map(
              (currentAlert) =>
                currentAlert.id ===
                  alert.id
                  ? {
                      ...currentAlert,
                      ...result.alert!,
                    }
                  : currentAlert
            )
        );

        setSuccessMessage(
          result.message ??
            "Le statut a été mis à jour."
        );

        window.setTimeout(
          () => {
            setSuccessMessage("");
          },
          1800
        );
      } catch (error) {
        console.error(
          "Erreur changement statut alerte :",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setUpdatingAlertId(
          null
        );
      }
    };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-red-600" />

          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Chargement des alertes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">

      <SecourismeSidebar
        open={isSidebarOpen}
        onToggle={() =>
          setIsSidebarOpen(
            (current) => !current
          )
        }
      />

      <div
        className={`transition-[padding] duration-300 ${
          isSidebarOpen
            ? "lg:pl-72"
            : "lg:pl-24"
        }`}
      >
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-500">
                Secourisme
              </p>

              <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">
                Alertes pharmacie
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                Ruptures, stocks faibles,
                péremptions et suivi du traitement
                des alertes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                void loadAlerts();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <RefreshCw
                size={17}
              />
              Actualiser
            </button>

          </div>

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-900 bg-red-950/40 p-5 text-sm font-semibold text-red-300">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mt-6 rounded-2xl border border-emerald-900 bg-emerald-950/30 p-5 text-sm font-semibold text-emerald-300">
              {successMessage}
            </div>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <AlertStat
              icon={BellRing}
              label="Alertes actives"
              value={
                activeAlerts.length
              }
              tone="neutral"
            />

            <AlertStat
              icon={AlertOctagon}
              label="Critiques"
              value={criticalCount}
              tone="danger"
            />

            <AlertStat
              icon={AlertTriangle}
              label="Urgentes"
              value={highCount}
              tone="warning"
            />

            <AlertStat
              icon={Clock3}
              label="En traitement"
              value={inProgressCount}
              tone="info"
            />

          </div>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60 p-5">

            <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">

              <div>
                <label
                  htmlFor="alert-search"
                  className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Recherche
                </label>

                <div className="relative">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                  />

                  <input
                    id="alert-search"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Article, alerte..."
                    className="w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 py-3 pl-11 pr-4 text-slate-950 dark:text-white outline-none transition placeholder:text-slate-600 focus:border-red-600"
                  />
                </div>
              </div>

              <FilterSelect
                id="alert-status"
                label="Statut"
                value={
                  statusFilter
                }
                onChange={(value) =>
                  setStatusFilter(
                    value as
                      StatusFilter
                  )
                }
                options={[
                  {
                    value: "all",
                    label: "Tous",
                  },
                  {
                    value: "new",
                    label: "Nouvelle",
                  },
                  {
                    value:
                      "acknowledged",
                    label:
                      "Prise en compte",
                  },
                  {
                    value:
                      "in_progress",
                    label:
                      "En cours",
                  },
                  {
                    value:
                      "resolved",
                    label: "Résolue",
                  },
                  {
                    value:
                      "ignored",
                    label: "Ignorée",
                  },
                ]}
              />

              <FilterSelect
                id="alert-severity"
                label="Gravité"
                value={
                  severityFilter
                }
                onChange={(value) =>
                  setSeverityFilter(
                    value as
                      SeverityFilter
                  )
                }
                options={[
                  {
                    value: "all",
                    label: "Toutes",
                  },
                  {
                    value:
                      "critical",
                    label: "Critique",
                  },
                  {
                    value: "high",
                    label: "Urgente",
                  },
                  {
                    value: "medium",
                    label:
                      "À surveiller",
                  },
                  {
                    value: "info",
                    label:
                      "Information",
                  },
                ]}
              />

            </div>

            <label className="mt-4 inline-flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-300">

              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(event) =>
                  setActiveOnly(
                    event.target
                      .checked
                  )
                }
                className="h-4 w-4 accent-red-600"
              />

              Afficher uniquement les conditions
              actuellement actives

            </label>

          </section>

          <section className="mt-8">

            <div className="mb-5">
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                Suivi des alertes
              </h2>

              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {filteredAlerts.length} alerte(s)
                affichée(s) sur{" "}
                {alerts.length}.
              </p>
            </div>

            {filteredAlerts.length ===
            0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40 px-6 py-14 text-center">

                <CheckCircle2
                  size={38}
                  className="mx-auto text-emerald-500"
                />

                <h3 className="mt-5 text-lg font-black text-slate-950 dark:text-white">
                  Aucune alerte
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Aucun élément ne correspond aux
                  filtres actuels.
                </p>

              </div>
            ) : (
              <div className="space-y-3">

                {filteredAlerts.map(
                  (alert) => (
                    <article
                      key={alert.id}
                      className={`relative overflow-hidden rounded-2xl border p-5 transition ${getAlertCardClass(
                        alert.status
                      )}`}
                    >
                      <span
                        className={`absolute bottom-0 left-0 top-0 w-1 ${getStatusAccentClass(
                          alert.status
                        )}`}
                      />

                      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                        <div className="min-w-0 flex-1">

                          <div className="flex flex-wrap items-center gap-2">

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-black ${getSeverityClass(
                                alert.severity
                              )}`}
                            >
                              {getSeverityLabel(
                                alert.severity
                              )}
                            </span>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClass(
                                alert.status
                              )}`}
                            >
                              {getStatusLabel(
                                alert.status
                              )}
                            </span>

                            {!alert.is_active_condition && (
                              <span className="rounded-full border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-3 py-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                                Condition terminée
                              </span>
                            )}

                          </div>

                          <h3 className="mt-3 text-lg font-black text-slate-950 dark:text-white">
                            {alert.title}
                          </h3>

                          {alert.message && (
                            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                              {alert.message}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">

                            <span>
                              Créée le{" "}
                              {formatDateTime(
                                alert.created_at
                              )}
                            </span>

                            {alert.acknowledged_at && (
                              <span>
                                Prise en compte le{" "}
                                {formatDateTime(
                                  alert.acknowledged_at
                                )}
                              </span>
                            )}

                            {alert.resolved_at && (
                              <span>
                                Résolue le{" "}
                                {formatDateTime(
                                  alert.resolved_at
                                )}
                              </span>
                            )}

                          </div>

                          {alert.status ===
                            "ignored" &&
                            alert.ignored_reason && (
                              <p className="mt-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
                                Motif d'ignorance :{" "}
                                {alert.ignored_reason}
                              </p>
                            )}

                        </div>

                        <div className="flex shrink-0 flex-col gap-3 sm:flex-row xl:items-center">

                          {alert.article && (
                            <Link
                              href={`/dashboard/secourisme/stock?article=${encodeURIComponent(
                                alert.article.id
                              )}&name=${encodeURIComponent(
                                alert.article.name
                              )}`}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                              <Eye
                                size={16}
                              />
                              Voir l'article
                            </Link>
                          )}

                          {canWrite ? (
                            <select
                              value={
                                alert.status
                              }
                              disabled={
                                updatingAlertId !==
                                null
                              }
                              onChange={(event) => {
                                void handleStatusChange(
                                  alert,
                                  event.target
                                    .value as
                                    AlertStatus
                                );
                              }}
                              className="rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-4 py-3 text-sm font-bold text-slate-950 dark:text-white outline-none transition focus:border-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="new">
                                Nouvelle
                              </option>

                              <option value="acknowledged">
                                Prise en compte
                              </option>

                              <option value="in_progress">
                                En cours
                              </option>

                              <option value="resolved">
                                Résolue
                              </option>

                              <option value="ignored">
                                Ignorée
                              </option>
                            </select>
                          ) : (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Lecture seule
                            </span>
                          )}

                        </div>

                      </div>

                    </article>
                  )
                )}

              </div>
            )}

          </section>

        </main>
      </div>

    </div>
  );
}

function AlertStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone:
    | "neutral"
    | "danger"
    | "warning"
    | "info";
}) {
  const Icon = icon;

  const iconClass =
    tone === "danger"
      ? "border-red-900 bg-red-950/40 text-red-300"
      : tone === "warning"
        ? "border-orange-900 bg-orange-950/40 text-orange-300"
        : tone === "info"
          ? "border-blue-900 bg-blue-950/40 text-blue-300"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-slate-700 dark:text-slate-300";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60 p-5">

      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl border ${iconClass}`}
      >
        <Icon
          size={20}
          strokeWidth={2}
        />
      </div>

      <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
        {value}
      </p>

    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"
      >
        {label}
      </label>

      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-4 py-3 text-slate-950 dark:text-white outline-none focus:border-red-600"
      >
        {options.map(
          (option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          )
        )}
      </select>
    </div>
  );
}

function SecourismeSidebar({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`fixed bottom-0 left-0 top-0 z-40 hidden border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl transition-all duration-300 lg:block ${
        open
          ? "w-64"
          : "w-20"
      }`}
    >
      <div className="flex h-full flex-col p-3">

        <div className="mb-5 flex items-center justify-between gap-2">

          {open && (
            <div className="min-w-0 px-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
                Secourisme
              </p>

              <p className="mt-1 truncate text-sm font-black text-slate-950 dark:text-white">
                SP Viriat
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onToggle}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {open ? (
              <ChevronLeft
                size={18}
              />
            ) : (
              <ChevronRight
                size={18}
              />
            )}
          </button>

        </div>

        <nav className="space-y-5 overflow-y-auto">

          <SidebarSection
            title="Navigation"
            open={open}
          >
            <SidebarLink
              href="/dashboard"
              icon={LayoutDashboard}
              label="Tableau de bord"
              open={open}
            />

            <SidebarLink
              href="/dashboard/secourisme"
              icon={Ambulance}
              label="Accueil Secourisme"
              open={open}
            />
          </SidebarSection>

          <SidebarSection
            title="Pharmacie"
            open={open}
          >
            <SidebarLink
              href="/dashboard/secourisme/alertes"
              icon={BellRing}
              label="Alertes"
              open={open}
              active
            />

            <SidebarLink
              href="/dashboard/secourisme/stock"
              icon={Pill}
              label="Stock pharmacie"
              open={open}
            />

            <SidebarLink
              href="/dashboard/secourisme/peremptions"
              icon={CalendarClock}
              label="Péremptions"
              open={open}
            />

            <SidebarLink
              href="/dashboard/secourisme/fournisseurs"
              icon={Truck}
              label="Fournisseurs"
              open={open}
            />

            <SidebarLink
              href="/dashboard/secourisme/categories"
              icon={Tags}
              label="Catégories"
              open={open}
            />
          </SidebarSection>

          <SidebarSection
            title="Suivi"
            open={open}
          >
            <SidebarLink
              href="/dashboard/secourisme/stock"
              icon={Boxes}
              label="Articles"
              open={open}
            />

            <SidebarLink
              href="/dashboard/secourisme/mouvements"
              icon={ArrowLeftRight}
              label="Mouvements"
              open={open}
            />

            <SidebarLink
              href="/dashboard/secourisme/peremptions"
              icon={Package}
              label="Lots / péremptions"
              open={open}
            />
          </SidebarSection>

        </nav>

        <div className="mt-auto pt-4">

          <button
            type="button"
            onClick={onToggle}
            className={`flex w-full items-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${
              open
                ? "gap-3 px-3 py-2.5"
                : "justify-center px-2 py-2.5"
            }`}
          >
            <Menu
              size={18}
            />

            {open && (
              <span>
                Réduire le menu
              </span>
            )}
          </button>

        </div>

      </div>
    </aside>
  );
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
        <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          {title}
        </p>
      )}

      <div className="space-y-1">
        {children}
      </div>
    </section>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  open,
  active = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  open: boolean;
  active?: boolean;
}) {
  const Icon = icon;

  return (
    <Link
      href={href}
      title={
        !open
          ? label
          : undefined
      }
      className={`flex min-h-11 items-center rounded-xl text-sm font-bold transition ${
        open
          ? "gap-3 px-3"
          : "justify-center px-2"
      } ${
        active
          ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          active
            ? "bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400"
        }`}
      >
        <Icon
          size={18}
          strokeWidth={1.9}
        />
      </span>

      {open && (
        <span className="truncate">
          {label}
        </span>
      )}
    </Link>
  );
}