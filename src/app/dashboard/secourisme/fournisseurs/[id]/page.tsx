"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import Link from "next/link";

import { supabase } from "@/lib/supabase";

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

type Supplier = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  contact_name: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type SupplierArticle = {
  id: string;

  supplier_reference: string | null;
  packaging_type: string | null;
  units_per_box: number | null;
  is_primary: boolean;
  notes: string | null;

  medical_item: {
    id: string;
    name: string;
    quantity: number;
    minimum_quantity: number;
    packaging_type: string | null;
    units_per_box: number | null;

    category: {
      id: string;
      label: string;
    } | null;
  } | null;
};

type SupplierResponse = {
  supplier?: Supplier;
  error?: string;
};

type ArticlesResponse = {
  articles?: SupplierArticle[];
  error?: string;
};

type UpdateSupplierResponse = {
  supplier?: Supplier;
  message?: string;
  error?: string;
};

type DeleteSupplierResponse = {
  deleted?: boolean;
  message?: string;
  error?: string;
};

type StockArticle = {
  id: string;
  name: string;
  quantity: number;
  minimum_quantity: number;
  packaging_type: string | null;
  units_per_box: number | null;
  is_active: boolean;
  medical_categories:
    | {
        id: number;
        code: string;
        label: string;
        display_order?: number | null;
      }
    | {
        id: number;
        code: string;
        label: string;
        display_order?: number | null;
      }[]
    | null;
  suppliers?: {
    supplier_id?: string;
  }[];
};

type StockArticlesResponse = {
  articles?: StockArticle[];
  error?: string;
};

type CreateSupplierArticleResponse = {
  article?: SupplierArticle;
  message?: string;
  error?: string;
};

type SupplierArticleMutationResponse = {
  supplier?: SupplierArticle;
  message?: string;
  error?: string;
};

export default function SupplierDetailPage() {
  const router = useRouter();

  const params = useParams<{
    id: string;
  }>();

  const supplierId =
    typeof params?.id === "string"
      ? params.id
      : "";

  const [supplier, setSupplier] =
    useState<Supplier | null>(null);

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(true);

  const [articles, setArticles] =
    useState<SupplierArticle[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [isEditOpen, setIsEditOpen] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [editError, setEditError] =
    useState("");

  const [editSuccess, setEditSuccess] =
    useState("");

  const [editForm, setEditForm] =
    useState({
      name: "",
      address: "",
      phone: "",
      email: "",
      website: "",
      contactName: "",
      notes: "",
      isActive: true,
    });

  const [
    isReferenceOpen,
    setIsReferenceOpen,
  ] = useState(false);

  const [
    isReferenceLoading,
    setIsReferenceLoading,
  ] = useState(false);

  const [
    isReferenceSaving,
    setIsReferenceSaving,
  ] = useState(false);

  const [
    referenceError,
    setReferenceError,
  ] = useState("");

  const [
    referenceSuccess,
    setReferenceSuccess,
  ] = useState("");

  const [
    stockArticles,
    setStockArticles,
  ] = useState<StockArticle[]>([]);

  const [
    articleSearch,
    setArticleSearch,
  ] = useState("");

  const [
    referenceForm,
    setReferenceForm,
  ] = useState({
    medicalItemId: "",
    supplierReference: "",
    packagingType: "unit",
    unitsPerBox: "",
    isPrimary: false,
    notes: "",
  });

  const [
    editingArticle,
    setEditingArticle,
  ] = useState<SupplierArticle | null>(null);

  const [
    editReferenceForm,
    setEditReferenceForm,
  ] = useState({
    supplierReference: "",
    packagingType: "unit",
    unitsPerBox: "",
    isPrimary: false,
    notes: "",
  });

  const [
    isEditReferenceSaving,
    setIsEditReferenceSaving,
  ] = useState(false);

  const [
    editReferenceError,
    setEditReferenceError,
  ] = useState("");

  const [
    deletingArticleId,
    setDeletingArticleId,
  ] = useState<string | null>(null);

  const [
    isDeletingSupplier,
    setIsDeletingSupplier,
  ] = useState(false);

  const [
    deleteSupplierError,
    setDeleteSupplierError,
  ] = useState("");

  /*
   * =========================================================
   * TOKEN
   * =========================================================
   */

  const getAccessToken =
    useCallback(async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (
        error ||
        !session?.access_token
      ) {
        return null;
      }

      return session.access_token;
    }, []);

  const handleDeleteSupplier = async () => {
    if (!supplier || !supplierId || isDeletingSupplier) {
      return;
    }

    if (articles.length > 0) {
      setDeleteSupplierError(
        `Impossible de supprimer ce fournisseur : ${articles.length} ${
          articles.length === 1
            ? "référence lui est encore associée"
            : "références lui sont encore associées"
        }. Supprime d'abord ses références ou désactive le fournisseur.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Supprimer définitivement le fournisseur « ${supplier.name} » ?\n\nCette action est irréversible et sera enregistrée dans l'historique d'audit.`
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingSupplier(true);
    setDeleteSupplierError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.replace("/");
        return;
      }

      const response = await fetch(
        `/api/secourisme/fournisseurs/${supplierId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result =
        (await response.json()) as DeleteSupplierResponse;

      if (!response.ok || !result.deleted) {
        throw new Error(
          result.error ??
            "Le fournisseur n'a pas pu être supprimé."
        );
      }

      router.push("/dashboard/secourisme/fournisseurs");
      router.refresh();
    } catch (error) {
      console.error(
        "Erreur suppression fournisseur :",
        error
      );

      setDeleteSupplierError(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setIsDeletingSupplier(false);
    }
  };

  /*
   * =========================================================
   * CHARGEMENT
   * =========================================================
   */

  const loadSupplier =
    useCallback(async () => {
      if (!supplierId) {
        setErrorMessage(
          "Identifiant du fournisseur invalide."
        );

        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          router.replace("/");
          return;
        }

        /*
         * Fournisseur
         */

        const supplierResponse =
          await fetch(
            `/api/secourisme/fournisseurs/${supplierId}`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },

              cache: "no-store",
            }
          );

        const supplierResult =
          (await supplierResponse.json()) as
            SupplierResponse;

        if (
          !supplierResponse.ok ||
          !supplierResult.supplier
        ) {
          throw new Error(
            supplierResult.error ??
              "Impossible de récupérer le fournisseur."
          );
        }

        /*
         * Articles associés
         */

        const articlesResponse =
          await fetch(
            `/api/secourisme/fournisseurs/${supplierId}/articles`,
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
              "Impossible de récupérer les articles du fournisseur."
          );
        }

        setSupplier(
          supplierResult.supplier
        );

        setArticles(
          articlesResult.articles ?? []
        );
      } catch (error) {
        console.error(
          "Erreur fournisseur :",
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
      supplierId,
    ]);

  useEffect(() => {
    void loadSupplier();
  }, [loadSupplier]);

  const openEditModal = () => {
    if (!supplier) {
      return;
    }

    setEditForm({
      name: supplier.name ?? "",
      address: supplier.address ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      website: supplier.website ?? "",
      contactName: supplier.contact_name ?? "",
      notes: supplier.notes ?? "",
      isActive: supplier.is_active,
    });

    setEditError("");
    setEditSuccess("");
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    if (isSaving) {
      return;
    }

    setIsEditOpen(false);
    setEditError("");
    setEditSuccess("");
  };

  const handleEditSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!supplierId) {
      setEditError(
        "Identifiant du fournisseur invalide."
      );
      return;
    }

    setIsSaving(true);
    setEditError("");
    setEditSuccess("");

    try {
      const accessToken =
        await getAccessToken();

      if (!accessToken) {
        router.replace("/");
        return;
      }

      const response =
        await fetch(
          `/api/secourisme/fournisseurs/${supplierId}`,
          {
            method: "PATCH",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              name:
                editForm.name,
              address:
                editForm.address,
              phone:
                editForm.phone,
              email:
                editForm.email,
              website:
                editForm.website,
              contactName:
                editForm.contactName,
              notes:
                editForm.notes,
              isActive:
                editForm.isActive,
            }),
          }
        );

      const result =
        (await response.json()) as
          UpdateSupplierResponse;

      if (
        !response.ok ||
        !result.supplier
      ) {
        throw new Error(
          result.error ??
            "Le fournisseur n'a pas pu être modifié."
        );
      }

      setSupplier(result.supplier);

      setEditSuccess(
        result.message ??
          "Le fournisseur a été modifié avec succès."
      );

      window.setTimeout(() => {
        setIsEditOpen(false);
        setEditSuccess("");
      }, 700);
    } catch (error) {
      console.error(
        "Erreur modification fournisseur :",
        error
      );

      setEditError(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getStockArticleCategory = (
    article: StockArticle
  ) => {
    const category =
      article.medical_categories;

    if (!category) {
      return null;
    }

    if (Array.isArray(category)) {
      return category[0] ?? null;
    }

    return category;
  };

  const loadStockArticles =
    useCallback(async () => {
      setIsReferenceLoading(true);
      setReferenceError("");

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          router.replace("/");
          return;
        }

        const response =
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

        const result =
          (await response.json()) as
            StockArticlesResponse;

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Impossible de récupérer les articles du stock."
          );
        }

        const alreadyLinkedIds =
          new Set(
            articles
              .map(
                (article) =>
                  article.medical_item?.id
              )
              .filter(
                (
                  id
                ): id is string =>
                  Boolean(id)
              )
          );

        const availableArticles =
          (result.articles ?? [])
            .filter(
              (article) =>
                article.is_active &&
                !alreadyLinkedIds.has(
                  article.id
                )
            )
            .sort((a, b) =>
              a.name.localeCompare(
                b.name,
                "fr",
                {
                  sensitivity: "base",
                }
              )
            );

        setStockArticles(
          availableArticles
        );
      } catch (error) {
        console.error(
          "Erreur chargement stock :",
          error
        );

        setReferenceError(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setIsReferenceLoading(false);
      }
    }, [
      articles,
      getAccessToken,
      router,
    ]);

  const openReferenceModal = async () => {
    setReferenceForm({
      medicalItemId: "",
      supplierReference: "",
      packagingType: "unit",
      unitsPerBox: "",
      isPrimary: false,
      notes: "",
    });

    setArticleSearch("");
    setReferenceError("");
    setReferenceSuccess("");
    setIsReferenceOpen(true);

    await loadStockArticles();
  };

  const closeReferenceModal = () => {
    if (isReferenceSaving) {
      return;
    }

    setIsReferenceOpen(false);
    setReferenceError("");
    setReferenceSuccess("");
  };

  const handleReferenceArticleChange = (
    medicalItemId: string
  ) => {
    const selectedArticle =
      stockArticles.find(
        (article) =>
          article.id === medicalItemId
      );

    setReferenceForm(
      (current) => ({
        ...current,

        medicalItemId,

        packagingType:
          selectedArticle
            ?.packaging_type === "box"
            ? "box"
            : "unit",

        unitsPerBox:
          selectedArticle
            ?.packaging_type ===
              "box" &&
          selectedArticle
            ?.units_per_box
            ? String(
                selectedArticle
                  .units_per_box
              )
            : "",
      })
    );
  };

  const handleReferenceSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (
      !supplierId ||
      !referenceForm.medicalItemId
    ) {
      setReferenceError(
        "Sélectionne un article du stock."
      );
      return;
    }

    if (
      referenceForm.packagingType ===
        "box" &&
      (!referenceForm.unitsPerBox ||
        Number(
          referenceForm.unitsPerBox
        ) <= 0)
    ) {
      setReferenceError(
        "Le nombre d'unités par boîte est obligatoire."
      );
      return;
    }

    setIsReferenceSaving(true);
    setReferenceError("");
    setReferenceSuccess("");

    try {
      const accessToken =
        await getAccessToken();

      if (!accessToken) {
        router.replace("/");
        return;
      }

      const response =
        await fetch(
          `/api/secourisme/fournisseurs/${supplierId}/articles`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              medicalItemId:
                referenceForm
                  .medicalItemId,

              supplierReference:
                referenceForm
                  .supplierReference,

              packagingType:
                referenceForm
                  .packagingType,

              unitsPerBox:
                referenceForm
                  .packagingType ===
                "box"
                  ? Number(
                      referenceForm
                        .unitsPerBox
                    )
                  : null,

              isPrimary:
                referenceForm
                  .isPrimary,

              notes:
                referenceForm.notes,
            }),
          }
        );

      const result =
        (await response.json()) as
          CreateSupplierArticleResponse;

      if (
        !response.ok ||
        !result.article
      ) {
        throw new Error(
          result.error ??
            "La référence fournisseur n'a pas pu être ajoutée."
        );
      }

      setArticles(
        (current) =>
          [...current, result.article!]
            .sort((a, b) => {
              const nameA =
                a.medical_item
                  ?.name ?? "";

              const nameB =
                b.medical_item
                  ?.name ?? "";

              return nameA.localeCompare(
                nameB,
                "fr",
                {
                  sensitivity:
                    "base",
                }
              );
            })
      );

      setStockArticles(
        (current) =>
          current.filter(
            (article) =>
              article.id !==
              referenceForm
                .medicalItemId
          )
      );

      setReferenceSuccess(
        result.message ??
          "La référence fournisseur a été ajoutée avec succès."
      );

      window.setTimeout(() => {
        setIsReferenceOpen(false);
        setReferenceSuccess("");
      }, 700);
    } catch (error) {
      console.error(
        "Erreur ajout référence fournisseur :",
        error
      );

      setReferenceError(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setIsReferenceSaving(false);
    }
  };

  const openEditReferenceModal = (
    article: SupplierArticle
  ) => {
    setEditingArticle(article);
    setEditReferenceError("");

    setEditReferenceForm({
      supplierReference:
        article.supplier_reference ?? "",
      packagingType:
        article.packaging_type === "box"
          ? "box"
          : "unit",
      unitsPerBox:
        article.packaging_type === "box" &&
        article.units_per_box
          ? String(article.units_per_box)
          : "",
      isPrimary: article.is_primary,
      notes: article.notes ?? "",
    });
  };

  const closeEditReferenceModal = () => {
    if (isEditReferenceSaving) {
      return;
    }

    setEditingArticle(null);
    setEditReferenceError("");
  };

  const handleEditReferenceSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const medicalItemId =
      editingArticle?.medical_item?.id;

    if (!medicalItemId || !supplierId) {
      setEditReferenceError(
        "La référence fournisseur est invalide."
      );
      return;
    }

    if (
      editReferenceForm.packagingType ===
        "box" &&
      (!editReferenceForm.unitsPerBox ||
        Number(
          editReferenceForm.unitsPerBox
        ) <= 0)
    ) {
      setEditReferenceError(
        "Le nombre d'unités par boîte est obligatoire."
      );
      return;
    }

    setIsEditReferenceSaving(true);
    setEditReferenceError("");

    try {
      const accessToken =
        await getAccessToken();

      if (!accessToken) {
        router.replace("/");
        return;
      }

      const response = await fetch(
        `/api/secourisme/articles/${medicalItemId}/fournisseurs`,
        {
          method: "PATCH",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            supplierId,
            supplierReference:
              editReferenceForm
                .supplierReference,
            packagingType:
              editReferenceForm
                .packagingType,
            unitsPerBox:
              editReferenceForm
                .packagingType === "box"
                ? Number(
                    editReferenceForm
                      .unitsPerBox
                  )
                : null,
            isPrimary:
              editReferenceForm.isPrimary,
            notes:
              editReferenceForm.notes,
          }),
        }
      );

      const result =
        (await response.json()) as
          SupplierArticleMutationResponse;

      if (!response.ok) {
        throw new Error(
          result.error ??
            "La référence fournisseur n'a pas pu être modifiée."
        );
      }

      await loadSupplier();
      setEditingArticle(null);
    } catch (error) {
      console.error(
        "Erreur modification référence fournisseur :",
        error
      );

      setEditReferenceError(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setIsEditReferenceSaving(false);
    }
  };

  const handleDeleteReference = async (
    article: SupplierArticle
  ) => {
    const medicalItemId =
      article.medical_item?.id;

    if (!medicalItemId || !supplierId) {
      return;
    }

    const confirmed =
      window.confirm(
        `Supprimer la référence fournisseur pour « ${
          article.medical_item?.name ??
          "cet article"
        } » ?`
      );

    if (!confirmed) {
      return;
    }

    setDeletingArticleId(article.id);

    try {
      const accessToken =
        await getAccessToken();

      if (!accessToken) {
        router.replace("/");
        return;
      }

      const response = await fetch(
        `/api/secourisme/articles/${medicalItemId}/fournisseurs`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            supplierId,
          }),
        }
      );

      const result =
        (await response.json()) as
          SupplierArticleMutationResponse;

      if (!response.ok) {
        throw new Error(
          result.error ??
            "La référence fournisseur n'a pas pu être supprimée."
        );
      }

      setArticles((current) =>
        current.filter(
          (currentArticle) =>
            currentArticle.id !== article.id
        )
      );
    } catch (error) {
      console.error(
        "Erreur suppression référence fournisseur :",
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setDeletingArticleId(null);
    }
  };

  /*
   * =========================================================
   * CHARGEMENT
   * =========================================================
   */

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />

          <p className="mt-4 text-sm text-muted-foreground">
            Chargement du fournisseur...
          </p>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * ERREUR
   * =========================================================
   */

  if (
    errorMessage ||
    !supplier
  ) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/dashboard/secourisme/fournisseurs"
            )
          }
          className="mb-6 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          ← Retour aux fournisseurs
        </button>

        <div className="rounded-2xl border border-red-900 bg-red-950/30 p-6 text-red-300">
          {errorMessage ||
            "Fournisseur introuvable."}
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * AFFICHAGE
   * =========================================================
   */

  return (
    <div className="app-page">
      <SecourismeSidebar
        open={isSidebarOpen}
        onToggle={() =>
          setIsSidebarOpen((current) => !current)
        }
        active="fournisseurs"
      />

      <div
        className={`transition-[padding] duration-300 ${
          isSidebarOpen ? "lg:pl-72" : "lg:pl-24"
        }`}
      >
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">

      {/* RETOUR */}

      <button
        type="button"
        onClick={() =>
          router.push(
            "/dashboard/secourisme/fournisseurs"
          )
        }
        className="mb-6 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
      >
        ← Retour aux fournisseurs
      </button>

      {/* EN-TÊTE */}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-500">
            Secourisme
          </p>

          <h1 className="mt-2 text-3xl font-black text-foreground sm:text-4xl">
            {supplier.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">

            <span
              className={
                supplier.is_active
                  ? "rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-xs font-bold text-emerald-300"
                  : "rounded-full border border-red-900 bg-red-950/40 px-3 py-1 text-xs font-bold text-red-300"
              }
            >
              {supplier.is_active
                ? "Fournisseur actif"
                : "Fournisseur inactif"}
            </span>

            <span className="text-sm text-muted-foreground">
              {articles.length}{" "}
              {articles.length > 1
                ? "références"
                : "référence"}
            </span>

          </div>
        </div>

        <div className="flex flex-wrap gap-3">

          <button
            type="button"
            onClick={openEditModal}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-accent"
          >
            Modifier
          </button>

          <button
            type="button"
            onClick={() => {
              void handleDeleteSupplier();
            }}
            disabled={isDeletingSupplier}
            className="rounded-xl border border-red-400 bg-red-100 px-4 py-2.5 text-sm font-bold text-red-800 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
            title={
              articles.length > 0
                ? "Retirez d'abord les références associées."
                : "Supprimer définitivement ce fournisseur"
            }
          >
            {isDeletingSupplier
              ? "Suppression..."
              : "Supprimer"}
          </button>

          <button
            type="button"
            onClick={() => {
              void openReferenceModal();
            }}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
          >
            + Ajouter une référence
          </button>

        </div>
      </div>

      {deleteSupplierError && (
        <div className="mt-5 rounded-2xl border border-red-400 bg-red-100 p-4 text-sm font-bold text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {deleteSupplierError}
        </div>
      )}

      {/* INFORMATIONS */}

      <section className="mt-8 rounded-3xl border border-border bg-card p-6">

        <div className="mb-6">
          <h2 className="text-xl font-black text-foreground">
            Informations du fournisseur
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Coordonnées et informations de contact.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

          <Information
            label="Contact"
            value={supplier.contact_name}
          />

          <Information
            label="Téléphone"
            value={supplier.phone}
          />

          <Information
            label="E-mail"
            value={supplier.email}
          />

          <Information
            label="Site internet"
            value={supplier.website}
          />

          <Information
            label="Adresse"
            value={supplier.address}
          />

        </div>

        {supplier.notes && (
          <div className="mt-6 border-t border-border pt-6">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Observations
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {supplier.notes}
            </p>
          </div>
        )}

      </section>

      {/* ARTICLES / RÉFÉRENCES */}

      <section className="mt-8">

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <h2 className="text-2xl font-black text-foreground">
              Matériel référencé
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Articles disponibles chez{" "}
              {supplier.name}.
            </p>
          </div>

          <div className="rounded-xl bg-card px-4 py-2 text-sm font-semibold text-muted-foreground">
            {articles.length}{" "}
            {articles.length > 1
              ? "articles"
              : "article"}
          </div>

        </div>

        {articles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl">
              📦
            </div>

            <h3 className="mt-5 text-lg font-black text-foreground">
              Aucun matériel référencé
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Aucun article du stock pharmacie
              n&apos;est encore associé à ce
              fournisseur.
            </p>

            <button
              type="button"
              onClick={() => {
                void openReferenceModal();
              }}
              className="mt-6 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700"
            >
              + Ajouter une référence
            </button>

          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border bg-card">

            <div className="overflow-x-auto">

              <table className="w-full min-w-[900px]">

                <thead className="border-b border-border bg-surface-soft">

                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">

                    <th className="px-5 py-4">
                      Matériel
                    </th>

                    <th className="px-5 py-4">
                      Catégorie
                    </th>

                    <th className="px-5 py-4">
                      Référence
                    </th>

                    <th className="px-5 py-4">
                      Conditionnement
                    </th>

                    <th className="px-5 py-4 text-right">
                      Stock
                    </th>

                    <th className="px-5 py-4">
                      Fournisseur
                    </th>

                    <th className="px-5 py-4 text-right">
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-800">

                  {articles.map(
                    (article) => {
                      const item =
                        article.medical_item;

                      if (!item) {
                        return null;
                      }

                      const isLowStock =
                        item.quantity <=
                        item.minimum_quantity;

                      return (
                        <tr
                          key={article.id}
                          className="transition hover:bg-accent/40"
                        >

                          <td className="px-5 py-4">

                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/dashboard/secourisme/stock/${item.id}`
                                )
                              }
                              className="text-left font-bold text-foreground transition hover:text-red-400"
                            >
                              {item.name}
                            </button>

                          </td>

                          <td className="px-5 py-4 text-sm text-muted-foreground">
                            {item.category
                              ?.label ??
                              "Non classé"}
                          </td>

                          <td className="px-5 py-4">

                            <span className="rounded-lg bg-slate-950 px-2.5 py-1.5 font-mono text-sm text-muted-foreground">
                              {article.supplier_reference ||
                                "—"}
                            </span>

                          </td>

                          <td className="px-5 py-4 text-sm text-muted-foreground">

                            {article.packaging_type ===
                            "box"
                              ? `Boîte${
                                  article.units_per_box
                                    ? ` de ${article.units_per_box}`
                                    : ""
                                }`
                              : article.packaging_type ===
                                  "unit"
                                ? "À l'unité"
                                : "—"}

                          </td>

                          <td className="px-5 py-4 text-right">

                            <span
                              className={
                                isLowStock
                                  ? "font-black text-red-400"
                                  : "font-black text-emerald-400"
                              }
                            >
                              {item.quantity}
                            </span>

                          </td>

                          <td className="px-5 py-4">

                            {article.is_primary ? (
                              <span className="rounded-full border border-blue-800 bg-blue-950/40 px-3 py-1 text-xs font-bold text-blue-300">
                                Principal
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Secondaire
                              </span>
                            )}

                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditReferenceModal(
                                    article
                                  )
                                }
                                className="rounded-lg border border-border bg-slate-950 px-3 py-2 text-xs font-bold text-foreground transition hover:border-slate-600 hover:bg-accent"
                              >
                                Modifier
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  void handleDeleteReference(
                                    article
                                  );
                                }}
                                disabled={
                                  deletingArticleId ===
                                  article.id
                                }
                                className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingArticleId ===
                                article.id
                                  ? "Suppression..."
                                  : "Supprimer"}
                              </button>
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

      {isReferenceOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeReferenceModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-slate-950 p-6 shadow-2xl sm:p-8">

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-500">
                  Référence fournisseur
                </p>

                <h2 className="mt-2 text-2xl font-black text-foreground">
                  Ajouter un matériel chez {supplier.name}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Sélectionne un article déjà présent dans le stock pharmacie.
                </p>
              </div>

              <button
                type="button"
                onClick={closeReferenceModal}
                disabled={isReferenceSaving}
                className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Fermer
              </button>
            </div>

            <form
              onSubmit={handleReferenceSubmit}
              className="mt-6 space-y-5"
            >
              <div>
                <label
                  htmlFor="reference-search"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Rechercher un matériel
                </label>

                <input
                  id="reference-search"
                  type="text"
                  value={articleSearch}
                  onChange={(event) =>
                    setArticleSearch(
                      event.target.value
                    )
                  }
                  placeholder="Ex. Compresses, masque O2..."
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition placeholder:text-slate-600 focus:border-red-600"
                />
              </div>

              <div>
                <label
                  htmlFor="reference-item"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Article du stock *
                </label>

                {isReferenceLoading ? (
                  <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    Chargement des articles...
                  </div>
                ) : (
                  <select
                    id="reference-item"
                    required
                    value={
                      referenceForm
                        .medicalItemId
                    }
                    onChange={(event) =>
                      handleReferenceArticleChange(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                  >
                    <option value="">
                      Sélectionner un article
                    </option>

                    {stockArticles
                      .filter(
                        (article) => {
                          const search =
                            articleSearch
                              .trim()
                              .toLowerCase();

                          if (!search) {
                            return true;
                          }

                          const category =
                            getStockArticleCategory(
                              article
                            );

                          return (
                            article.name
                              .toLowerCase()
                              .includes(
                                search
                              ) ||
                            category?.label
                              .toLowerCase()
                              .includes(
                                search
                              )
                          );
                        }
                      )
                      .map(
                        (article) => {
                          const category =
                            getStockArticleCategory(
                              article
                            );

                          return (
                            <option
                              key={
                                article.id
                              }
                              value={
                                article.id
                              }
                            >
                              {article.name}
                              {" — "}
                              {category
                                ?.label ??
                                "Sans catégorie"}
                              {" — stock : "}
                              {article.quantity}
                            </option>
                          );
                        }
                      )}
                  </select>
                )}

                {!isReferenceLoading &&
                  stockArticles.length ===
                    0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Aucun article actif du stock n'est disponible pour une nouvelle association avec ce fournisseur.
                    </p>
                  )}
              </div>

              {referenceForm.medicalItemId && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  {(() => {
                    const selected =
                      stockArticles.find(
                        (article) =>
                          article.id ===
                          referenceForm
                            .medicalItemId
                      );

                    if (!selected) {
                      return null;
                    }

                    const category =
                      getStockArticleCategory(
                        selected
                      );

                    return (
                      <div className="grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Catégorie
                          </p>
                          <p className="mt-1 font-semibold text-foreground">
                            {category?.label ??
                              "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Stock
                          </p>
                          <p className="mt-1 font-semibold text-foreground">
                            {selected.quantity}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Conditionnement stock
                          </p>
                          <p className="mt-1 font-semibold text-foreground">
                            {selected.packaging_type ===
                            "box"
                              ? `Boîte${
                                  selected.units_per_box
                                    ? ` de ${selected.units_per_box}`
                                    : ""
                                }`
                              : "À l'unité"}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label
                  htmlFor="supplier-reference"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Référence fournisseur
                </label>

                <input
                  id="supplier-reference"
                  type="text"
                  value={
                    referenceForm
                      .supplierReference
                  }
                  onChange={(event) =>
                    setReferenceForm(
                      (current) => ({
                        ...current,
                        supplierReference:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Ex. CMP-100"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 font-mono text-foreground outline-none transition placeholder:text-slate-600 focus:border-red-600"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="supplier-packaging"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Conditionnement
                  </label>

                  <select
                    id="supplier-packaging"
                    value={
                      referenceForm
                        .packagingType
                    }
                    onChange={(event) =>
                      setReferenceForm(
                        (current) => ({
                          ...current,
                          packagingType:
                            event.target.value,
                          unitsPerBox:
                            event.target
                              .value ===
                            "box"
                              ? current
                                  .unitsPerBox
                              : "",
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                  >
                    <option value="unit">
                      À l'unité
                    </option>
                    <option value="box">
                      Boîte
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="supplier-units-box"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Unités par boîte
                  </label>

                  <input
                    id="supplier-units-box"
                    type="number"
                    min={1}
                    step={1}
                    disabled={
                      referenceForm
                        .packagingType !==
                      "box"
                    }
                    value={
                      referenceForm
                        .unitsPerBox
                    }
                    onChange={(event) =>
                      setReferenceForm(
                        (current) => ({
                          ...current,
                          unitsPerBox:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4">
                <input
                  type="checkbox"
                  checked={
                    referenceForm
                      .isPrimary
                  }
                  onChange={(event) =>
                    setReferenceForm(
                      (current) => ({
                        ...current,
                        isPrimary:
                          event.target.checked,
                      })
                    )
                  }
                  className="mt-0.5 h-4 w-4 accent-red-600"
                />

                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    Fournisseur principal pour cet article
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Si un autre fournisseur était déjà principal pour cet article, il deviendra secondaire.
                  </span>
                </span>
              </label>

              <div>
                <label
                  htmlFor="supplier-reference-notes"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Observations
                </label>

                <textarea
                  id="supplier-reference-notes"
                  rows={3}
                  value={
                    referenceForm.notes
                  }
                  onChange={(event) =>
                    setReferenceForm(
                      (current) => ({
                        ...current,
                        notes:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                />
              </div>

              {referenceError && (
                <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-semibold text-red-300">
                  {referenceError}
                </div>
              )}

              {referenceSuccess && (
                <div className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm font-semibold text-emerald-300">
                  {referenceSuccess}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeReferenceModal}
                  disabled={isReferenceSaving}
                  className="rounded-xl border border-border px-5 py-3 text-sm font-bold text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={
                    isReferenceSaving ||
                    isReferenceLoading ||
                    !referenceForm
                      .medicalItemId
                  }
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isReferenceSaving
                    ? "Ajout..."
                    : "Ajouter la référence"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {editingArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeEditReferenceModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-slate-950 p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-500">
                  Référence fournisseur
                </p>

                <h2 className="mt-2 text-2xl font-black text-foreground">
                  Modifier{" "}
                  {editingArticle.medical_item
                    ?.name ?? "le matériel"}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Fournisseur : {supplier.name}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeEditReferenceModal
                }
                disabled={
                  isEditReferenceSaving
                }
                className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Fermer
              </button>
            </div>

            <form
              onSubmit={
                handleEditReferenceSubmit
              }
              className="mt-6 space-y-5"
            >
              <div>
                <label
                  htmlFor="edit-supplier-reference"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Référence fournisseur
                </label>

                <input
                  id="edit-supplier-reference"
                  type="text"
                  value={
                    editReferenceForm
                      .supplierReference
                  }
                  onChange={(event) =>
                    setEditReferenceForm(
                      (current) => ({
                        ...current,
                        supplierReference:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 font-mono text-foreground outline-none transition focus:border-red-600"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-supplier-packaging"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Conditionnement
                  </label>

                  <select
                    id="edit-supplier-packaging"
                    value={
                      editReferenceForm
                        .packagingType
                    }
                    onChange={(event) =>
                      setEditReferenceForm(
                        (current) => ({
                          ...current,
                          packagingType:
                            event.target
                              .value,
                          unitsPerBox:
                            event.target
                              .value ===
                            "box"
                              ? current
                                  .unitsPerBox
                              : "",
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                  >
                    <option value="unit">
                      À l&apos;unité
                    </option>
                    <option value="box">
                      Boîte
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="edit-supplier-units-box"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Unités par boîte
                  </label>

                  <input
                    id="edit-supplier-units-box"
                    type="number"
                    min={1}
                    step={1}
                    disabled={
                      editReferenceForm
                        .packagingType !==
                      "box"
                    }
                    value={
                      editReferenceForm
                        .unitsPerBox
                    }
                    onChange={(event) =>
                      setEditReferenceForm(
                        (current) => ({
                          ...current,
                          unitsPerBox:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4">
                <input
                  type="checkbox"
                  checked={
                    editReferenceForm
                      .isPrimary
                  }
                  onChange={(event) =>
                    setEditReferenceForm(
                      (current) => ({
                        ...current,
                        isPrimary:
                          event.target
                            .checked,
                      })
                    )
                  }
                  className="mt-0.5 h-4 w-4 accent-red-600"
                />

                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    Fournisseur principal
                    pour cet article
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Si un autre fournisseur
                    était principal, il
                    deviendra secondaire.
                  </span>
                </span>
              </label>

              <div>
                <label
                  htmlFor="edit-reference-notes"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Observations
                </label>

                <textarea
                  id="edit-reference-notes"
                  rows={4}
                  value={
                    editReferenceForm.notes
                  }
                  onChange={(event) =>
                    setEditReferenceForm(
                      (current) => ({
                        ...current,
                        notes:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                />
              </div>

              {editReferenceError && (
                <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-semibold text-red-300">
                  {editReferenceError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={
                    closeEditReferenceModal
                  }
                  disabled={
                    isEditReferenceSaving
                  }
                  className="rounded-xl border border-border px-5 py-3 text-sm font-bold text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={
                    isEditReferenceSaving
                  }
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEditReferenceSaving
                    ? "Enregistrement..."
                    : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeEditModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-slate-950 p-6 shadow-2xl sm:p-8">

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-500">
                  Fournisseur
                </p>

                <h2 className="mt-2 text-2xl font-black text-foreground">
                  Modifier les informations
                </h2>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={isSaving}
                className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Fermer
              </button>
            </div>

            <form
              onSubmit={handleEditSubmit}
              className="mt-6 space-y-5"
            >
              <div>
                <label
                  htmlFor="supplier-name"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Nom du fournisseur *
                </label>

                <input
                  id="supplier-name"
                  type="text"
                  required
                  maxLength={150}
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        name:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition placeholder:text-slate-600 focus:border-red-600"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="supplier-contact"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Contact
                  </label>

                  <input
                    id="supplier-contact"
                    type="text"
                    value={editForm.contactName}
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          contactName:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="supplier-phone"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Téléphone
                  </label>

                  <input
                    id="supplier-phone"
                    type="text"
                    value={editForm.phone}
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          phone:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="supplier-email"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    E-mail
                  </label>

                  <input
                    id="supplier-email"
                    type="email"
                    value={editForm.email}
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          email:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="supplier-website"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Site internet
                  </label>

                  <input
                    id="supplier-website"
                    type="text"
                    value={editForm.website}
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          website:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="supplier-address"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Adresse
                </label>

                <textarea
                  id="supplier-address"
                  rows={3}
                  value={editForm.address}
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        address:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                />
              </div>

              <div>
                <label
                  htmlFor="supplier-notes"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Observations
                </label>

                <textarea
                  id="supplier-notes"
                  rows={4}
                  value={editForm.notes}
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        notes:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        isActive:
                          event.target.checked,
                      })
                    )
                  }
                  className="h-4 w-4 accent-red-600"
                />

                <span className="text-sm font-semibold text-foreground">
                  Fournisseur actif
                </span>
              </label>

              {editError && (
                <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-semibold text-red-300">
                  {editError}
                </div>
              )}

              {editSuccess && (
                <div className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm font-semibold text-emerald-300">
                  {editSuccess}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isSaving}
                  className="rounded-xl border border-border px-5 py-3 text-sm font-bold text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving
                    ? "Enregistrement..."
                    : "Enregistrer"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
}

function Information({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-semibold text-foreground">
        {value?.trim() || "—"}
      </p>
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
          >
            {open ? (
              <ChevronLeft size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
          </button>
        </div>

        <nav className="space-y-5 overflow-y-auto">
          <SidebarSection title="Navigation" open={open}>
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

          <SidebarSection title="Pharmacie" open={open}>
            <SidebarLink
              href="/dashboard/secourisme/alertes"
              icon={BellRing}
              label="Alertes"
              open={open}
              active={active === "alertes"}
            />
            <SidebarLink
              href="/dashboard/secourisme/stock"
              icon={Pill}
              label="Stock pharmacie"
              open={open}
              active={active === "stock"}
            />
            <SidebarLink
              href="/dashboard/secourisme/peremptions"
              icon={CalendarClock}
              label="Péremptions"
              open={open}
              active={active === "peremptions"}
            />
            <SidebarLink
              href="/dashboard/secourisme/fournisseurs"
              icon={Truck}
              label="Fournisseurs"
              open={open}
              active={active === "fournisseurs"}
            />
            <SidebarLink
              href="/dashboard/secourisme/categories"
              icon={Tags}
              label="Catégories"
              open={open}
              active={active === "categories"}
            />
          </SidebarSection>

          <SidebarSection title="Suivi" open={open}>
            <SidebarLink
              href="/dashboard/secourisme/stock"
              icon={Boxes}
              label="Articles"
              open={open}
            />
            <SidebarLink
              href="/dashboard/secourisme/mouvements"
              icon={Package}
              label="Mouvements"
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
