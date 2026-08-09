"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import {
  Ambulance,
  BellRing,
  Boxes,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Package,
  Pill,
  Tags,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type MedicalCategory = {
  id: number;
  code: string;
  label: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

type CategoriesResponse = {
  categories?: MedicalCategory[];
  permissions?: {
    canRead?: boolean;
    canWrite?: boolean;
  };
  error?: string;
  message?: string;
  category?: MedicalCategory;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<MedicalCategory[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);

  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  /*
   * =====================================================
   * CHARGEMENT DES CATÉGORIES
   * =====================================================
   */

  const loadCategories = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setErrorMessage(
          "Votre session est invalide ou a expiré."
        );
        return;
      }

      const response = await fetch(
        "/api/secourisme/categories",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = (await response.json()) as CategoriesResponse;

      if (!response.ok) {
        setErrorMessage(
          result.error ??
            "Impossible de charger les catégories."
        );
        return;
      }

      setCategories(result.categories ?? []);
      setCanWrite(Boolean(result.permissions?.canWrite));
    } catch (error) {
      console.error(
        "Erreur lors du chargement des catégories :",
        error
      );

      setErrorMessage(
        "Une erreur inattendue est survenue."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    void loadCategories();
  }, []);

  /*
   * =====================================================
   * CRÉATION D'UNE CATÉGORIE
   * =====================================================
   */

  const handleCreateCategory = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanLabel = newCategoryLabel.trim();

    if (!cleanLabel) {
      setErrorMessage(
        "Le nom de la catégorie est obligatoire."
      );
      return;
    }

    setIsCreating(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setErrorMessage(
          "Votre session est invalide ou a expiré."
        );
        return;
      }

      const response = await fetch(
        "/api/secourisme/categories",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            label: cleanLabel,
          }),
        }
      );

      const result = (await response.json()) as CategoriesResponse;

      if (!response.ok) {
        setErrorMessage(
          result.error ??
            "Impossible de créer la catégorie."
        );
        return;
      }

      setNewCategoryLabel("");

      setSuccessMessage(
        result.message ??
          "La catégorie a été créée avec succès."
      );

      await loadCategories();
    } catch (error) {
      console.error(
        "Erreur lors de la création de la catégorie :",
        error
      );

      setErrorMessage(
        "Une erreur inattendue est survenue."
      );
    } finally {
      setIsCreating(false);
    }
  };

  /*
   * =====================================================
   * SUPPRESSION D'UNE CATÉGORIE
   * =====================================================
   */

  const handleDeleteCategory = async (
    category: MedicalCategory
  ) => {
    if (!canWrite) {
      return;
    }

    const confirmed = window.confirm(
      `Supprimer la catégorie « ${category.label} » ?\n\nLa suppression sera refusée si des articles du stock utilisent encore cette catégorie.`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setDeletingCategoryId(category.id);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setErrorMessage(
          "Votre session est invalide ou a expiré."
        );
        return;
      }

      const response = await fetch(
        `/api/secourisme/categories?id=${encodeURIComponent(
          String(category.id)
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      const result =
        (await response.json()) as CategoriesResponse;

      if (!response.ok) {
        setErrorMessage(
          result.error ??
            "Impossible de supprimer la catégorie."
        );
        return;
      }

      setSuccessMessage(
        result.message ??
          "La catégorie a été supprimée."
      );

      await loadCategories();
    } catch (error) {
      console.error(
        "Erreur lors de la suppression de la catégorie :",
        error
      );

      setErrorMessage(
        "Une erreur inattendue est survenue."
      );
    } finally {
      setDeletingCategoryId(null);
    }
  };

  /*
   * =====================================================
   * AFFICHAGE
   * =====================================================
   */

  /*
   * Garde d'hydratation :
   * le serveur et le tout premier rendu client renvoient
   * exactement le même contenu statique.
   */
  if (!isMounted) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />
          <p className="mt-4 text-sm text-muted-foreground">
            Chargement des catégories...
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
          setIsSidebarOpen((current) => !current)
        }
        active="categories"
      />

      <div
        className={`transition-[padding] duration-300 ${
          isSidebarOpen ? "lg:pl-72" : "lg:pl-24"
        }`}
      >
        <main className="px-4 py-8">
          <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-red-500">
              Secourisme
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Catégories
            </h1>

            <p className="mt-3 max-w-2xl text-muted-foreground">
              Organisez le matériel du stock pharmacie par catégorie.
            </p>
          </div>

          <Link
            href="/dashboard/secourisme"
            className="inline-flex items-center justify-center rounded-2xl border border-border px-5 py-3 font-bold transition hover:bg-accent"
          >
            ← Retour au secourisme
          </Link>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-400 bg-red-200 px-5 py-4 font-semibold text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-400 bg-emerald-200 px-5 py-4 font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            ✅ {successMessage}
          </div>
        )}

        {canWrite && (
          <section className="mb-8 rounded-3xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-xl font-black">
              Ajouter une catégorie
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              La catégorie sera immédiatement disponible pour les articles du stock.
            </p>

            <form
              onSubmit={handleCreateCategory}
              className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]"
            >
              <label className="block">
                <span className="text-sm font-bold text-foreground">
                  Nom de la catégorie
                </span>

                <input
                  type="text"
                  value={newCategoryLabel}
                  onChange={(event) =>
                    setNewCategoryLabel(event.target.value)
                  }
                  disabled={isCreating}
                  placeholder="Ex. Immobilisation"
                  className="app-input mt-2 w-full rounded-2xl px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/10 disabled:opacity-50"
                />
              </label>

              <button
                type="submit"
                disabled={isCreating}
                className="self-end rounded-2xl bg-red-600 px-6 py-3 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating
                  ? "Création..."
                  : "+ Ajouter"}
              </button>
            </form>
          </section>
        )}

        <section className="rounded-3xl border border-border bg-card p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">
                Catégories du stock
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                {categories.length} catégorie(s)
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadCategories()}
              className="rounded-xl border border-border px-4 py-2 text-sm font-bold transition hover:bg-accent"
            >
              Actualiser
            </button>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">
              Chargement des catégories...
            </div>
          ) : categories.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg font-black">
                Aucune catégorie
              </p>

              <p className="mt-2 text-muted-foreground">
                Ajoutez votre première catégorie de matériel.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-2xl border border-border bg-surface-soft p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black">
                        {category.label}
                      </p>

                      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {category.code}
                      </p>
                    </div>

                    <span
                      className={
                        category.is_active
                          ? "rounded-full border border-emerald-400 bg-emerald-200 px-3 py-1 text-xs font-black text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "rounded-full bg-surface-strong px-3 py-1 text-xs font-black text-muted-foreground"
                      }
                    >
                      {category.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>
                  {canWrite && (
                    <div className="mt-5 flex justify-end border-t border-border pt-4">
                      <button
                        type="button"
                        onClick={() =>
                          void handleDeleteCategory(category)
                        }
                        disabled={
                          deletingCategoryId === category.id
                        }
                        className="rounded-xl border border-red-400 bg-red-100 px-4 py-2 text-sm font-black text-red-800 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                      >
                        {deletingCategoryId === category.id
                          ? "Suppression..."
                          : "Supprimer"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
          </div>
        </main>
      </div>
    </div>
  );
}


function SecourismeSidebar({
  open,
  onToggle,
  active,
}: {
  open: boolean;
  onToggle: () => void;
  active:
    | "alertes"
    | "stock"
    | "peremptions"
    | "fournisseurs"
    | "categories";
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
            aria-label={open ? "Réduire le menu" : "Ouvrir le menu"}
          >
            {open ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <nav className="space-y-5 overflow-y-auto">
          <SidebarSection title="Navigation" open={open}>
            <SidebarLink href="/dashboard" icon={LayoutDashboard} label="Tableau de bord" open={open} />
            <SidebarLink href="/dashboard/secourisme" icon={Ambulance} label="Accueil Secourisme" open={open} />
          </SidebarSection>

          <SidebarSection title="Pharmacie" open={open}>
            <SidebarLink href="/dashboard/secourisme/alertes" icon={BellRing} label="Alertes" open={open} active={active === "alertes"} />
            <SidebarLink href="/dashboard/secourisme/stock" icon={Pill} label="Stock pharmacie" open={open} active={active === "stock"} />
            <SidebarLink href="/dashboard/secourisme/peremptions" icon={CalendarClock} label="Péremptions" open={open} active={active === "peremptions"} />
            <SidebarLink href="/dashboard/secourisme/fournisseurs" icon={Truck} label="Fournisseurs" open={open} active={active === "fournisseurs"} />
            <SidebarLink href="/dashboard/secourisme/categories" icon={Tags} label="Catégories" open={open} active={active === "categories"} />
          </SidebarSection>

          <SidebarSection title="Suivi" open={open}>
            <SidebarLink href="/dashboard/secourisme/stock" icon={Boxes} label="Articles" open={open} />
            <SidebarLink href="/dashboard/secourisme/mouvements" icon={Package} label="Mouvements" open={open} />
          </SidebarSection>
        </nav>

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={onToggle}
            className={`app-button-secondary flex w-full items-center rounded-xl text-sm font-bold ${
              open ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5"
            }`}
          >
            <Menu size={18} />
            {open && <span>Réduire le menu</span>}
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
      <div className="space-y-1">{children}</div>
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
        open ? "gap-3 px-3" : "justify-center px-2"
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
        <Icon size={18} strokeWidth={1.9} />
      </span>
      {open && <span className="truncate">{label}</span>}
    </Link>
  );
}