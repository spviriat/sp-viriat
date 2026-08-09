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
  Boxes,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  LayoutDashboard,
  Menu,
  Package,
  Pill,
  Search,
  Tags,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type ArticleCategory =
  | {
      id: number;
      code: string;
      label: string;
    }
  | {
      id: number;
      code: string;
      label: string;
    }[]
  | null;

type Article = {
  id: string;
  name: string;
  quantity: number;
  minimum_quantity: number;
  location: string | null;
  has_expiration: boolean;
  is_active: boolean;
  medical_categories: ArticleCategory;
};

type ArticlesResponse = {
  articles?: Article[];
  permissions?: {
    canRead: boolean;
    canWrite: boolean;
  };
  error?: string;
};

type ExpirationStatus =
  | "expired"
  | "critical"
  | "soon"
  | "valid";

type ExpirationLot = {
  id: string;
  medical_item_id: string;
  quantity: number;
  expiration_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  status: ExpirationStatus;
  daysRemaining: number;
};

type ExpirationSummary = {
  stockQuantity: number;
  assignedQuantity: number;
  unassignedQuantity: number;
  expiredQuantity: number;
  expiringWithin30Days: number;
  expiringWithin90Days: number;
};

type ExpirationsResponse = {
  article?: Article;
  expirations?: ExpirationLot[];
  summary?: ExpirationSummary;
  permissions?: {
    canRead: boolean;
    canWrite: boolean;
  };
  error?: string;
};

type ExpirationRow = ExpirationLot & {
  article: Article;
};

type FilterValue =
  | "all"
  | "expired"
  | "critical"
  | "soon"
  | "valid";

function getArticleCategory(
  article: Article
) {
  const category =
    article.medical_categories;

  if (!category) {
    return null;
  }

  if (Array.isArray(category)) {
    return category[0] ?? null;
  }

  return category;
}

export default function PeremptionsPage() {
  const router = useRouter();

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(true);

  const [
    articles,
    setArticles,
  ] = useState<Article[]>([]);

  const [
    rows,
    setRows,
  ] = useState<ExpirationRow[]>([]);

  const [
    canWrite,
    setCanWrite,
  ] = useState(false);

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
    filter,
    setFilter,
  ] = useState<FilterValue>("all");

  const getAccessToken =
    useCallback(async () => {
      const {
        data: { session },
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

  const loadData =
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

        const articlesResponse =
          await fetch(
            "/api/secourisme/articles",
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
              cache: "no-store",
            }
          );

        const articlesResult =
          (await articlesResponse.json()) as
            ArticlesResponse;

        if (!articlesResponse.ok) {
          throw new Error(
            articlesResult.error ??
              "Impossible de récupérer les articles."
          );
        }

        const expirationArticles =
          (
            articlesResult.articles ??
            []
          ).filter(
            (article) =>
              article.has_expiration &&
              article.is_active
          );

        setArticles(
          expirationArticles
        );

        setCanWrite(
          Boolean(
            articlesResult.permissions
              ?.canWrite
          )
        );

        const expirationResponses =
          await Promise.all(
            expirationArticles.map(
              async (article) => {
                const response =
                  await fetch(
                    `/api/secourisme/articles/${article.id}/expirations`,
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
                    ExpirationsResponse;

                if (!response.ok) {
                  throw new Error(
                    result.error ??
                      `Impossible de récupérer les péremptions de ${article.name}.`
                  );
                }

                return {
                  article,
                  lots:
                    result.expirations ??
                    [],
                };
              }
            )
          );

        const flattened =
          expirationResponses
            .flatMap(
              ({
                article,
                lots,
              }) =>
                lots.map(
                  (lot) => ({
                    ...lot,
                    article,
                  })
                )
            )
            .sort(
              (a, b) =>
                a.expiration_date.localeCompare(
                  b.expiration_date
                )
            );

        setRows(flattened);
      } catch (error) {
        console.error(
          "Erreur chargement péremptions :",
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
    void loadData();
  }, [loadData]);

  const filteredRows =
    useMemo(() => {
      const normalized =
        search
          .trim()
          .toLowerCase();

      return rows.filter(
        (row) => {
          const category =
            getArticleCategory(
              row.article
            );

          const matchesSearch =
            !normalized ||
            row.article.name
              .toLowerCase()
              .includes(normalized) ||
            row.notes
              ?.toLowerCase()
              .includes(normalized) ||
            category?.label
              .toLowerCase()
              .includes(normalized);

          const matchesFilter =
            filter === "all" ||
            row.status === filter;

          return (
            matchesSearch &&
            matchesFilter
          );
        }
      );
    }, [
      filter,
      rows,
      search,
    ]);

  const expiredQuantity =
    useMemo(
      () =>
        rows
          .filter(
            (row) =>
              row.status === "expired"
          )
          .reduce(
            (
              total,
              row
            ) =>
              total + row.quantity,
            0
          ),
      [rows]
    );

  const criticalQuantity =
    useMemo(
      () =>
        rows
          .filter(
            (row) =>
              row.status === "critical"
          )
          .reduce(
            (
              total,
              row
            ) =>
              total + row.quantity,
            0
          ),
      [rows]
    );

  const soonQuantity =
    useMemo(
      () =>
        rows
          .filter(
            (row) =>
              row.status === "soon"
          )
          .reduce(
            (
              total,
              row
            ) =>
              total + row.quantity,
            0
          ),
      [rows]
    );

  const validQuantity =
    useMemo(
      () =>
        rows
          .filter(
            (row) =>
              row.status === "valid"
          )
          .reduce(
            (
              total,
              row
            ) =>
              total + row.quantity,
            0
          ),
      [rows]
    );

  const formatExpirationDate = (
    value: string
  ) =>
    new Intl.DateTimeFormat(
      "fr-FR",
      {
        dateStyle: "medium",
      }
    ).format(
      new Date(
        `${value}T00:00:00`
      )
    );

  const getStatusLabel = (
    row: ExpirationRow
  ) => {
    switch (row.status) {
      case "expired":
        return "Expiré";

      case "critical":
        return row.daysRemaining === 0
          ? "Expire aujourd'hui"
          : `Expire dans ${row.daysRemaining} j`;

      case "soon":
        return `Expire dans ${row.daysRemaining} j`;

      default:
        return "Valide";
    }
  };

  const getStatusClass = (
    status: ExpirationStatus
  ) => {
    switch (status) {
      case "expired":
        return "border-red-400 bg-red-200 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300";

      case "critical":
        return "border-orange-400 bg-orange-200 text-orange-900 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300";

      case "soon":
        return "border-amber-400 bg-amber-200 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300";

      default:
        return "border-emerald-400 bg-emerald-200 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300";
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />

          <p className="mt-4 text-sm text-muted-foreground">
            Chargement des péremptions...
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
                Péremptions
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Vue globale des lots suivis,
                des produits expirés et des
                échéances à venir.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/secourisme/stock"
                className="app-button-secondary rounded-xl px-4 py-3 text-sm font-bold"
              >
                Voir le stock
              </Link>

              {canWrite && (
                <Link
                  href="/dashboard/secourisme/stock"
                  className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-foreground transition hover:bg-red-700"
                >
                  Gérer les lots
                </Link>
              )}
            </div>

          </div>

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-400 bg-red-100 p-5 text-sm font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <SummaryCard
              icon={AlertTriangle}
              label="Expirés"
              value={expiredQuantity}
              tone="danger"
            />

            <SummaryCard
              icon={Clock3}
              label="≤ 30 jours"
              value={criticalQuantity}
              tone="warning"
            />

            <SummaryCard
              icon={CalendarClock}
              label="31 à 90 jours"
              value={soonQuantity}
              tone="warning"
            />

            <SummaryCard
              icon={CircleCheck}
              label="Valides"
              value={validQuantity}
              tone="ok"
            />

          </div>

          <section className="mt-8 rounded-3xl border border-border bg-card p-5">

            <div className="grid gap-4 lg:grid-cols-[1fr_240px]">

              <div>
                <label
                  htmlFor="expiration-search"
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
                    id="expiration-search"
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Article, catégorie, lot..."
                    className="w-full rounded-xl border border-border bg-card py-3 pl-11 pr-4 text-foreground outline-none transition placeholder:text-slate-600 focus:border-red-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="expiration-filter"
                  className="mb-2 block text-xs font-black uppercase tracking-wider text-muted-foreground"
                >
                  État
                </label>

                <select
                  id="expiration-filter"
                  value={filter}
                  onChange={(event) =>
                    setFilter(
                      event.target
                        .value as FilterValue
                    )
                  }
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:border-red-600"
                >
                  <option value="all">
                    Tous
                  </option>
                  <option value="expired">
                    Expirés
                  </option>
                  <option value="critical">
                    ≤ 30 jours
                  </option>
                  <option value="soon">
                    31 à 90 jours
                  </option>
                  <option value="valid">
                    Valides
                  </option>
                </select>
              </div>

            </div>

          </section>

          <section className="mt-8">

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-foreground">
                  Lots suivis
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {filteredRows.length} lot(s)
                  affiché(s) sur{" "}
                  {articles.length} article(s)
                  suivi(s).
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void loadData();
                }}
                className="text-sm font-bold text-muted-foreground transition hover:text-foreground"
              >
                Actualiser
              </button>
            </div>

            {filteredRows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-surface-soft px-6 py-14 text-center">

                <Package
                  size={34}
                  className="mx-auto text-muted-foreground"
                />

                <h3 className="mt-5 text-lg font-black text-foreground">
                  Aucun lot trouvé
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Aucun lot ne correspond aux
                  filtres actuels.
                </p>

              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-border bg-card">

                <div className="overflow-x-auto">

                  <table className="w-full min-w-[1050px]">

                    <thead className="border-b border-border bg-background/50">
                      <tr className="text-left text-xs font-black uppercase tracking-wider text-muted-foreground">

                        <th className="px-5 py-4">
                          Article
                        </th>

                        <th className="px-5 py-4">
                          Catégorie
                        </th>

                        <th className="px-5 py-4">
                          Péremption
                        </th>

                        <th className="px-5 py-4 text-right">
                          Quantité
                        </th>

                        <th className="px-5 py-4">
                          État
                        </th>

                        <th className="px-5 py-4">
                          Notes
                        </th>

                        <th className="px-5 py-4 text-right">
                          Action
                        </th>

                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border">

                      {filteredRows.map(
                        (row) => {
                          const category =
                            getArticleCategory(
                              row.article
                            );

                          return (
                            <tr
                              key={row.id}
                              className="transition hover:bg-accent/70"
                            >

                              <td className="px-5 py-4">
                                <p className="font-black text-foreground">
                                  {row.article.name}
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  Stock total :{" "}
                                  {row.article.quantity}
                                </p>
                              </td>

                              <td className="px-5 py-4 text-sm text-foreground">
                                {category?.label ??
                                  "Non classé"}
                              </td>

                              <td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-foreground">
                                {formatExpirationDate(
                                  row.expiration_date
                                )}
                              </td>

                              <td className="px-5 py-4 text-right font-black text-foreground">
                                {row.quantity}
                              </td>

                              <td className="px-5 py-4">
                                <span
                                  className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClass(
                                    row.status
                                  )}`}
                                >
                                  {getStatusLabel(
                                    row
                                  )}
                                </span>
                              </td>

                              <td className="max-w-[260px] px-5 py-4 text-sm text-muted-foreground">
                                {row.notes ||
                                  "—"}
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex justify-end">
                                  <Link
                                    href={`/dashboard/secourisme/stock?article=${row.article.id}&peremptions=1`}
                                    className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:bg-accent"
                                  >
                                    Voir dans le stock
                                  </Link>
                                </div>
                              </td>

                            </tr>
                          );
                        }
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

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone:
    | "danger"
    | "warning"
    | "ok";
}) {
  const Icon = icon;

  const iconClass =
    tone === "danger"
      ? "border-red-400 bg-red-200 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
      : tone === "warning"
        ? "border-amber-400 bg-amber-200 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
        : "border-emerald-400 bg-emerald-200 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300";

  const valueClass =
    tone === "danger"
      ? "text-red-700 dark:text-red-400"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-300"
        : "text-emerald-700 dark:text-emerald-400";

  return (
    <div className="rounded-3xl border border-border bg-card p-5">

      <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${iconClass}`}>
        <Icon
          size={20}
          strokeWidth={2}
        />
      </div>

      <p className="mt-4 text-xs font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <p className={`mt-1 text-3xl font-black ${valueClass}`}>
        {value}
      </p>

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
        open ? "w-64" : "w-20"
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
              active
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
              href="/dashboard/secourisme/stock"
              icon={Package}
              label="Lots"
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
      title={!open ? label : undefined}
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