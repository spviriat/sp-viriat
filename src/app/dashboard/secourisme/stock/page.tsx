"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

import {
  Ambulance,
  ArchiveRestore,
  ArrowLeftRight,
  BellRing,
  Boxes,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  History,
  LayoutDashboard,
  MapPin,
  Menu,
  Minus,
  MoreHorizontal,
  Package,
  PackageCheck,
  Pencil,
  Pill,
  Plus,
  Search,
  Tags,
  Trash2,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

type Category = {
  id: number;
  code: string;
  label: string;
  display_order: number;
  is_active: boolean;
};

type ArticleCategory =
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

type Article = {
  id: string;
  name: string;
  description: string | null;

  category_id: number | null;

  medical_categories:
    ArticleCategory;

  packaging_type:
    "unit" | "box" | string | null;

  units_per_box: number | null;

  quantity: number;
  minimum_quantity: number;

  location: string | null;
  notes: string | null;

  has_expiration: boolean;
  is_active: boolean;

  created_at?: string;
  updated_at?: string;

  suppliers?: unknown[];
  expirations?: unknown[];

  alerts?: {
    low_stock?: boolean;
  };
};

type ArticlesResponse = {
  articles?: Article[];

  permissions?: {
    canRead: boolean;
    canWrite: boolean;
  };

  error?: string;
};

type CategoriesResponse = {
  categories?: Category[];

  permissions?: {
    canRead: boolean;
    canWrite: boolean;
  };

  error?: string;
};

type CreateArticleResponse = {
  article?: Article;
  message?: string;
  error?: string;
};

type UpdateArticleResponse = {
  article?: Partial<Article> & {
    id: string;
    is_active?: boolean;
  };
  message?: string;
  error?: string;
};

type StockMovement = {
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
};

type MovementsResponse = {
  article?: Article;
  movements?: StockMovement[];
  permissions?: {
    canRead: boolean;
    canWrite: boolean;
  };
  error?: string;
};

type CreateMovementResponse = {
  article?: Article;
  movement?: StockMovement;
  message?: string;
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

type CreateExpirationResponse = {
  expiration?: ExpirationLot;
  remainingUnassignedQuantity?: number;
  message?: string;
  error?: string;
};

type DisposeExpiredResponse = {
  article?: Article;
  movement?: StockMovement;
  disposed?: {
    expirationId: string;
    quantity: number;
    expirationDate: string;
  };
  message?: string;
  error?: string;
};

type ArticleForm = {
  name: string;
  categoryId: string;
  description: string;

  packagingType:
    "unit" | "box";

  unitsPerBox: string;

  quantity: string;
  minimumQuantity: string;

  location: string;
  notes: string;

  hasExpiration: boolean;
};

/*
 * =========================================================
 * PAGE
 * =========================================================
 */

export default function StockPharmaciePage() {
  const router = useRouter();

  const [
    articles,
    setArticles,
  ] = useState<Article[]>([]);

  const [
    categories,
    setCategories,
  ] = useState<Category[]>([]);

  const [
    canWrite,
    setCanWrite,
  ] = useState(false);

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(true);

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
    categoryFilter,
    setCategoryFilter,
  ] = useState("all");

  const [
    stockFilter,
    setStockFilter,
  ] = useState<
    "all" | "low" | "ok"
  >("all");

  const [
    stockTab,
    setStockTab,
  ] = useState<"active" | "removed">(
    "active"
  );

  const [
    editArticle,
    setEditArticle,
  ] = useState<Article | null>(null);

  const [
    editForm,
    setEditForm,
  ] = useState<ArticleForm>({
    name: "",
    categoryId: "",
    description: "",
    packagingType: "unit",
    unitsPerBox: "",
    quantity: "0",
    minimumQuantity: "0",
    location: "",
    notes: "",
    hasExpiration: false,
  });

  const [
    isEditSaving,
    setIsEditSaving,
  ] = useState(false);

  const [
    editError,
    setEditError,
  ] = useState("");

  const [
    editSuccess,
    setEditSuccess,
  ] = useState("");

  const [
    articleActionId,
    setArticleActionId,
  ] = useState<string | null>(null);

  const [
    articleActionError,
    setArticleActionError,
  ] = useState("");

  const [
    openActionMenuId,
    setOpenActionMenuId,
  ] = useState<string | null>(null);

  const [
    isCreateOpen,
    setIsCreateOpen,
  ] = useState(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    formError,
    setFormError,
  ] = useState("");

  const [
    formSuccess,
    setFormSuccess,
  ] = useState("");

  const [
    form,
    setForm,
  ] = useState<ArticleForm>({
    name: "",
    categoryId: "",
    description: "",

    packagingType: "unit",
    unitsPerBox: "",

    quantity: "0",
    minimumQuantity: "0",

    location: "",
    notes: "",

    hasExpiration: false,
  });

  const [
    movementArticle,
    setMovementArticle,
  ] = useState<Article | null>(null);

  const [
    movementType,
    setMovementType,
  ] = useState<"entry" | "exit">(
    "entry"
  );

  const [
    movementQuantity,
    setMovementQuantity,
  ] = useState("");

  const [
    movementReason,
    setMovementReason,
  ] = useState("");

  const [
    movementError,
    setMovementError,
  ] = useState("");

  const [
    movementSuccess,
    setMovementSuccess,
  ] = useState("");

  const [
    isMovementSaving,
    setIsMovementSaving,
  ] = useState(false);

  const [
    historyArticle,
    setHistoryArticle,
  ] = useState<Article | null>(null);

  const [
    movements,
    setMovements,
  ] = useState<StockMovement[]>([]);

  const [
    isHistoryLoading,
    setIsHistoryLoading,
  ] = useState(false);

  const [
    historyError,
    setHistoryError,
  ] = useState("");

  const [
    expirationArticle,
    setExpirationArticle,
  ] = useState<Article | null>(null);

  const [
    expirationLots,
    setExpirationLots,
  ] = useState<ExpirationLot[]>([]);

  const [
    expirationSummary,
    setExpirationSummary,
  ] = useState<ExpirationSummary | null>(
    null
  );

  const [
    isExpirationLoading,
    setIsExpirationLoading,
  ] = useState(false);

  const [
    expirationError,
    setExpirationError,
  ] = useState("");

  const [
    expirationQuantity,
    setExpirationQuantity,
  ] = useState("");

  const [
    expirationDate,
    setExpirationDate,
  ] = useState("");

  const [
    expirationNotes,
    setExpirationNotes,
  ] = useState("");

  const [
    isExpirationSaving,
    setIsExpirationSaving,
  ] = useState(false);

  const [
    expirationSuccess,
    setExpirationSuccess,
  ] = useState("");

  const [
    disposingExpirationId,
    setDisposingExpirationId,
  ] = useState<string | null>(null);

  /*
   * =========================================================
   * TOKEN
   * =========================================================
   */

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

  /*
   * =========================================================
   * CATÉGORIE D'UN ARTICLE
   * =========================================================
   */

  const getArticleCategory = (
    article: Article
  ) => {
    const category =
      article.medical_categories;

    if (!category) {
      return null;
    }

    if (Array.isArray(category)) {
      return (
        category[0] ?? null
      );
    }

    return category;
  };

  /*
   * =========================================================
   * CHARGEMENT
   * =========================================================
   */

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

        const [
          articlesResponse,
          categoriesResponse,
        ] =
          await Promise.all([
            fetch(
              "/api/secourisme/articles",
              {
                method: "GET",

                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
                },

                cache: "no-store",
              }
            ),

            fetch(
              "/api/secourisme/categories",
              {
                method: "GET",

                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
                },

                cache: "no-store",
              }
            ),
          ]);

        const articlesResult =
          (await articlesResponse.json()) as
            ArticlesResponse;

        const categoriesResult =
          (await categoriesResponse.json()) as
            CategoriesResponse;

        if (!articlesResponse.ok) {
          throw new Error(
            articlesResult.error ??
              "Impossible de récupérer le stock pharmacie."
          );
        }

        if (!categoriesResponse.ok) {
          throw new Error(
            categoriesResult.error ??
              "Impossible de récupérer les catégories."
          );
        }

        setArticles(
          articlesResult.articles ??
            []
        );

        setCategories(
          categoriesResult.categories ??
            []
        );

        setCanWrite(
          Boolean(
            articlesResult.permissions
              ?.canWrite
          )
        );
      } catch (error) {
        console.error(
          "Erreur chargement stock :",
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

  /*
   * =========================================================
   * FILTRES
   * =========================================================
   */

  const activeCategories =
    useMemo(
      () =>
        categories
          .filter(
            (category) =>
              category.is_active
          )
          .sort(
            (a, b) =>
              a.display_order -
                b.display_order ||
              a.label.localeCompare(
                b.label,
                "fr",
                {
                  sensitivity:
                    "base",
                }
              )
          ),
      [categories]
    );

  const filteredArticles =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return articles.filter(
        (article) => {
          const category =
            getArticleCategory(
              article
            );

          const matchesTab =
            stockTab === "active"
              ? article.is_active
              : !article.is_active;

          const matchesSearch =
            !normalizedSearch ||
            article.name
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            category?.label
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            article.location
              ?.toLowerCase()
              .includes(
                normalizedSearch
              );

          const matchesCategory =
            categoryFilter ===
              "all" ||
            String(
              category?.id ?? ""
            ) ===
              categoryFilter;

          const isLowStock =
            article.quantity <=
            article.minimum_quantity;

          const matchesStock =
            stockFilter ===
              "all" ||
            (stockFilter ===
              "low" &&
              isLowStock) ||
            (stockFilter ===
              "ok" &&
              !isLowStock);

          return (
            matchesTab &&
            matchesSearch &&
            matchesCategory &&
            matchesStock
          );
        }
      );
    }, [
      articles,
      categoryFilter,
      search,
      stockFilter,
      stockTab,
    ]);

  const lowStockCount =
    useMemo(
      () =>
        articles.filter(
          (article) =>
            article.is_active &&
            article.quantity <=
              article.minimum_quantity
        ).length,
      [articles]
    );

  const activeArticleCount =
    useMemo(
      () =>
        articles.filter(
          (article) =>
            article.is_active
        ).length,
      [articles]
    );

  const removedArticleCount =
    useMemo(
      () =>
        articles.filter(
          (article) =>
            !article.is_active
        ).length,
      [articles]
    );

  /*
   * =========================================================
   * MODIFICATION / RETRAIT / RÉACTIVATION
   * =========================================================
   */

  const openEditModal = (
    article: Article
  ) => {
    setEditArticle(article);
    setEditForm({
      name: article.name,
      categoryId:
        article.category_id
          ? String(article.category_id)
          : "",
      description:
        article.description ?? "",
      packagingType:
        article.packaging_type === "box"
          ? "box"
          : "unit",
      unitsPerBox:
        article.units_per_box
          ? String(article.units_per_box)
          : "",
      quantity:
        String(article.quantity),
      minimumQuantity:
        String(
          article.minimum_quantity
        ),
      location:
        article.location ?? "",
      notes:
        article.notes ?? "",
      hasExpiration:
        article.has_expiration,
    });
    setEditError("");
    setEditSuccess("");
  };

  const closeEditModal = () => {
    if (isEditSaving) {
      return;
    }

    setEditArticle(null);
    setEditError("");
    setEditSuccess("");
  };

  const saveArticleChanges =
    async (
      event:
        React.FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (!editArticle) {
        return;
      }

      const categoryId =
        Number(editForm.categoryId);

      const minimumQuantity =
        Number(
          editForm.minimumQuantity
        );

      const unitsPerBox =
        editForm.packagingType ===
        "box"
          ? Number(
              editForm.unitsPerBox
            )
          : null;

      if (!editForm.name.trim()) {
        setEditError(
          "Le nom du matériel est obligatoire."
        );
        return;
      }

      if (
        !Number.isInteger(categoryId) ||
        categoryId <= 0
      ) {
        setEditError(
          "Sélectionne une catégorie."
        );
        return;
      }

      if (
        !Number.isInteger(
          minimumQuantity
        ) ||
        minimumQuantity < 0
      ) {
        setEditError(
          "Le seuil minimum doit être un entier supérieur ou égal à 0."
        );
        return;
      }

      if (
        editForm.packagingType ===
          "box" &&
        (!Number.isInteger(
          unitsPerBox
        ) ||
          !unitsPerBox ||
          unitsPerBox <= 0)
      ) {
        setEditError(
          "Le nombre d'unités par boîte est obligatoire."
        );
        return;
      }

      setIsEditSaving(true);
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
            `/api/secourisme/articles/${editArticle.id}`,
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
                  editForm.name.trim(),
                categoryId,
                description:
                  editForm.description,
                packagingType:
                  editForm.packagingType,
                unitsPerBox,
                quantity:
                  editArticle.quantity,
                minimumQuantity,
                location:
                  editForm.location,
                notes:
                  editForm.notes,
                hasExpiration:
                  editForm.hasExpiration,
                isActive:
                  editArticle.is_active,
              }),
            }
          );

        const result =
          (await response.json()) as
            UpdateArticleResponse;

        if (
          !response.ok ||
          !result.article
        ) {
          throw new Error(
            result.error ??
              "L'article n'a pas pu être modifié."
          );
        }

        await loadData();

        setEditSuccess(
          result.message ??
            "L'article a été modifié avec succès."
        );

        window.setTimeout(
          () => {
            setEditArticle(null);
            setEditSuccess("");
          },
          700
        );
      } catch (error) {
        setEditError(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setIsEditSaving(false);
      }
    };

  const retireArticle =
    async (article: Article) => {
      const confirmed =
        window.confirm(
          `Retirer "${article.name}" du stock actif ?\n\nL'article restera dans les historiques et pourra être réactivé.`
        );

      if (!confirmed) {
        return;
      }

      setArticleActionId(
        article.id
      );
      setArticleActionError("");

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          router.replace("/");
          return;
        }

        const response =
          await fetch(
            `/api/secourisme/articles/${article.id}`,
            {
              method: "DELETE",
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            }
          );

        const result =
          (await response.json()) as
            UpdateArticleResponse;

        if (!response.ok) {
          throw new Error(
            result.error ??
              "L'article n'a pas pu être retiré."
          );
        }

        setArticles((current) =>
          current.map((item) =>
            item.id === article.id
              ? {
                  ...item,
                  is_active: false,
                }
              : item
          )
        );
      } catch (error) {
        setArticleActionError(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setArticleActionId(null);
      }
    };

  const reactivateArticle =
    async (article: Article) => {
      setArticleActionId(
        article.id
      );
      setArticleActionError("");

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          router.replace("/");
          return;
        }

        const response =
          await fetch(
            `/api/secourisme/articles/${article.id}`,
            {
              method: "PATCH",
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                name: article.name,
                categoryId:
                  article.category_id,
                description:
                  article.description,
                packagingType:
                  article.packaging_type ===
                  "box"
                    ? "box"
                    : "unit",
                unitsPerBox:
                  article.units_per_box,
                quantity:
                  article.quantity,
                minimumQuantity:
                  article.minimum_quantity,
                location:
                  article.location,
                notes:
                  article.notes,
                hasExpiration:
                  article.has_expiration,
                isActive: true,
              }),
            }
          );

        const result =
          (await response.json()) as
            UpdateArticleResponse;

        if (!response.ok) {
          throw new Error(
            result.error ??
              "L'article n'a pas pu être réactivé."
          );
        }

        await loadData();
      } catch (error) {
        setArticleActionError(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setArticleActionId(null);
      }
    };

  /*
   * =========================================================
   * AJOUT ARTICLE
   * =========================================================
   */

  const resetForm = () => {
    setForm({
      name: "",
      categoryId:
        activeCategories[0]
          ? String(
              activeCategories[0]
                .id
            )
          : "",
      description: "",

      packagingType: "unit",
      unitsPerBox: "",

      quantity: "0",
      minimumQuantity: "0",

      location: "",
      notes: "",

      hasExpiration: false,
    });

    setFormError("");
    setFormSuccess("");
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    if (isSaving) {
      return;
    }

    setIsCreateOpen(false);
    setFormError("");
    setFormSuccess("");
  };

  const handleCreateSubmit =
    async (
      event:
        React.FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      setFormError("");
      setFormSuccess("");

      const categoryId =
        Number(form.categoryId);

      const quantity =
        Number(form.quantity);

      const minimumQuantity =
        Number(
          form.minimumQuantity
        );

      const unitsPerBox =
        form.packagingType ===
          "box"
          ? Number(
              form.unitsPerBox
            )
          : null;

      if (!form.name.trim()) {
        setFormError(
          "Le nom du matériel est obligatoire."
        );
        return;
      }

      if (
        !Number.isInteger(
          categoryId
        ) ||
        categoryId <= 0
      ) {
        setFormError(
          "Sélectionne une catégorie."
        );
        return;
      }

      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity < 0
      ) {
        setFormError(
          "La quantité en stock doit être un entier supérieur ou égal à 0."
        );
        return;
      }

      if (
        !Number.isInteger(
          minimumQuantity
        ) ||
        minimumQuantity < 0
      ) {
        setFormError(
          "Le seuil minimum doit être un entier supérieur ou égal à 0."
        );
        return;
      }

      if (
        form.packagingType ===
          "box" &&
        (!Number.isInteger(
          unitsPerBox
        ) ||
          !unitsPerBox ||
          unitsPerBox <= 0)
      ) {
        setFormError(
          "Le nombre d'unités par boîte est obligatoire."
        );
        return;
      }

      setIsSaving(true);

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
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  name:
                    form.name,

                  categoryId,

                  description:
                    form.description,

                  packagingType:
                    form.packagingType,

                  unitsPerBox,

                  quantity,

                  minimumQuantity,

                  location:
                    form.location,

                  notes:
                    form.notes,

                  hasExpiration:
                    form.hasExpiration,

                  suppliers: [],
                }),
            }
          );

        const result =
          (await response.json()) as
            CreateArticleResponse;

        if (
          !response.ok ||
          !result.article
        ) {
          throw new Error(
            result.error ??
              "Le matériel n'a pas pu être ajouté."
          );
        }

        setArticles(
          (current) =>
            [
              ...current,
              result.article!,
            ].sort(
              (a, b) =>
                a.name.localeCompare(
                  b.name,
                  "fr",
                  {
                    sensitivity:
                      "base",
                  }
                )
            )
        );

        setFormSuccess(
          result.message ??
            "Le matériel a été ajouté avec succès."
        );

        window.setTimeout(
          () => {
            setIsCreateOpen(false);
            setFormSuccess("");
          },
          700
        );
      } catch (error) {
        console.error(
          "Erreur création article :",
          error
        );

        setFormError(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setIsSaving(false);
      }
    };

  /*
   * =========================================================
   * MOUVEMENTS DE STOCK
   * =========================================================
   */

  const openMovementModal = (
    article: Article,
    type: "entry" | "exit"
  ) => {
    setMovementArticle(article);
    setMovementType(type);
    setMovementQuantity("");
    setMovementReason("");
    setMovementError("");
    setMovementSuccess("");
  };

  const closeMovementModal = () => {
    if (isMovementSaving) {
      return;
    }

    setMovementArticle(null);
    setMovementError("");
    setMovementSuccess("");
  };

  const handleMovementSubmit =
    async (
      event:
        React.FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (!movementArticle) {
        return;
      }

      const quantity =
        Number(movementQuantity);

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        setMovementError(
          "La quantité doit être un entier supérieur à 0."
        );
        return;
      }

      if (
        movementType === "exit" &&
        quantity >
          movementArticle.quantity
      ) {
        setMovementError(
          `Stock insuffisant. Quantité disponible : ${movementArticle.quantity}.`
        );
        return;
      }

      setIsMovementSaving(true);
      setMovementError("");
      setMovementSuccess("");

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          router.replace("/");
          return;
        }

        const response =
          await fetch(
            `/api/secourisme/articles/${movementArticle.id}/mouvements`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  type: movementType,
                  quantity,
                  reason:
                    movementReason,
                }),
            }
          );

        const result =
          (await response.json()) as
            CreateMovementResponse;

        if (
          !response.ok ||
          !result.article
        ) {
          throw new Error(
            result.error ??
              "Le mouvement de stock n'a pas pu être enregistré."
          );
        }

        setArticles(
          (current) =>
            current.map(
              (article) =>
                article.id ===
                movementArticle.id
                  ? {
                      ...article,
                      ...result.article!,
                    }
                  : article
            )
        );

        setMovementArticle(
          (current) =>
            current
              ? {
                  ...current,
                  ...result.article!,
                }
              : current
        );

        setMovementSuccess(
          result.message ??
            "Le mouvement de stock a été enregistré."
        );

        setMovementQuantity("");
        setMovementReason("");

        window.setTimeout(
          () => {
            setMovementArticle(null);
            setMovementSuccess("");
          },
          700
        );
      } catch (error) {
        console.error(
          "Erreur mouvement de stock :",
          error
        );

        setMovementError(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setIsMovementSaving(false);
      }
    };

  const openHistoryModal =
    async (
      article: Article
    ) => {
      setHistoryArticle(article);
      setMovements([]);
      setHistoryError("");
      setIsHistoryLoading(true);

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          router.replace("/");
          return;
        }

        const response =
          await fetch(
            `/api/secourisme/articles/${article.id}/mouvements`,
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
              "L'historique n'a pas pu être chargé."
          );
        }

        setMovements(
          result.movements ?? []
        );

        if (result.article) {
          setHistoryArticle(
            (current) =>
              current
                ? {
                    ...current,
                    ...result.article!,
                  }
                : result.article!
          );
        }
      } catch (error) {
        console.error(
          "Erreur historique stock :",
          error
        );

        setHistoryError(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setIsHistoryLoading(false);
      }
    };

  const closeHistoryModal = () => {
    setHistoryArticle(null);
    setMovements([]);
    setHistoryError("");
  };

  const formatMovementDate = (
    value: string
  ) => {
    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        dateStyle: "short",
        timeStyle: "short",
      }
    ).format(new Date(value));
  };

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
      movementType === "bag_restock" ||
      movementType ===
        "intervention_restock"
    ) {
      return "rounded-full border border-emerald-900 bg-emerald-950/40 px-2.5 py-1 text-xs font-bold text-emerald-300";
    }

    if (
      movementType === "withdrawal" ||
      movementType ===
        "expired_disposal"
    ) {
      return "rounded-full border border-red-900 bg-red-950/40 px-2.5 py-1 text-xs font-bold text-red-300";
    }

    return "rounded-full border border-border bg-card px-2.5 py-1 text-xs font-bold text-muted-foreground";
  };

  /*
   * =========================================================
   * LOTS / PÉREMPTIONS
   * =========================================================
   */

  const openExpirationModal =
    async (
      article: Article
    ) => {
      setExpirationArticle(article);
      setExpirationLots([]);
      setExpirationSummary(null);
      setExpirationError("");
      setExpirationSuccess("");
      setExpirationQuantity("");
      setExpirationDate("");
      setExpirationNotes("");
      setIsExpirationLoading(true);

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          router.replace("/");
          return;
        }

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
              "Les péremptions n'ont pas pu être chargées."
          );
        }

        setExpirationLots(
          (
            result.expirations ?? []
          ).filter(
            (lot) =>
              lot.quantity > 0
          )
        );

        setExpirationSummary(
          result.summary ?? null
        );

        if (result.article) {
          setExpirationArticle(
            (current) =>
              current
                ? {
                    ...current,
                    ...result.article!,
                  }
                : result.article!
          );
        }
      } catch (error) {
        console.error(
          "Erreur chargement péremptions :",
          error
        );

        setExpirationError(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setIsExpirationLoading(false);
      }
    };

  const closeExpirationModal = () => {
    if (
      isExpirationSaving ||
      disposingExpirationId
    ) {
      return;
    }

    setExpirationArticle(null);
    setExpirationLots([]);
    setExpirationSummary(null);
    setExpirationError("");
    setExpirationSuccess("");
    setExpirationQuantity("");
    setExpirationDate("");
    setExpirationNotes("");
  };

  const handleExpirationSubmit =
    async (
      event:
        React.FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (!expirationArticle) {
        return;
      }

      const quantity =
        Number(expirationQuantity);

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        setExpirationError(
          "La quantité du lot doit être un entier supérieur à 0."
        );
        return;
      }

      if (!expirationDate) {
        setExpirationError(
          "La date de péremption est obligatoire."
        );
        return;
      }

      if (
        expirationSummary &&
        quantity >
          expirationSummary
            .unassignedQuantity
      ) {
        setExpirationError(
          `Quantité trop élevée. ${expirationSummary.unassignedQuantity} unité(s) seulement ne sont pas encore affectée(s) à un lot.`
        );
        return;
      }

      setIsExpirationSaving(true);
      setExpirationError("");
      setExpirationSuccess("");

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          router.replace("/");
          return;
        }

        const response =
          await fetch(
            `/api/secourisme/articles/${expirationArticle.id}/expirations`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  quantity,
                  expirationDate,
                  notes:
                    expirationNotes,
                }),
            }
          );

        const result =
          (await response.json()) as
            CreateExpirationResponse;

        if (
          !response.ok ||
          !result.expiration
        ) {
          throw new Error(
            result.error ??
              "Le lot de péremption n'a pas pu être ajouté."
          );
        }

        setExpirationLots(
          (current) =>
            [
              ...current,
              result.expiration!,
            ].sort(
              (a, b) =>
                a.expiration_date.localeCompare(
                  b.expiration_date
                )
            )
        );

        setExpirationSummary(
          (current) => {
            if (!current) {
              return current;
            }

            const created =
              result.expiration!;

            const expiredQuantity =
              created.status ===
              "expired"
                ? created.quantity
                : 0;

            const within30 =
              created.status ===
              "critical"
                ? created.quantity
                : 0;

            const within90 =
              created.status ===
                "critical" ||
              created.status ===
                "soon"
                ? created.quantity
                : 0;

            return {
              ...current,

              assignedQuantity:
                current.assignedQuantity +
                created.quantity,

              unassignedQuantity:
                result
                  .remainingUnassignedQuantity ??
                Math.max(
                  current
                    .unassignedQuantity -
                    created.quantity,
                  0
                ),

              expiredQuantity:
                current.expiredQuantity +
                expiredQuantity,

              expiringWithin30Days:
                current.expiringWithin30Days +
                within30,

              expiringWithin90Days:
                current.expiringWithin90Days +
                within90,
            };
          }
        );

        setExpirationQuantity("");
        setExpirationDate("");
        setExpirationNotes("");

        setExpirationSuccess(
          result.message ??
            "Le lot de péremption a été ajouté avec succès."
        );

        window.setTimeout(
          () => {
            setExpirationSuccess("");
          },
          1200
        );
      } catch (error) {
        console.error(
          "Erreur ajout péremption :",
          error
        );

        setExpirationError(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setIsExpirationSaving(false);
      }
    };

  const handleDisposeExpiredLot =
    async (
      lot: ExpirationLot
    ) => {
      if (
        !expirationArticle ||
        lot.status !== "expired" ||
        lot.quantity <= 0
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Confirmer la destruction de ${lot.quantity} unité(s) périmée(s) de ${expirationArticle.name} ?\n\nCette action diminuera le stock et sera enregistrée dans l'historique.`
        );

      if (!confirmed) {
        return;
      }

      setDisposingExpirationId(
        lot.id
      );
      setExpirationError("");
      setExpirationSuccess("");

      try {
        const accessToken =
          await getAccessToken();

        if (!accessToken) {
          router.replace("/");
          return;
        }

        const response =
          await fetch(
            `/api/secourisme/articles/${expirationArticle.id}/expirations/${lot.id}/dispose`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            }
          );

        const result =
          (await response.json()) as
            DisposeExpiredResponse;

        if (
          !response.ok ||
          !result.article ||
          !result.disposed
        ) {
          throw new Error(
            result.error ??
              "La destruction du lot périmé n'a pas pu être enregistrée."
          );
        }

        const disposedQuantity =
          result.disposed.quantity;

        setArticles(
          (current) =>
            current.map(
              (article) =>
                article.id ===
                expirationArticle.id
                  ? {
                      ...article,
                      ...result.article!,
                    }
                  : article
            )
        );

        setExpirationArticle(
          (current) =>
            current
              ? {
                  ...current,
                  ...result.article!,
                }
              : current
        );

        setExpirationLots(
          (current) =>
            current.filter(
              (currentLot) =>
                currentLot.id !==
                lot.id
            )
        );

        setExpirationSummary(
          (current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,

              stockQuantity:
                Math.max(
                  current.stockQuantity -
                    disposedQuantity,
                  0
                ),

              assignedQuantity:
                Math.max(
                  current.assignedQuantity -
                    disposedQuantity,
                  0
                ),

              expiredQuantity:
                Math.max(
                  current.expiredQuantity -
                    disposedQuantity,
                  0
                ),
            };
          }
        );

        setExpirationSuccess(
          result.message ??
            "Le lot périmé a été détruit et enregistré dans l'historique."
        );
      } catch (error) {
        console.error(
          "Erreur destruction périmé :",
          error
        );

        setExpirationError(
          error instanceof Error
            ? error.message
            : "Une erreur est survenue."
        );
      } finally {
        setDisposingExpirationId(
          null
        );
      }
    };

  const formatExpirationDate = (
    value: string
  ) => {
    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        dateStyle: "medium",
      }
    ).format(
      new Date(
        `${value}T00:00:00`
      )
    );
  };

  const getExpirationLabel = (
    lot: ExpirationLot
  ) => {
    switch (lot.status) {
      case "expired":
        return "Expiré";

      case "critical":
        return lot.daysRemaining === 0
          ? "Expire aujourd'hui"
          : `Expire dans ${lot.daysRemaining} j`;

      case "soon":
        return `Expire dans ${lot.daysRemaining} j`;

      default:
        return "Valide";
    }
  };

  const getExpirationBadgeClass = (
    status: ExpirationStatus
  ) => {
    switch (status) {
      case "expired":
        return "rounded-full border border-red-900 bg-red-950/40 px-2.5 py-1 text-xs font-bold text-red-300";

      case "critical":
        return "rounded-full border border-orange-900 bg-orange-950/40 px-2.5 py-1 text-xs font-bold text-orange-300";

      case "soon":
        return "rounded-full border border-amber-900 bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-300";

      default:
        return "rounded-full border border-emerald-900 bg-emerald-950/40 px-2.5 py-1 text-xs font-bold text-emerald-300";
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
            Chargement du stock
            pharmacie...
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

  if (errorMessage) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/dashboard/secourisme"
            )
          }
          className="mb-6 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          ← Retour au Secourisme
        </button>

        <div className="rounded-2xl border border-red-900 bg-red-950/30 p-6 text-red-300">
          {errorMessage}
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
    <div className="min-h-screen bg-background text-foreground">

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
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">

      {/* EN-TÊTE */}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-500">
            Secourisme
          </p>

          <h1 className="mt-2 text-3xl font-black text-foreground sm:text-4xl">
            Stock pharmacie
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Gérez les articles,
            quantités, seuils minimums
            et emplacements du stock.
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={
              openCreateModal
            }
            className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-foreground transition hover:bg-red-700"
          >
            + Ajouter un article
          </button>
        )}
      </div>

      {/* INDICATEURS */}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">

        <StatCard
          label="Articles actifs"
          value={
            activeArticleCount
          }
        />

        <StatCard
          label="Stock faible"
          value={lowStockCount}
          alert={
            lowStockCount > 0
          }
        />

        <StatCard
          label="Catégories actives"
          value={
            activeCategories.length
          }
        />

      </div>

      {/* ONGLETS STOCK */}

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-2xl border border-border bg-card p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setStockTab("active");
              setStockFilter("all");
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
              stockTab === "active"
                ? "bg-emerald-950/60 text-emerald-300 shadow-sm ring-1 ring-emerald-900"
                : "text-muted-foreground hover:bg-surface-strong hover:text-foreground"
            }`}
          >
            <PackageCheck size={18} />

            Stock actif

            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                stockTab === "active"
                  ? "bg-emerald-900/60 text-emerald-200"
                  : "bg-surface-strong"
              }`}
            >
              {activeArticleCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStockTab("removed");
              setStockFilter("all");
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
              stockTab === "removed"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-muted-foreground hover:bg-surface-strong hover:text-foreground"
            }`}
          >
            <ArchiveRestore size={18} />

            Articles retirés

            <span className="rounded-full bg-surface-strong px-2 py-0.5 text-xs">
              {removedArticleCount}
            </span>
          </button>
        </div>

        {canWrite && stockTab === "active" && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-700 bg-blue-950/30 px-5 py-3 text-sm font-black text-blue-300 transition hover:bg-blue-950/60"
          >
            <Plus size={18} />
            Nouvel article
          </button>
        )}
      </div>

      {articleActionError && (
        <div className="mt-4 rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-300">
          {articleActionError}
        </div>
      )}

      {/* FILTRES */}

      <section className="mt-4 rounded-3xl border border-border bg-card p-5">

        <div className="grid gap-4 lg:grid-cols-[1fr_240px_200px]">

          <div>
            <label
              htmlFor="stock-search"
              className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Recherche
            </label>

            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />

              <input
                id="stock-search"
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Nom, catégorie, emplacement..."
                className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-4 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="stock-category"
              className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Catégorie
            </label>

            <select
              id="stock-category"
              value={
                categoryFilter
              }
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-red-600"
            >
              <option value="all">
                Toutes
              </option>

              {activeCategories.map(
                (category) => (
                  <option
                    key={
                      category.id
                    }
                    value={
                      category.id
                    }
                  >
                    {category.label}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="stock-status"
              className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Niveau de stock
            </label>

            <select
              id="stock-status"
              value={stockFilter}
              disabled={stockTab === "removed"}
              onChange={(event) =>
                setStockFilter(
                  event.target
                    .value as
                    | "all"
                    | "low"
                    | "ok"
                )
              }
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-red-600"
            >
              <option value="all">
                Tous
              </option>

              <option value="low">
                Stock faible
              </option>

              <option value="ok">
                Stock conforme
              </option>
            </select>
          </div>

        </div>

      </section>

      {/* LISTE */}

      <section className="mt-8">

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <h2 className="text-2xl font-black text-foreground">
              {stockTab === "active"
                ? "Articles"
                : "Articles retirés"}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {filteredArticles.length}{" "}
              {filteredArticles.length >
              1
                ? "articles affichés"
                : "article affiché"}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard/secourisme"
              )
            }
            className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            ← Retour au Secourisme
          </button>

        </div>

        {filteredArticles.length ===
        0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface-soft px-6 py-14 text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-2xl">
              💊
            </div>

            <h3 className="mt-5 text-lg font-black text-foreground">
              Aucun article
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Aucun matériel ne
              correspond aux filtres
              actuels.
            </p>

            {canWrite &&
              articles.length ===
                0 && (
                <button
                  type="button"
                  onClick={
                    openCreateModal
                  }
                  className="mt-6 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-foreground transition hover:bg-red-700"
                >
                  + Ajouter le
                  premier article
                </button>
              )}

          </div>
        ) : (
          <div className="overflow-visible rounded-3xl border border-border bg-card shadow-sm">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[17%]" />
                <col className="w-[10%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
              </colgroup>

              <thead className="border-b border-border bg-surface-soft">
                <tr className="text-left text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="px-3 py-4 sm:px-4">
                    Matériel
                  </th>

                  <th className="px-3 py-4 sm:px-4">
                    Catégorie
                  </th>

                  <th className="px-3 py-4 text-center sm:px-4">
                    Stock
                  </th>

                  <th className="px-3 py-4 sm:px-4">
                    Emplacement
                  </th>

                  <th className="px-3 py-4 sm:px-4">
                    État
                  </th>

                  <th className="px-3 py-4 text-right sm:px-4">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {filteredArticles.map((article) => {
                  const category =
                    getArticleCategory(article);

                  const isLowStock =
                    article.quantity <=
                    article.minimum_quantity;

                  return (
                    <tr
                      key={article.id}
                      className="group align-middle transition hover:bg-surface-soft/70"
                    >
                      <td className="px-3 py-4 sm:px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border xl:flex ${
                              article.is_active
                                ? isLowStock
                                  ? "border-red-900 bg-red-950/30 text-red-300"
                                  : "border-emerald-900 bg-emerald-950/30 text-emerald-300"
                                : "border-slate-700 bg-slate-900 text-slate-400"
                            }`}
                          >
                            <PackageCheck
                              size={17}
                              strokeWidth={1.9}
                            />
                          </div>

                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-black text-foreground"
                              title={article.name}
                            >
                              {article.name}
                            </p>

                            <p className="mt-1 truncate text-[11px] text-muted-foreground">
                              {article.packaging_type === "box"
                                ? `Boîte${
                                    article.units_per_box
                                      ? ` de ${article.units_per_box}`
                                      : ""
                                  }`
                                : "À l'unité"}
                            </p>

                            {article.has_expiration && (
                              <p className="mt-1 truncate text-[10px] font-bold text-amber-400">
                                Péremption suivie
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-4 sm:px-4">
                        <div
                          className="truncate text-xs text-muted-foreground"
                          title={
                            category?.label ??
                            "Non classé"
                          }
                        >
                          {category?.label ??
                            "Non classé"}
                        </div>
                      </td>

                      <td className="px-3 py-4 text-center sm:px-4">
                        <p
                          className={`text-lg font-black ${
                            !article.is_active
                              ? "text-muted-foreground"
                              : isLowStock
                                ? "text-red-400"
                                : "text-emerald-400"
                          }`}
                        >
                          {article.quantity}
                        </p>

                        <p className="mt-0.5 text-[9px] text-muted-foreground">
                          seuil {article.minimum_quantity}
                        </p>
                      </td>

                      <td className="px-3 py-4 sm:px-4">
                        {article.location ? (
                          <div className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin
                              size={13}
                              className="mt-0.5 hidden shrink-0 xl:block"
                            />

                            <span
                              className="line-clamp-2"
                              title={article.location}
                            >
                              {article.location}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-4 sm:px-4">
                        {!article.is_active ? (
                          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-[10px] font-black text-slate-300">
                            <ArchiveRestore
                              size={11}
                              className="hidden xl:block"
                            />
                            Retiré
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-red-900 bg-red-950/40 px-2 py-1 text-[10px] font-black text-red-300">
                            <CircleAlert
                              size={11}
                              className="hidden xl:block"
                            />
                            Stock faible
                          </span>
                        ) : (
                          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-900 bg-emerald-950/40 px-2 py-1 text-[10px] font-black text-emerald-300">
                            <PackageCheck
                              size={11}
                              className="hidden xl:block"
                            />
                            Conforme
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-4 sm:px-4">
                        <div className="relative flex flex-wrap justify-end gap-1.5">
                          {article.is_active && canWrite && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  openMovementModal(
                                    article,
                                    "entry"
                                  )
                                }
                                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-emerald-900 bg-emerald-950/30 px-2 text-[10px] font-black text-emerald-300 transition hover:bg-emerald-950/70"
                                title="Entrée de stock"
                              >
                                <Plus size={12} />
                                <span className="hidden 2xl:inline">
                                  Entrée
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openMovementModal(
                                    article,
                                    "exit"
                                  )
                                }
                                disabled={
                                  article.quantity <= 0
                                }
                                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-red-900 bg-red-950/30 px-2 text-[10px] font-black text-red-300 transition hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Sortie de stock"
                              >
                                <Minus size={12} />
                                <span className="hidden 2xl:inline">
                                  Sortie
                                </span>
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setOpenActionMenuId(
                                (current) =>
                                  current === article.id
                                    ? null
                                    : article.id
                              )
                            }
                            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 text-[10px] font-black text-foreground transition hover:bg-surface-strong"
                            aria-expanded={
                              openActionMenuId ===
                              article.id
                            }
                          >
                            <MoreHorizontal size={13} />
                            <span className="hidden xl:inline">
                              Gérer
                            </span>
                          </button>

                          {openActionMenuId ===
                            article.id && (
                            <div className="absolute right-0 top-10 z-40 w-52 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-2xl">
                              <div className="flex items-center justify-between px-3 py-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                                  Actions
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenActionMenuId(
                                      null
                                    )
                                  }
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-strong hover:text-foreground"
                                  aria-label="Fermer le menu"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              {article.is_active ? (
                                <>
                                  {canWrite && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(
                                          null
                                        );
                                        openEditModal(
                                          article
                                        );
                                      }}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition hover:bg-blue-950/30 hover:text-blue-300"
                                    >
                                      <Pencil
                                        size={15}
                                      />
                                      Modifier
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(
                                        null
                                      );
                                      void openHistoryModal(
                                        article
                                      );
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition hover:bg-surface-strong"
                                  >
                                    <History size={15} />
                                    Historique
                                  </button>

                                  {article.has_expiration && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(
                                          null
                                        );
                                        void openExpirationModal(
                                          article
                                        );
                                      }}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-amber-300 transition hover:bg-amber-950/30"
                                    >
                                      <CalendarClock
                                        size={15}
                                      />
                                      Péremptions
                                    </button>
                                  )}

                                  {canWrite && (
                                    <>
                                      <div className="my-1 border-t border-border" />

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(
                                            null
                                          );
                                          void retireArticle(
                                            article
                                          );
                                        }}
                                        disabled={
                                          articleActionId ===
                                          article.id
                                        }
                                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-300 transition hover:bg-red-950/30 disabled:opacity-50"
                                      >
                                        <Trash2
                                          size={15}
                                        />
                                        Retirer du stock
                                      </button>
                                    </>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(
                                        null
                                      );
                                      void openHistoryModal(
                                        article
                                      );
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition hover:bg-surface-strong"
                                  >
                                    <History size={15} />
                                    Historique
                                  </button>

                                  {canWrite && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(
                                          null
                                        );
                                        void reactivateArticle(
                                          article
                                        );
                                      }}
                                      disabled={
                                        articleActionId ===
                                        article.id
                                      }
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-emerald-300 transition hover:bg-emerald-950/30 disabled:opacity-50"
                                    >
                                      <ArchiveRestore
                                        size={15}
                                      />
                                      Réactiver
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </section>

      {/* MODALE PÉREMPTIONS */}

      {expirationArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeExpirationModal();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl sm:p-8">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-400">
                  Lots / Péremptions
                </p>

                <h2 className="mt-2 text-2xl font-black text-foreground">
                  {expirationArticle.name}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Répartition du stock par date de péremption.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeExpirationModal
                }
                disabled={
                  isExpirationSaving ||
                  Boolean(
                    disposingExpirationId
                  )
                }
                className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Fermer
              </button>

            </div>

            {isExpirationLoading ? (
              <div className="py-14 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-border border-t-amber-500" />

                <p className="mt-4 text-sm text-muted-foreground">
                  Chargement des lots...
                </p>
              </div>
            ) : (
              <>
                {expirationSummary && (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">

                    <ExpirationStat
                      label="Stock"
                      value={
                        expirationSummary
                          .stockQuantity
                      }
                    />

                    <ExpirationStat
                      label="Affecté aux lots"
                      value={
                        expirationSummary
                          .assignedQuantity
                      }
                    />

                    <ExpirationStat
                      label="Non affecté"
                      value={
                        expirationSummary
                          .unassignedQuantity
                      }
                      warning={
                        expirationSummary
                          .unassignedQuantity >
                        0
                      }
                    />

                    <ExpirationStat
                      label="Expiré"
                      value={
                        expirationSummary
                          .expiredQuantity
                      }
                      danger={
                        expirationSummary
                          .expiredQuantity >
                        0
                      }
                    />

                    <ExpirationStat
                      label="≤ 30 jours"
                      value={
                        expirationSummary
                          .expiringWithin30Days
                      }
                      warning={
                        expirationSummary
                          .expiringWithin30Days >
                        0
                      }
                    />

                  </div>
                )}

                {expirationError && (
                  <div className="mt-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-semibold text-red-300">
                    {expirationError}
                  </div>
                )}

                <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_340px]">

                  <section>
                    <div className="mb-4">
                      <h3 className="text-lg font-black text-foreground">
                        Lots enregistrés
                      </h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Les dates les plus proches sont affichées en premier.
                      </p>
                    </div>

                    {expirationLots.length ===
                    0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-surface-soft px-6 py-10 text-center text-sm text-muted-foreground">
                        Aucun lot de péremption enregistré.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-border">

                        <div className="overflow-x-auto">

                          <table className="w-full min-w-[620px]">

                            <thead className="border-b border-border bg-card/80">

                              <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">

                                <th className="px-4 py-3">
                                  Péremption
                                </th>

                                <th className="px-4 py-3 text-right">
                                  Quantité
                                </th>

                                <th className="px-4 py-3">
                                  État
                                </th>

                                <th className="px-4 py-3">
                                  Notes
                                </th>

                                <th className="px-4 py-3 text-right">
                                  Action
                                </th>

                              </tr>

                            </thead>

                            <tbody className="divide-y divide-slate-800">

                              {expirationLots.map(
                                (lot) => (
                                  <tr
                                    key={
                                      lot.id
                                    }
                                    className="text-sm"
                                  >

                                    <td className="whitespace-nowrap px-4 py-3 font-bold text-foreground">
                                      {formatExpirationDate(
                                        lot.expiration_date
                                      )}
                                    </td>

                                    <td className="px-4 py-3 text-right font-black text-foreground">
                                      {
                                        lot.quantity
                                      }
                                    </td>

                                    <td className="px-4 py-3">
                                      <span
                                        className={
                                          getExpirationBadgeClass(
                                            lot.status
                                          )
                                        }
                                      >
                                        {getExpirationLabel(
                                          lot
                                        )}
                                      </span>
                                    </td>

                                    <td className="max-w-[240px] px-4 py-3 text-muted-foreground">
                                      {lot.notes ||
                                        "—"}
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                      {canWrite &&
                                      lot.status ===
                                        "expired" &&
                                      lot.quantity >
                                        0 ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void handleDisposeExpiredLot(
                                              lot
                                            );
                                          }}
                                          disabled={
                                            disposingExpirationId !==
                                            null
                                          }
                                          className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {disposingExpirationId ===
                                          lot.id
                                            ? "Destruction..."
                                            : "Détruire"}
                                        </button>
                                      ) : (
                                        <span className="text-xs text-slate-600">
                                          —
                                        </span>
                                      )}
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

                  <section className="rounded-2xl border border-border bg-card p-5">

                    <h3 className="text-lg font-black text-foreground">
                      Ajouter un lot
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Cette action répartit le stock existant. Elle n&apos;augmente pas la quantité totale.
                    </p>

                    <form
                      onSubmit={
                        handleExpirationSubmit
                      }
                      className="mt-5 space-y-4"
                    >

                      <div>
                        <label
                          htmlFor="expiration-quantity"
                          className="mb-2 block text-sm font-bold text-muted-foreground"
                        >
                          Quantité *
                        </label>

                        <input
                          id="expiration-quantity"
                          type="number"
                          min={1}
                          step={1}
                          max={
                            expirationSummary
                              ?.unassignedQuantity
                          }
                          required
                          disabled={
                            !canWrite ||
                            expirationSummary
                              ?.unassignedQuantity ===
                              0
                          }
                          value={
                            expirationQuantity
                          }
                          onChange={(event) =>
                            setExpirationQuantity(
                              event.target.value
                            )
                          }
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                        />

                        <p className="mt-2 text-xs text-muted-foreground">
                          Disponible à affecter :{" "}
                          <span className="font-bold text-muted-foreground">
                            {expirationSummary
                              ?.unassignedQuantity ??
                              0}
                          </span>
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="expiration-date"
                          className="mb-2 block text-sm font-bold text-muted-foreground"
                        >
                          Date de péremption *
                        </label>

                        <input
                          id="expiration-date"
                          type="date"
                          required
                          disabled={
                            !canWrite ||
                            expirationSummary
                              ?.unassignedQuantity ===
                              0
                          }
                          value={
                            expirationDate
                          }
                          onChange={(event) =>
                            setExpirationDate(
                              event.target.value
                            )
                          }
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="expiration-notes"
                          className="mb-2 block text-sm font-bold text-muted-foreground"
                        >
                          Notes
                        </label>

                        <textarea
                          id="expiration-notes"
                          rows={3}
                          disabled={
                            !canWrite ||
                            expirationSummary
                              ?.unassignedQuantity ===
                              0
                          }
                          value={
                            expirationNotes
                          }
                          onChange={(event) =>
                            setExpirationNotes(
                              event.target.value
                            )
                          }
                          placeholder="Ex. Lot fournisseur ABC123"
                          className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-slate-600 focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </div>

                      {expirationSuccess && (
                        <div className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm font-semibold text-emerald-300">
                          {expirationSuccess}
                        </div>
                      )}

                      {canWrite ? (
                        <button
                          type="submit"
                          disabled={
                            isExpirationSaving ||
                            expirationSummary
                              ?.unassignedQuantity ===
                              0
                          }
                          className="w-full rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-foreground transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isExpirationSaving
                            ? "Ajout..."
                            : "Ajouter le lot"}
                        </button>
                      ) : (
                        <div className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
                          Consultation uniquement.
                        </div>
                      )}

                      {expirationSummary
                        ?.unassignedQuantity ===
                        0 && (
                        <p className="text-xs leading-5 text-muted-foreground">
                          Tout le stock est déjà affecté à des lots.
                        </p>
                      )}

                    </form>

                  </section>

                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* MODALE MOUVEMENT */}

      {movementArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeMovementModal();
            }
          }}
        >
          <div className="w-full max-w-xl rounded-3xl border border-border bg-background p-6 shadow-2xl sm:p-8">

            <div className="flex items-start justify-between gap-4">

              <div>
                <p
                  className={
                    movementType ===
                    "entry"
                      ? "text-sm font-bold uppercase tracking-[0.2em] text-emerald-400"
                      : "text-sm font-bold uppercase tracking-[0.2em] text-red-400"
                  }
                >
                  {movementType ===
                  "entry"
                    ? "Entrée de stock"
                    : "Sortie de stock"}
                </p>

                <h2 className="mt-2 text-2xl font-black text-foreground">
                  {movementArticle.name}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Stock actuel :{" "}
                  <span className="font-black text-foreground">
                    {
                      movementArticle.quantity
                    }
                  </span>{" "}
                  unité(s)
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeMovementModal
                }
                disabled={
                  isMovementSaving
                }
                className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Fermer
              </button>

            </div>

            <form
              onSubmit={
                handleMovementSubmit
              }
              className="mt-6 space-y-5"
            >

              <div>
                <label
                  htmlFor="movement-quantity"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Quantité *
                </label>

                <input
                  id="movement-quantity"
                  type="number"
                  min={1}
                  step={1}
                  required
                  autoFocus
                  value={
                    movementQuantity
                  }
                  onChange={(event) =>
                    setMovementQuantity(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                />

                {movementType ===
                  "exit" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Maximum disponible :{" "}
                    {
                      movementArticle.quantity
                    }
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="movement-reason"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Motif
                </label>

                <textarea
                  id="movement-reason"
                  rows={3}
                  value={
                    movementReason
                  }
                  onChange={(event) =>
                    setMovementReason(
                      event.target.value
                    )
                  }
                  placeholder={
                    movementType ===
                    "entry"
                      ? "Ex. Réception commande fournisseur"
                      : "Ex. Utilisation intervention"
                  }
                  className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition placeholder:text-slate-600 focus:border-red-600"
                />
              </div>

              {movementError && (
                <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-semibold text-red-300">
                  {movementError}
                </div>
              )}

              {movementSuccess && (
                <div className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm font-semibold text-emerald-300">
                  {movementSuccess}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={
                    closeMovementModal
                  }
                  disabled={
                    isMovementSaving
                  }
                  className="rounded-xl border border-border px-5 py-3 text-sm font-bold text-muted-foreground transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={
                    isMovementSaving
                  }
                  className={
                    movementType ===
                    "entry"
                      ? "rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-foreground transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      : "rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-foreground transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  }
                >
                  {isMovementSaving
                    ? "Enregistrement..."
                    : movementType ===
                        "entry"
                      ? "Enregistrer l'entrée"
                      : "Enregistrer la sortie"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODALE HISTORIQUE */}

      {historyArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeHistoryModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl sm:p-8">

            <div className="flex items-start justify-between gap-4">

              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-500">
                  Historique du stock
                </p>

                <h2 className="mt-2 text-2xl font-black text-foreground">
                  {historyArticle.name}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Stock actuel :{" "}
                  <span className="font-black text-foreground">
                    {
                      historyArticle.quantity
                    }
                  </span>{" "}
                  unité(s)
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeHistoryModal
                }
                className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-slate-800"
              >
                Fermer
              </button>

            </div>

            <div className="mt-6">

              {isHistoryLoading ? (
                <div className="py-12 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-border border-t-red-600" />

                  <p className="mt-4 text-sm text-muted-foreground">
                    Chargement de
                    l&apos;historique...
                  </p>
                </div>
              ) : historyError ? (
                <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-semibold text-red-300">
                  {historyError}
                </div>
              ) : movements.length ===
                0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface-soft px-6 py-10 text-center text-sm text-muted-foreground">
                  Aucun mouvement
                  enregistré pour cet
                  article.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border">

                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[760px]">

                      <thead className="border-b border-border bg-card/80">

                        <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">

                          <th className="px-4 py-3">
                            Date
                          </th>

                          <th className="px-4 py-3">
                            Type
                          </th>

                          <th className="px-4 py-3 text-right">
                            Mouvement
                          </th>

                          <th className="px-4 py-3 text-right">
                            Stock
                          </th>

                          <th className="px-4 py-3">
                            Motif
                          </th>

                          <th className="px-4 py-3">
                            Utilisateur
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-slate-800">

                        {movements.map(
                          (movement) => (
                            <tr
                              key={
                                movement.id
                              }
                              className="text-sm"
                            >

                              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                {formatMovementDate(
                                  movement.created_at
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={
                                    getMovementBadgeClass(
                                      movement.movement_type
                                    )
                                  }
                                >
                                  {getMovementLabel(
                                    movement.movement_type
                                  )}
                                </span>
                              </td>

                              <td
                                className={
                                  movement.quantity_change >=
                                  0
                                    ? "px-4 py-3 text-right font-black text-emerald-400"
                                    : "px-4 py-3 text-right font-black text-red-400"
                                }
                              >
                                {movement.quantity_change >
                                0
                                  ? "+"
                                  : ""}
                                {
                                  movement.quantity_change
                                }
                              </td>

                              <td className="px-4 py-3 text-right font-bold text-foreground">
                                {
                                  movement.previous_quantity
                                }{" "}
                                →{" "}
                                {
                                  movement.new_quantity
                                }
                              </td>

                              <td className="max-w-[220px] px-4 py-3 text-muted-foreground">
                                {movement.reason ||
                                  "—"}
                              </td>

                              <td className="px-4 py-3 text-muted-foreground">
                                {movement.actor_name ||
                                  "—"}
                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* MODALE MODIFICATION */}

      {editArticle && (
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-400">
                  Stock pharmacie
                </p>

                <h2 className="mt-2 text-2xl font-black text-foreground">
                  Modifier l&apos;article
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  La quantité en stock reste gérée par les boutons Entrée et Sortie afin de conserver l&apos;historique.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={isEditSaving}
                className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-slate-800 disabled:opacity-50"
              >
                Fermer
              </button>
            </div>

            <form
              onSubmit={saveArticleChanges}
              className="mt-6 space-y-5"
            >
              <div>
                <label className="mb-2 block text-sm font-bold">
                  Nom du matériel
                </label>

                <input
                  type="text"
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
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Catégorie
                  </label>

                  <select
                    value={editForm.categoryId}
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          categoryId:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="">
                      Sélectionner
                    </option>

                    {activeCategories.map(
                      (category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Seuil minimum
                  </label>

                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={
                      editForm.minimumQuantity
                    }
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          minimumQuantity:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  Description
                </label>

                <textarea
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      })
                    )
                  }
                  rows={3}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold">
                    Conditionnement
                  </label>

                  <select
                    value={
                      editForm.packagingType
                    }
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          packagingType:
                            event.target.value as
                              | "unit"
                              | "box",
                          unitsPerBox:
                            event.target.value ===
                            "box"
                              ? current.unitsPerBox
                              : "",
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="unit">
                      À l&apos;unité
                    </option>
                    <option value="box">
                      Boîte
                    </option>
                  </select>
                </div>

                {editForm.packagingType ===
                  "box" && (
                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Unités par boîte
                    </label>

                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={
                        editForm.unitsPerBox
                      }
                      onChange={(event) =>
                        setEditForm(
                          (current) => ({
                            ...current,
                            unitsPerBox:
                              event.target.value,
                          })
                        )
                      }
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  Emplacement pharmacie
                </label>

                <input
                  type="text"
                  value={editForm.location}
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        location:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Ex. Pharmacie porte oxygénothérapie"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  Notes
                </label>

                <textarea
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
                  rows={3}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <input
                  type="checkbox"
                  checked={
                    editForm.hasExpiration
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        hasExpiration:
                          event.target.checked,
                      })
                    )
                  }
                  className="h-4 w-4"
                />

                <span className="text-sm font-bold">
                  Suivre les dates de péremption
                </span>
              </label>

              <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                Stock actuel :{" "}
                <strong className="text-foreground">
                  {editArticle.quantity}
                </strong>{" "}
                — utilisez Entrée / Sortie pour le modifier.
              </div>

              {editError && (
                <div className="rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-300">
                  {editError}
                </div>
              )}

              {editSuccess && (
                <div className="rounded-xl border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm font-semibold text-emerald-300">
                  {editSuccess}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isEditSaving}
                  className="rounded-xl border border-border px-5 py-3 text-sm font-bold"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isEditSaving}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isEditSaving
                    ? "Enregistrement..."
                    : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE AJOUT */}

      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl sm:p-8">

            <div className="flex items-start justify-between gap-4">

              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-500">
                  Stock pharmacie
                </p>

                <h2 className="mt-2 text-2xl font-black text-foreground">
                  Ajouter un article
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Le stock réel est
                  comptabilisé en
                  unités.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeCreateModal
                }
                disabled={isSaving}
                className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Fermer
              </button>

            </div>

            <form
              onSubmit={
                handleCreateSubmit
              }
              className="mt-6 space-y-5"
            >

              <div>
                <label
                  htmlFor="article-name"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Nom du matériel *
                </label>

                <input
                  id="article-name"
                  type="text"
                  required
                  maxLength={200}
                  value={form.name}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        name:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">

                <div>
                  <label
                    htmlFor="article-category"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Catégorie *
                  </label>

                  <select
                    id="article-category"
                    required
                    value={
                      form.categoryId
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          categoryId:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                  >
                    <option value="">
                      Sélectionner
                    </option>

                    {activeCategories.map(
                      (category) => (
                        <option
                          key={
                            category.id
                          }
                          value={
                            category.id
                          }
                        >
                          {
                            category.label
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="article-location"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Emplacement
                  </label>

                  <input
                    id="article-location"
                    type="text"
                    value={
                      form.location
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          location:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="Ex. Pharmacie porte oxygénothérapie"
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition placeholder:text-slate-600 focus:border-red-600"
                  />
                </div>

              </div>

              <div>
                <label
                  htmlFor="article-description"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Description
                </label>

                <textarea
                  id="article-description"
                  rows={3}
                  value={
                    form.description
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">

                <div>
                  <label
                    htmlFor="article-packaging"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Conditionnement *
                  </label>

                  <select
                    id="article-packaging"
                    value={
                      form.packagingType
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,

                          packagingType:
                            event.target
                              .value as
                              | "unit"
                              | "box",

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
                    htmlFor="article-units-box"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Unités par boîte
                  </label>

                  <input
                    id="article-units-box"
                    type="number"
                    min={1}
                    step={1}
                    disabled={
                      form.packagingType !==
                      "box"
                    }
                    value={
                      form.unitsPerBox
                    }
                    onChange={(event) =>
                      setForm(
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

              <div className="grid gap-5 sm:grid-cols-2">

                <div>
                  <label
                    htmlFor="article-quantity"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Quantité en stock
                    (unités) *
                  </label>

                  <input
                    id="article-quantity"
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={
                      form.quantity
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          quantity:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="article-minimum"
                    className="mb-2 block text-sm font-bold text-muted-foreground"
                  >
                    Seuil minimum
                    (unités) *
                  </label>

                  <input
                    id="article-minimum"
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={
                      form.minimumQuantity
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          minimumQuantity:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:border-red-600"
                  />
                </div>

              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4">

                <input
                  type="checkbox"
                  checked={
                    form.hasExpiration
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        hasExpiration:
                          event.target.checked,
                      })
                    )
                  }
                  className="mt-0.5 h-4 w-4 accent-red-600"
                />

                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    Cet article possède
                    une date de
                    péremption
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Les quantités par
                    date de péremption
                    seront gérées
                    séparément.
                  </span>
                </span>

              </label>

              <div>
                <label
                  htmlFor="article-notes"
                  className="mb-2 block text-sm font-bold text-muted-foreground"
                >
                  Observations
                </label>

                <textarea
                  id="article-notes"
                  rows={4}
                  value={form.notes}
                  onChange={(event) =>
                    setForm(
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

              {formError && (
                <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-semibold text-red-300">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm font-semibold text-emerald-300">
                  {formSuccess}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={
                    closeCreateModal
                  }
                  disabled={isSaving}
                  className="rounded-xl border border-border px-5 py-3 text-sm font-bold text-muted-foreground transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-foreground transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving
                    ? "Ajout..."
                    : "Ajouter l'article"}
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

/*
 * =========================================================
 * MENU LATÉRAL SECOURISME
 * =========================================================
 */

function SecourismeSidebar({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`fixed bottom-0 left-0 top-0 z-40 hidden border-r border-border bg-background/95 backdrop-blur-xl transition-all duration-300 lg:block ${
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-slate-800 hover:text-foreground"
            title={
              open
                ? "Réduire le menu"
                : "Ouvrir le menu"
            }
          >
            {open ? (
              <ChevronLeft size={18} strokeWidth={2} />
            ) : (
              <ChevronRight size={18} strokeWidth={2} />
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
            />

            <SidebarLink
              href="/dashboard/secourisme/stock"
              icon={Pill}
              label="Stock pharmacie"
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

          <SidebarSection title="Suivi" open={open}>
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
              icon={CalendarClock}
              label="Lots / péremptions"
              open={open}
            />
          </SidebarSection>

        </nav>

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={onToggle}
            className={`flex w-full items-center rounded-xl border border-border bg-card text-sm font-bold text-muted-foreground transition hover:bg-slate-800 hover:text-foreground ${
              open
                ? "gap-3 px-3 py-2.5"
                : "justify-center px-2 py-2.5"
            }`}
          >
            <Menu size={18} strokeWidth={2} />

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
          ? "border border-red-900/70 bg-red-950/40 text-red-300"
          : "text-muted-foreground hover:bg-card hover:text-foreground"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          active
            ? "bg-red-950/70 text-red-300"
            : "bg-card text-muted-foreground"
        }`}
      >
        <Icon size={18} strokeWidth={1.9} />
      </span>

      {open && (
        <span className="truncate">
          {label}
        </span>
      )}
    </Link>
  );
}

/*
 * =========================================================
 * PETIT COMPOSANT STAT
 * =========================================================
 */

function ExpirationStat({
  label,
  value,
  warning = false,
  danger = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
  danger?: boolean;
}) {
  const valueClass =
    danger
      ? "mt-2 text-2xl font-black text-red-400"
      : warning
        ? "mt-2 text-2xl font-black text-amber-300"
        : "mt-2 text-2xl font-black text-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">

      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <p className={valueClass}>
        {value}
      </p>

    </div>
  );
}

function StatCard({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">

      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <p
        className={
          alert
            ? "mt-2 text-3xl font-black text-red-400"
            : "mt-2 text-3xl font-black text-foreground"
        }
      >
        {value}
      </p>

    </div>
  );
}