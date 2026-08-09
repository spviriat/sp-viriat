"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

type MedicalItemOption = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
};

type ExpectedItem = {
  id: string;
  expectedQuantity: number;
  isRequired: boolean;
  displayOrder: number;
  notes: string | null;
  medicalItem: {
    id: string;
    name: string;
    unit: string;
    stockQuantity: number;
    hasExpiration: boolean;
  } | null;
};

type BagSection = {
  id: string;
  name: string;
  section_type: string;
  color: string | null;
  display_order: number;
  parent_section_id: string | null;
  items: ExpectedItem[];
};

type BagResponse = {
  bag: {
    id: string;
    code: string;
    name: string;
    description: string | null;
  };
  sections: BagSection[];
};

type SectionDraft = {
  name: string;
  sectionType: string;
  color: string;
  displayOrder: number;
};

type ItemDraft = {
  medicalItemId: string;
  expectedQuantity: number;
  isRequired: boolean;
  displayOrder: number;
  notes: string;
};

const SECTION_TYPES = [
  { value: "pochette", label: "Pochette" },
  { value: "poche_exterieure", label: "Poche extérieure" },
  { value: "compartiment", label: "Compartiment" },
  { value: "sous_pochette", label: "Sous-pochette" },
  { value: "autre", label: "Autre" },
];

const SECTION_COLORS = [
  { value: "", label: "Neutre" },
  { value: "blue", label: "Bleu" },
  { value: "green", label: "Vert" },
  { value: "yellow", label: "Jaune" },
];

function emptySectionDraft(
  nextOrder = 10
): SectionDraft {
  return {
    name: "",
    sectionType: "pochette",
    color: "",
    displayOrder: nextOrder,
  };
}

function emptyItemDraft(
  nextOrder = 10
): ItemDraft {
  return {
    medicalItemId: "",
    expectedQuantity: 1,
    isRequired: true,
    displayOrder: nextOrder,
    notes: "",
  };
}

export default function RescueBagConfiguration({
  bagCode,
  controlHref,
}: {
  bagCode: string;
  controlHref: string;
}) {
  const apiSlug = bagCode;
  const [data, setData] =
    useState<BagResponse | null>(null);

  const [
    medicalItems,
    setMedicalItems,
  ] = useState<MedicalItemOption[]>([]);

  const [
    openSectionId,
    setOpenSectionId,
  ] = useState<string | null>(null);

  const [
    editingSection,
    setEditingSection,
  ] = useState<BagSection | null>(null);

  const [
    addingSection,
    setAddingSection,
  ] = useState(false);

  const [
    editingItem,
    setEditingItem,
  ] = useState<{
    section: BagSection;
    item: ExpectedItem;
  } | null>(null);

  const [
    addingItemToSection,
    setAddingItemToSection,
  ] = useState<BagSection | null>(null);

  const [
    sectionDraft,
    setSectionDraft,
  ] = useState<SectionDraft>(
    emptySectionDraft()
  );

  const [
    itemDraft,
    setItemDraft,
  ] = useState<ItemDraft>(
    emptyItemDraft()
  );

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const totalItems = useMemo(
    () =>
      data?.sections.reduce(
        (total, section) =>
          total + section.items.length,
        0
      ) ?? 0,
    [data]
  );

  const getSessionToken = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (
      error ||
      !session?.access_token
    ) {
      throw new Error(
        "Votre session est invalide ou a expiré."
      );
    }

    return session.access_token;
  };

  const loadAll = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const token =
        await getSessionToken();

      const [
        bagResponse,
        configResponse,
      ] = await Promise.all([
        fetch(
          `/api/secourisme/sacs/${apiSlug}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: "no-store",
          }
        ),
        fetch(
          `/api/secourisme/sacs/${apiSlug}/configuration`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: "no-store",
          }
        ),
      ]);

      const bagResult =
        (await bagResponse.json()) as
          | BagResponse
          | { error?: string };

      const configResult =
        (await configResponse.json()) as {
          error?: string;
          medicalItems?: MedicalItemOption[];
        };

      if (!bagResponse.ok) {
        throw new Error(
          "error" in bagResult
            ? bagResult.error ||
                "Impossible de charger le sac."
            : "Impossible de charger le sac."
        );
      }

      if (!configResponse.ok) {
        throw new Error(
          configResult.error ||
            "Impossible de charger les articles disponibles."
        );
      }

      setData(
        bagResult as BagResponse
      );

      setMedicalItems(
        configResult.medicalItems ?? []
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const requestConfiguration = async (
    method: "PATCH" | "POST" | "DELETE",
    body: unknown
  ) => {
    const token =
      await getSessionToken();

    const response = await fetch(
      `/api/secourisme/sacs/${apiSlug}/configuration`,
      {
        method,
        headers: {
          Authorization:
            `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const result =
      (await response.json()) as {
        error?: string;
        message?: string;
      };

    if (!response.ok) {
      throw new Error(
        result.error ||
          "L'opération a échoué."
      );
    }

    return result;
  };

  const openSectionEditor = (
    section: BagSection
  ) => {
    setSuccessMessage("");
    setErrorMessage("");

    setEditingSection(section);

    setSectionDraft({
      name: section.name,
      sectionType:
        section.section_type,
      color: section.color ?? "",
      displayOrder:
        section.display_order,
    });
  };

  const openAddSection = () => {
    const nextOrder =
      data?.sections.length
        ? Math.max(
            ...data.sections.map(
              (section) =>
                section.display_order
            )
          ) + 10
        : 10;

    setSuccessMessage("");
    setErrorMessage("");
    setAddingSection(true);
    setSectionDraft(
      emptySectionDraft(
        nextOrder
      )
    );
  };

  const openItemEditor = (
    section: BagSection,
    item: ExpectedItem
  ) => {
    setSuccessMessage("");
    setErrorMessage("");

    setEditingItem({
      section,
      item,
    });

    setItemDraft({
      medicalItemId:
        item.medicalItem?.id ?? "",
      expectedQuantity:
        item.expectedQuantity,
      isRequired:
        item.isRequired,
      displayOrder:
        item.displayOrder,
      notes:
        item.notes ?? "",
    });
  };

  const openAddItem = (
    section: BagSection
  ) => {
    const nextOrder =
      section.items.length
        ? Math.max(
            ...section.items.map(
              (item) =>
                item.displayOrder
            )
          ) + 10
        : 10;

    setSuccessMessage("");
    setErrorMessage("");
    setAddingItemToSection(
      section
    );
    setItemDraft(
      emptyItemDraft(
        nextOrder
      )
    );
  };

  const saveSection = async () => {
    if (
      !editingSection ||
      !sectionDraft.name.trim()
    ) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await requestConfiguration(
        "PATCH",
        {
          action:
            "update_section",
          sectionId:
            editingSection.id,
          name:
            sectionDraft.name.trim(),
          sectionType:
            sectionDraft.sectionType,
          color:
            sectionDraft.color ||
            null,
          displayOrder:
            sectionDraft.displayOrder,
        }
      );

      setEditingSection(null);
      setSuccessMessage(
        "Compartiment modifié avec succès."
      );

      await loadAll();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "La modification a échoué."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addSection = async () => {
    if (
      !sectionDraft.name.trim()
    ) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await requestConfiguration(
        "POST",
        {
          action:
            "add_section",
          name:
            sectionDraft.name.trim(),
          sectionType:
            sectionDraft.sectionType,
          color:
            sectionDraft.color ||
            null,
          displayOrder:
            sectionDraft.displayOrder,
        }
      );

      setAddingSection(false);
      setSuccessMessage(
        "Compartiment ajouté avec succès."
      );

      await loadAll();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "L'ajout a échoué."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const disableSection = async (
    section: BagSection
  ) => {
    const confirmed =
      window.confirm(
        `Retirer « ${section.name} » du sac ?\n\nLe compartiment sera désactivé et ne sera plus affiché dans les futurs contrôles. L'historique reste conservé.`
      );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await requestConfiguration(
        "DELETE",
        {
          action:
            "disable_section",
          sectionId:
            section.id,
        }
      );

      setSuccessMessage(
        "Compartiment retiré du sac."
      );

      await loadAll();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Le retrait a échoué."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveItem = async () => {
    if (!editingItem) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await requestConfiguration(
        "PATCH",
        {
          action:
            "update_item",
          expectedItemId:
            editingItem.item.id,
          expectedQuantity:
            itemDraft.expectedQuantity,
          isRequired:
            itemDraft.isRequired,
          displayOrder:
            itemDraft.displayOrder,
          notes:
            itemDraft.notes.trim() ||
            null,
        }
      );

      setEditingItem(null);
      setSuccessMessage(
        "Article modifié avec succès."
      );

      await loadAll();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "La modification a échoué."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = async () => {
    if (
      !addingItemToSection ||
      !itemDraft.medicalItemId
    ) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await requestConfiguration(
        "POST",
        {
          action:
            "add_item",
          sectionId:
            addingItemToSection.id,
          medicalItemId:
            itemDraft.medicalItemId,
          expectedQuantity:
            itemDraft.expectedQuantity,
          isRequired:
            itemDraft.isRequired,
          displayOrder:
            itemDraft.displayOrder,
          notes:
            itemDraft.notes.trim() ||
            null,
        }
      );

      setAddingItemToSection(
        null
      );
      setSuccessMessage(
        "Article ajouté au compartiment."
      );

      await loadAll();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "L'ajout a échoué."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const removeItem = async (
    section: BagSection,
    item: ExpectedItem
  ) => {
    const name =
      item.medicalItem?.name ??
      "cet article";

    const confirmed =
      window.confirm(
        `Retirer « ${name} » de « ${section.name} » ?\n\nL'article ne sera plus demandé dans les futurs contrôles. L'historique reste conservé.`
      );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await requestConfiguration(
        "DELETE",
        {
          action:
            "remove_item",
          expectedItemId:
            item.id,
        }
      );

      setSuccessMessage(
        "Article retiré du compartiment."
      );

      await loadAll();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Le retrait a échoué."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const availableItemsForSection =
    useMemo(() => {
      if (!addingItemToSection) {
        return medicalItems;
      }

      const existingIds =
        new Set(
          addingItemToSection.items
            .map(
              (item) =>
                item.medicalItem?.id
            )
            .filter(
              (id): id is string =>
                Boolean(id)
            )
        );

      return medicalItems.filter(
        (item) =>
          !existingIds.has(item.id)
      );
    }, [
      medicalItems,
      addingItemToSection,
    ]);

  if (isLoading) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />

          <p className="mt-4 text-sm text-muted-foreground">
            Chargement de la configuration...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app-page min-h-screen p-6">
        <div className="mx-auto max-w-5xl">
          <Link
            href={controlHref}
            className="app-button-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
          >
            <ChevronLeft size={18} />
            Retour
          </Link>

          <div className="mt-6 rounded-2xl border border-red-400 bg-red-100 px-4 py-4 text-sm font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage ||
              "Impossible de charger le sac."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page min-h-screen">
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={controlHref}
            className="app-button-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
          >
            <ChevronLeft size={18} />
            Retour au contrôle
          </Link>

          <span className="rounded-full border border-border bg-card px-4 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
            Mode configuration
          </span>
        </div>

        <header className="mt-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
            Configuration du sac
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            {data.bag.name}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Ajoutez, modifiez ou retirez
            les compartiments et les
            articles attendus. Les anciens
            contrôles restent conservés.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full border border-border bg-card px-4 py-2 text-sm font-bold">
              {data.sections.length} compartiment(s)
            </span>

            <span className="rounded-full border border-border bg-card px-4 py-2 text-sm font-bold">
              {totalItems} référence(s)
            </span>
          </div>

          <button
            type="button"
            onClick={openAddSection}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 sm:w-auto"
          >
            <Plus size={18} />
            Ajouter un compartiment
          </button>
        </header>

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-400 bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-400 bg-red-100 px-4 py-3 text-sm font-bold text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mt-8 space-y-4">
          {data.sections.map(
            (section) => {
              const isOpen =
                openSectionId ===
                section.id;

              return (
                <article
                  key={section.id}
                  className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
                >
                  <div className="flex items-center gap-2 p-4 sm:p-5">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSectionId(
                          isOpen
                            ? null
                            : section.id
                        )
                      }
                      className="flex min-w-0 flex-1 items-center gap-4 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-base font-black sm:text-lg">
                          {section.name}
                        </h2>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {
                            section.items
                              .length
                          }{" "}
                          article(s) · ordre{" "}
                          {
                            section.display_order
                          }
                        </p>
                      </div>

                      {isOpen ? (
                        <ChevronUp
                          size={20}
                        />
                      ) : (
                        <ChevronDown
                          size={20}
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openSectionEditor(
                          section
                        )
                      }
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-strong transition hover:bg-accent"
                      aria-label={`Modifier ${section.name}`}
                    >
                      <Pencil
                        size={17}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        disableSection(
                          section
                        )
                      }
                      disabled={isSaving}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-400 bg-red-100 text-red-800 transition hover:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                      aria-label={`Retirer ${section.name}`}
                    >
                      <Trash2
                        size={17}
                      />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border">
                      {section.items.length ===
                      0 ? (
                        <div className="p-5 text-sm text-muted-foreground">
                          Aucun article
                          configuré.
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {section.items.map(
                            (item) => (
                              <div
                                key={
                                  item.id
                                }
                                className="flex items-center gap-2 px-4 py-4 sm:px-5"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold">
                                    {item
                                      .medicalItem
                                      ?.name ??
                                      "Article introuvable"}
                                  </p>

                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Quantité
                                    attendue :{" "}
                                    <strong className="text-foreground">
                                      {
                                        item.expectedQuantity
                                      }
                                    </strong>
                                    {item
                                      .medicalItem
                                      ?.unit
                                      ? ` ${item.medicalItem.unit}`
                                      : ""}
                                    {!item.isRequired
                                      ? " · Facultatif"
                                      : ""}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openItemEditor(
                                      section,
                                      item
                                    )
                                  }
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-strong transition hover:bg-accent"
                                  aria-label="Modifier l'article"
                                >
                                  <Pencil
                                    size={
                                      16
                                    }
                                  />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeItem(
                                      section,
                                      item
                                    )
                                  }
                                  disabled={
                                    isSaving
                                  }
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400 bg-red-100 text-red-800 transition hover:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                                  aria-label="Retirer l'article"
                                >
                                  <Trash2
                                    size={
                                      16
                                    }
                                  />
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      )}

                      <div className="border-t border-border bg-surface-soft p-4 sm:p-5">
                        <button
                          type="button"
                          onClick={() =>
                            openAddItem(
                              section
                            )
                          }
                          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm font-black transition hover:bg-accent"
                        >
                          <Plus
                            size={18}
                          />
                          Ajouter un article
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            }
          )}
        </section>
      </main>

      {(editingSection ||
        addingSection) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-red-500">
                  {editingSection
                    ? "Modifier le compartiment"
                    : "Ajouter un compartiment"}
                </p>

                <h2 className="mt-2 text-xl font-black">
                  {editingSection
                    ? editingSection.name
                    : "Nouveau compartiment"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingSection(
                    null
                  );
                  setAddingSection(
                    false
                  );
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-strong"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-6 block text-sm font-black">
              Nom
              <input
                value={
                  sectionDraft.name
                }
                onChange={(event) =>
                  setSectionDraft(
                    (current) => ({
                      ...current,
                      name:
                        event.target
                          .value,
                    })
                  )
                }
                className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-red-500"
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm font-black">
                Type

                <select
                  value={
                    sectionDraft.sectionType
                  }
                  onChange={(event) =>
                    setSectionDraft(
                      (current) => ({
                        ...current,
                        sectionType:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-3"
                >
                  {SECTION_TYPES.map(
                    (type) => (
                      <option
                        key={
                          type.value
                        }
                        value={
                          type.value
                        }
                      >
                        {type.label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="text-sm font-black">
                Couleur

                <select
                  value={
                    sectionDraft.color
                  }
                  onChange={(event) =>
                    setSectionDraft(
                      (current) => ({
                        ...current,
                        color:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-3"
                >
                  {SECTION_COLORS.map(
                    (color) => (
                      <option
                        key={
                          color.value
                        }
                        value={
                          color.value
                        }
                      >
                        {color.label}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <label className="mt-4 block text-sm font-black">
              Ordre d&apos;affichage

              <input
                type="number"
                inputMode="numeric"
                value={
                  sectionDraft.displayOrder
                }
                onChange={(event) =>
                  setSectionDraft(
                    (current) => ({
                      ...current,
                      displayOrder:
                        Number(
                          event.target
                            .value
                        ) || 0,
                    })
                  )
                }
                className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4"
              />
            </label>

            <button
              type="button"
              onClick={
                editingSection
                  ? saveSection
                  : addSection
              }
              disabled={
                isSaving ||
                !sectionDraft.name.trim()
              }
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving
                ? "Enregistrement..."
                : editingSection
                  ? "Enregistrer"
                  : "Ajouter le compartiment"}
            </button>
          </div>
        </div>
      )}

      {(editingItem ||
        addingItemToSection) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-red-500">
                  {editingItem
                    ? "Modifier l'article"
                    : "Ajouter un article"}
                </p>

                <h2 className="mt-2 text-xl font-black">
                  {editingItem
                    ? editingItem.item
                        .medicalItem
                        ?.name ??
                      "Article"
                    : addingItemToSection?.name}
                </h2>

                {editingItem && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {
                      editingItem
                        .section.name
                    }
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setAddingItemToSection(
                    null
                  );
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-strong"
              >
                <X size={18} />
              </button>
            </div>

            {!editingItem && (
              <label className="mt-6 block text-sm font-black">
                Article

                <select
                  value={
                    itemDraft.medicalItemId
                  }
                  onChange={(event) =>
                    setItemDraft(
                      (current) => ({
                        ...current,
                        medicalItemId:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-3"
                >
                  <option value="">
                    Sélectionner un article
                  </option>

                  {availableItemsForSection.map(
                    (item) => (
                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {item.name} ·
                        stock{" "}
                        {item.quantity}
                      </option>
                    )
                  )}
                </select>

                {availableItemsForSection.length ===
                  0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tous les articles
                    disponibles sont déjà
                    présents dans ce
                    compartiment.
                  </p>
                )}
              </label>
            )}

            <label
              className={
                editingItem
                  ? "mt-6 block text-sm font-black"
                  : "mt-4 block text-sm font-black"
              }
            >
              Quantité attendue

              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={
                  itemDraft.expectedQuantity
                }
                onChange={(event) =>
                  setItemDraft(
                    (current) => ({
                      ...current,
                      expectedQuantity:
                        Math.max(
                          1,
                          Number(
                            event
                              .target
                              .value
                          ) || 1
                        ),
                    })
                  )
                }
                className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4"
              />
            </label>

            <label className="mt-4 flex min-h-12 items-center justify-between gap-4 rounded-xl border border-border bg-surface-strong px-4 py-3">
              <span className="text-sm font-black">
                Article obligatoire
              </span>

              <input
                type="checkbox"
                checked={
                  itemDraft.isRequired
                }
                onChange={(event) =>
                  setItemDraft(
                    (current) => ({
                      ...current,
                      isRequired:
                        event.target
                          .checked,
                    })
                  )
                }
                className="h-5 w-5"
              />
            </label>

            <label className="mt-4 block text-sm font-black">
              Ordre d&apos;affichage

              <input
                type="number"
                inputMode="numeric"
                value={
                  itemDraft.displayOrder
                }
                onChange={(event) =>
                  setItemDraft(
                    (current) => ({
                      ...current,
                      displayOrder:
                        Number(
                          event.target
                            .value
                        ) || 0,
                    })
                  )
                }
                className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4"
              />
            </label>

            <label className="mt-4 block text-sm font-black">
              Note

              <textarea
                rows={3}
                value={
                  itemDraft.notes
                }
                onChange={(event) =>
                  setItemDraft(
                    (current) => ({
                      ...current,
                      notes:
                        event.target
                          .value,
                    })
                  )
                }
                placeholder="Note facultative..."
                className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3"
              />
            </label>

            <button
              type="button"
              onClick={
                editingItem
                  ? saveItem
                  : addItem
              }
              disabled={
                isSaving ||
                (!editingItem &&
                  !itemDraft.medicalItemId)
              }
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              <Save size={18} />

              {isSaving
                ? "Enregistrement..."
                : editingItem
                  ? "Enregistrer"
                  : "Ajouter l'article"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}