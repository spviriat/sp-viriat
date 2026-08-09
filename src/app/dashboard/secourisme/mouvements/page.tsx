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
  AlertTriangle,
  Ambulance,
  BellRing,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  LayoutDashboard,
  Menu,
  Package,
  Pill,
  RefreshCw,
  Search,
  Tags,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type ArticleSummary = {
  id: string;
  name: string;
  quantity: number;
  minimum_quantity: number;
  location: string | null;
  is_active: boolean;
};

type Movement = {
  id: string;
  medical_item_id: string;
  movement_type: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
  article: ArticleSummary | null;
};

type MovementsResponse = {
  movements?: Movement[];
  permissions?: {
    canRead: boolean;
    canWrite: boolean;
  };
  error?: string;
};

type MovementFilter =
  | "all"
  | "addition"
  | "withdrawal"
  | "initial"
  | "adjustment"
  | "bag_restock"
  | "intervention_restock"
  | "expired_disposal"
  | "inventory_correction";

export default function MouvementsPage() {
  const router = useRouter();

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(true);

  const [
    movements,
    setMovements,
  ] = useState<Movement[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    typeFilter,
    setTypeFilter,
  ] =
    useState<MovementFilter>(
      "all"
    );

  const [
    articleFilter,
    setArticleFilter,
  ] = useState("all");

  const [
    userFilter,
    setUserFilter,
  ] = useState("all");

  const [
    dateFrom,
    setDateFrom,
  ] = useState("");

  const [
    dateTo,
    setDateTo,
  ] = useState("");

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

  const loadMovements =
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
            "/api/secourisme/mouvements",
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
            MovementsResponse;

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Les mouvements n'ont pas pu être chargés."
          );
        }

        setMovements(
          result.movements ?? []
        );
      } catch (error) {
        console.error(
          "Erreur chargement mouvements :",
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
    void loadMovements();
  }, [loadMovements]);

  const articleOptions =
    useMemo(() => {
      const byId =
        new Map<
          string,
          ArticleSummary
        >();

      for (
        const movement of movements
      ) {
        if (movement.article) {
          byId.set(
            movement.article.id,
            movement.article
          );
        }
      }

      return Array.from(
        byId.values()
      ).sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            "fr",
            {
              sensitivity: "base",
            }
          )
      );
    }, [movements]);

  const userOptions =
    useMemo(() => {
      return Array.from(
        new Set(
          movements
            .map(
              (movement) =>
                movement.actor_name
            )
            .filter(
              (
                actorName
              ): actorName is string =>
                Boolean(actorName)
            )
        )
      ).sort(
        (a, b) =>
          a.localeCompare(
            b,
            "fr",
            {
              sensitivity: "base",
            }
          )
      );
    }, [movements]);

  const filteredMovements =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      const fromDate =
        dateFrom
          ? new Date(
              `${dateFrom}T00:00:00`
            )
          : null;

      const toDate =
        dateTo
          ? new Date(
              `${dateTo}T23:59:59.999`
            )
          : null;

      return movements.filter(
        (movement) => {
          const movementDate =
            new Date(
              movement.created_at
            );

          const matchesSearch =
            !normalizedSearch ||
            movement.article?.name
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            movement.actor_name
              ?.toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            movement.reason
              ?.toLowerCase()
              .includes(
                normalizedSearch
              );

          const matchesType =
            typeFilter === "all" ||
            movement.movement_type ===
              typeFilter;

          const matchesArticle =
            articleFilter ===
              "all" ||
            movement.medical_item_id ===
              articleFilter;

          const matchesUser =
            userFilter === "all" ||
            movement.actor_name ===
              userFilter;

          const matchesFrom =
            !fromDate ||
            movementDate >= fromDate;

          const matchesTo =
            !toDate ||
            movementDate <= toDate;

          return (
            matchesSearch &&
            matchesType &&
            matchesArticle &&
            matchesUser &&
            matchesFrom &&
            matchesTo
          );
        }
      );
    }, [
      articleFilter,
      dateFrom,
      dateTo,
      movements,
      search,
      typeFilter,
      userFilter,
    ]);

  const entryCount =
    useMemo(
      () =>
        movements.filter(
          (movement) =>
            movement.movement_type ===
            "addition"
        ).length,
      [movements]
    );

  const exitCount =
    useMemo(
      () =>
        movements.filter(
          (movement) =>
            movement.movement_type ===
            "withdrawal"
        ).length,
      [movements]
    );

  const disposalCount =
    useMemo(
      () =>
        movements.filter(
          (movement) =>
            movement.movement_type ===
            "expired_disposal"
        ).length,
      [movements]
    );

  const formatMovementDate = (
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

  const getMovementLabel = (
    movementType: string
  ) => {
    switch (movementType) {
      case "addition":
        return "Entrée";

      case "withdrawal":
        return "Sortie";

      case "initial":
        return "Stock initial";

      case "adjustment":
        return "Ajustement";

      case "bag_restock":
        return "Réassort sac";

      case "intervention_restock":
        return "Réassort intervention";

      case "expired_disposal":
        return "Destruction périmé";

      case "inventory_correction":
        return "Correction inventaire";

      default:
        return movementType;
    }
  };

  const getMovementBadgeClass = (
    movementType: string
  ) => {
    if (
      movementType === "addition" ||
      movementType === "initial" ||
      movementType ===
        "bag_restock" ||
      movementType ===
        "intervention_restock"
    ) {
      return "border-emerald-400 bg-emerald-200 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300";
    }

    if (
      movementType ===
        "withdrawal" ||
      movementType ===
        "expired_disposal"
    ) {
      return "border-red-400 bg-red-200 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300";
    }

    return "border-border bg-card text-foreground";
  };

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setArticleFilter("all");
    setUserFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />

          <p className="mt-4 text-sm text-muted-foreground">
            Chargement des mouvements...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">

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

              <h1 className="mt-2 text-3xl font-black text-foreground sm:text-4xl">
                Mouvements de stock
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Historique global des entrées,
                sorties, destructions de périmés,
                stocks initiaux et corrections.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void loadMovements();
                }}
                className="app-button-secondary inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
              >
                <RefreshCw
                  size={17}
                />
                Actualiser
              </button>

              <Link
                href="/dashboard/secourisme/stock"
                className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-foreground transition hover:bg-red-700"
              >
                Voir le stock
              </Link>
            </div>

          </div>

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-900 bg-red-950/40 p-5 text-sm font-semibold text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <MovementStat
              icon={History}
              label="Total mouvements"
              value={
                movements.length
              }
              tone="neutral"
            />

            <MovementStat
              icon={ArrowDownToLine}
              label="Entrées"
              value={entryCount}
              tone="positive"
            />

            <MovementStat
              icon={ArrowUpFromLine}
              label="Sorties"
              value={exitCount}
              tone="negative"
            />

            <MovementStat
              icon={AlertTriangle}
              label="Destructions périmés"
              value={disposalCount}
              tone="negative"
            />

          </div>

          <section className="mt-8 rounded-3xl border border-border bg-card p-5">

            <div className="grid gap-4 xl:grid-cols-[1.3fr_220px_240px_220px]">

              <div>
                <label
                  htmlFor="movement-search"
                  className="mb-2 block text-xs font-black uppercase tracking-wider text-muted-foreground"
                >
                  Recherche
                </label>

                <div className="relative">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />

                  <input
                    id="movement-search"
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Article, motif, utilisateur..."
                    className="w-full rounded-xl border border-border bg-card py-3 pl-11 pr-4 text-foreground outline-none transition placeholder:text-slate-600 focus:border-red-600"
                  />
                </div>
              </div>

              <FilterSelect
                id="movement-type"
                label="Type"
                value={typeFilter}
                onChange={(value) =>
                  setTypeFilter(
                    value as
                      MovementFilter
                  )
                }
                options={[
                  {
                    value: "all",
                    label: "Tous",
                  },
                  {
                    value:
                      "addition",
                    label: "Entrées",
                  },
                  {
                    value:
                      "withdrawal",
                    label: "Sorties",
                  },
                  {
                    value:
                      "expired_disposal",
                    label:
                      "Destruction périmé",
                  },
                  {
                    value:
                      "initial",
                    label:
                      "Stock initial",
                  },
                  {
                    value:
                      "adjustment",
                    label:
                      "Ajustement",
                  },
                  {
                    value:
                      "inventory_correction",
                    label:
                      "Correction inventaire",
                  },
                ]}
              />

              <FilterSelect
                id="movement-article"
                label="Article"
                value={
                  articleFilter
                }
                onChange={
                  setArticleFilter
                }
                options={[
                  {
                    value: "all",
                    label:
                      "Tous les articles",
                  },
                  ...articleOptions.map(
                    (article) => ({
                      value:
                        article.id,
                      label:
                        article.name,
                    })
                  ),
                ]}
              />

              <FilterSelect
                id="movement-user"
                label="Utilisateur"
                value={userFilter}
                onChange={
                  setUserFilter
                }
                options={[
                  {
                    value: "all",
                    label:
                      "Tous les utilisateurs",
                  },
                  ...userOptions.map(
                    (actorName) => ({
                      value:
                        actorName,
                      label:
                        actorName,
                    })
                  ),
                ]}
              />

            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[220px_220px_1fr]">

              <DateField
                id="movement-date-from"
                label="Du"
                value={dateFrom}
                onChange={
                  setDateFrom
                }
              />

              <DateField
                id="movement-date-to"
                label="Au"
                value={dateTo}
                onChange={
                  setDateTo
                }
              />

              <div className="flex items-end lg:justify-end">
                <button
                  type="button"
                  onClick={
                    resetFilters
                  }
                  className="rounded-xl border border-border px-4 py-3 text-sm font-bold text-foreground transition hover:bg-accent hover:text-foreground"
                >
                  Réinitialiser les filtres
                </button>
              </div>

            </div>

          </section>

          <section className="mt-8">

            <div className="mb-5">
              <h2 className="text-2xl font-black text-foreground">
                Historique global
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {filteredMovements.length} mouvement(s)
                affiché(s) sur{" "}
                {movements.length}.
              </p>
            </div>

            {filteredMovements.length ===
            0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-surface-soft px-6 py-14 text-center">

                <ClipboardList
                  size={36}
                  className="mx-auto text-muted-foreground"
                />

                <h3 className="mt-5 text-lg font-black text-foreground">
                  Aucun mouvement
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Aucun mouvement ne correspond
                  aux filtres sélectionnés.
                </p>

              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-border bg-card">

                <div className="overflow-x-auto">

                  <table className="w-full min-w-[1180px]">

                    <thead className="border-b border-border bg-background/50">
                      <tr className="text-left text-xs font-black uppercase tracking-wider text-muted-foreground">

                        <th className="px-5 py-4">
                          Date
                        </th>

                        <th className="px-5 py-4">
                          Article
                        </th>

                        <th className="px-5 py-4">
                          Type
                        </th>

                        <th className="px-5 py-4 text-right">
                          Mouvement
                        </th>

                        <th className="px-5 py-4">
                          Stock
                        </th>

                        <th className="px-5 py-4">
                          Motif
                        </th>

                        <th className="px-5 py-4">
                          Utilisateur
                        </th>

                        <th className="px-5 py-4 text-right">
                          Action
                        </th>

                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border">

                      {filteredMovements.map(
                        (movement) => (
                          <tr
                            key={
                              movement.id
                            }
                            className="transition hover:bg-accent/70"
                          >

                            <td className="whitespace-nowrap px-5 py-4 text-sm text-foreground">
                              {formatMovementDate(
                                movement.created_at
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-black text-foreground">
                                {movement.article
                                  ?.name ??
                                  "Article supprimé"}
                              </p>

                              {movement.article
                                ?.location && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {
                                    movement
                                      .article
                                      .location
                                  }
                                </p>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getMovementBadgeClass(
                                  movement.movement_type
                                )}`}
                              >
                                {getMovementLabel(
                                  movement.movement_type
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <span
                                className={
                                  movement.quantity_change >
                                  0
                                    ? "font-black text-emerald-400"
                                    : movement.quantity_change <
                                        0
                                      ? "font-black text-red-400"
                                      : "font-black text-foreground"
                                }
                              >
                                {movement.quantity_change >
                                0
                                  ? "+"
                                  : ""}
                                {
                                  movement.quantity_change
                                }
                              </span>
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-sm font-black text-foreground">
                              {
                                movement.previous_quantity
                              }{" "}
                              →{" "}
                              {
                                movement.new_quantity
                              }
                            </td>

                            <td className="max-w-[310px] px-5 py-4 text-sm text-foreground">
                              {movement.reason ||
                                "—"}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2 text-sm text-foreground">
                                <UserRound
                                  size={15}
                                  className="shrink-0 text-muted-foreground"
                                />

                                <span>
                                  {movement.actor_name ||
                                    "Utilisateur inconnu"}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex justify-end">
                                <Link
                                  href={`/dashboard/secourisme/stock?article=${encodeURIComponent(
                                    movement.medical_item_id
                                  )}&name=${encodeURIComponent(
                                    movement.article?.name ?? ""
                                  )}`}
                                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:bg-accent"
                                >
                                  Voir le stock
                                </Link>
                              </div>
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </div>
            )}

          </section>

        </main>
      </div>

    </div>
  );
}

function MovementStat({
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
    | "positive"
    | "negative";
}) {
  const Icon = icon;

  const iconClass =
    tone === "positive"
      ? "border-emerald-400 bg-emerald-200 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
      : tone === "negative"
        ? "border-red-400 bg-red-200 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
        : "border-border bg-card text-foreground";

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl border ${iconClass}`}
      >
        <Icon
          size={20}
          strokeWidth={2}
        />
      </div>

      <p className="mt-4 text-xs font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-3xl font-black text-foreground">
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
        className="mb-2 block text-xs font-black uppercase tracking-wider text-muted-foreground"
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
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:border-red-600"
      >
        {options.map(
          (option) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {option.label}
            </option>
          )
        )}
      </select>
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-black uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>

      <input
        id={id}
        type="date"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:border-red-600"
      />
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
      className={`fixed bottom-0 left-0 top-0 z-40 hidden border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-all duration-300 lg:block ${
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

              <p className="mt-1 truncate text-sm font-black text-foreground">
                SP Viriat
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onToggle}
            className="app-button-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
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
              active
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
            className={`app-button-secondary flex w-full items-center rounded-xl text-sm font-bold ${
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
        <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
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
          ? "border border-red-300 bg-red-100 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          active
            ? "bg-red-200 text-red-800 dark:bg-red-950/70 dark:text-red-300"
            : "bg-sidebar-accent text-muted-foreground"
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