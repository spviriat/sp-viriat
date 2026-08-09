"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BriefcaseMedical,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ClipboardCheck,
  FileBox,
  FolderClosed,
  LockOpen,
  MapPin,
  PackageOpen,
  PanelLeft,
  RotateCcw,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

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
    location: string | null;
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
  control?: {
    cycle: {
      startsAt: string;
      endsAt: string;
    };
    isLocked: boolean;
    canStartControl: boolean;
    latestCheck: {
      id: string;
      checked_at: string;
      checked_by: string | null;
      checked_by_name: string | null;
      status: string;
      notes: string | null;
    } | null;
    latestUnlock: {
      id: string;
      unlocked_at: string;
      unlocked_by: string | null;
      unlocked_by_name: string | null;
      reason: string | null;
    } | null;
  };
};

type ProblemReason =
  | "absent"
  | "quantity"
  | "expired"
  | "damaged"
  | "other";

type ItemCheckState = {
  status:
    | "pending"
    | "validated"
    | "problem"
    | "replaced";
  reasons: ProblemReason[];
  observedQuantity: number | null;
  comment: string;
  replacementRequested: boolean;
  replacementQuantity: number;
};

type ItemChecks = Record<string, ItemCheckState>;

type FirefighterOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type UnlockReasonCode =
  | "formation"
  | "verification_error"
  | "incomplete_verification"
  | "other";

type BusinessRoleAssignment = {
  business_roles:
    | { code: string }
    | { code: string }[]
    | null;
};

function getBusinessRoleCode(
  assignment: BusinessRoleAssignment
): string | null {
  if (!assignment.business_roles) {
    return null;
  }

  if (
    Array.isArray(
      assignment.business_roles
    )
  ) {
    return (
      assignment.business_roles[0]
        ?.code ?? null
    );
  }

  return assignment.business_roles.code;
}

const PROBLEM_REASONS: {
  value: ProblemReason;
  label: string;
}[] = [
  {
    value: "absent",
    label: "Absent",
  },
  {
    value: "quantity",
    label: "Quantité insuffisante",
  },
  {
    value: "expired",
    label: "Périmé",
  },
  {
    value: "damaged",
    label: "Emballage détérioré",
  },
  {
    value: "other",
    label: "Autre",
  },
];

function SectionIcon({
  section,
}: {
  section: BagSection;
}) {
  let Icon: LucideIcon = PackageOpen;

  const sectionName = section.name.toLowerCase();

  if (section.section_type === "pochette") {
    // Même icône de pochette que le PS VPI, y compris pour les pochettes FPT.
    Icon = BriefcaseMedical;
  } else if (sectionName.includes("zipp")) {
    Icon = FolderClosed;
  } else if (sectionName.includes("plastifi")) {
    Icon = FileBox;
  } else if (
    sectionName.includes("latéral") ||
    sectionName.includes("laterale") ||
    sectionName.includes("latérale")
  ) {
    // Même icône latérale que le PS VPI.
    Icon = PanelLeft;
  } else {
    // Les autres poches gardent l'icône générique déjà utilisée par le PS VPI.
    Icon = PackageOpen;
  }

  const sectionColor =
    section.color ??
    (sectionName.includes("orange")
      ? "orange"
      : sectionName.includes("rouge")
        ? "red"
        : sectionName.includes("bleue") ||
            sectionName.includes("bleu")
          ? "blue"
          : sectionName.includes("jaune")
            ? "yellow"
            : sectionName.includes("verte") ||
                sectionName.includes("vert")
              ? "green"
              : null);

  const colorClass =
    sectionColor === "blue"
      ? "border-blue-400 bg-blue-100 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300"
      : sectionColor === "green"
        ? "border-emerald-400 bg-emerald-100 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300"
        : sectionColor === "yellow"
          ? "border-amber-400 bg-amber-100 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300"
          : sectionColor === "orange"
            ? "border-orange-400 bg-orange-100 text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/50 dark:text-orange-300"
            : sectionColor === "red"
              ? "border-red-400 bg-red-100 text-red-700 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-300"
              : "border-border bg-surface-strong text-muted-foreground";

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colorClass}`}
      title={section.name}
    >
      <Icon
        size={20}
        strokeWidth={1.9}
      />
    </div>
  );
}

export default function RescueBagControl({
  bagCode,
  homeHref = "/dashboard/secourisme",
}: {
  bagCode: string;
  homeHref?: string;
}) {
  const apiSlug = bagCode;

  const [
    hasAutoOpenedRestock,
    setHasAutoOpenedRestock,
  ] = useState(false);

  const [data, setData] =
    useState<BagResponse | null>(null);

  const [openSectionId, setOpenSectionId] =
    useState<string | null>(null);

  const [itemChecks, setItemChecks] =
    useState<ItemChecks>({});

  const [problemItem, setProblemItem] =
    useState<ExpectedItem | null>(null);

  const [
    problemDraft,
    setProblemDraft,
  ] = useState<ItemCheckState>({
    status: "problem",
    reasons: [],
    observedQuantity: null,
    comment: "",
    replacementRequested: false,
    replacementQuantity: 0,
  });

  const replacementNeed = useMemo(() => {
    if (!problemItem) {
      return 0;
    }

    if (
      problemDraft.reasons.includes("expired") ||
      problemDraft.reasons.includes("damaged")
    ) {
      return problemItem.expectedQuantity;
    }

    if (problemDraft.reasons.includes("absent")) {
      return problemItem.expectedQuantity;
    }

    if (problemDraft.reasons.includes("quantity")) {
      const observed =
        problemDraft.observedQuantity ?? 0;

      return Math.max(
        0,
        problemItem.expectedQuantity - observed
      );
    }

    return 0;
  }, [problemItem, problemDraft]);

  const stockAvailable =
    problemItem?.medicalItem?.stockQuantity ?? 0;

  const replacementPossible =
    replacementNeed > 0 &&
    stockAvailable >= replacementNeed;

  const [
    validatedSectionIds,
    setValidatedSectionIds,
  ] = useState<string[]>([]);

  const [
    finishMessage,
    setFinishMessage,
  ] = useState("");

  const [
    isSavingControl,
    setIsSavingControl,
  ] = useState(false);

  const [
    saveError,
    setSaveError,
  ] = useState("");

  const [
    isControlFinished,
    setIsControlFinished,
  ] = useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [
    currentController,
    setCurrentController,
  ] = useState<FirefighterOption | null>(
    null
  );

  const [
    firefighterOptions,
    setFirefighterOptions,
  ] = useState<FirefighterOption[]>([]);

  const [
    secondControllerId,
    setSecondControllerId,
  ] = useState("");

  const [
    thirdControllerId,
    setThirdControllerId,
  ] = useState("");

  const [
    canUnlockControl,
    setCanUnlockControl,
  ] = useState(false);

  const [
    isUnlockModalOpen,
    setIsUnlockModalOpen,
  ] = useState(false);

  const [
    unlockReasonCode,
    setUnlockReasonCode,
  ] = useState<UnlockReasonCode | null>(
    null
  );

  const [
    unlockReasonDetail,
    setUnlockReasonDetail,
  ] = useState("");

  const [
    isUnlocking,
    setIsUnlocking,
  ] = useState(false);

  const [
    unlockError,
    setUnlockError,
  ] = useState("");

  const [
    isRestockModalOpen,
    setIsRestockModalOpen,
  ] = useState(false);

  const [
    interventionReference,
    setInterventionReference,
  ] = useState("");

  const [
    restockQuantities,
    setRestockQuantities,
  ] = useState<Record<string, number>>({});

  const [
    isSavingRestock,
    setIsSavingRestock,
  ] = useState(false);

  const [
    restockError,
    setRestockError,
  ] = useState("");

  const [
    restockMessage,
    setRestockMessage,
  ] = useState("");

  useEffect(() => {
    const loadBag = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          throw new Error(
            "Votre session est invalide ou a expiré."
          );
        }

        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, access_role")
          .eq("id", session.user.id)
          .single();

        let mayUnlock =
          !profileError &&
          profileData?.access_role ===
            "admin";

        if (!mayUnlock) {
          const {
            data: assignmentsData,
            error: assignmentsError,
          } = await supabase
            .from(
              "profile_business_roles"
            )
            .select(`
              business_roles!inner (
                code
              )
            `)
            .eq(
              "profile_id",
              session.user.id
            );

          if (!assignmentsError) {
            const roleCodes = (
              (assignmentsData ??
                []) as BusinessRoleAssignment[]
            )
              .map(
                getBusinessRoleCode
              )
              .filter(
                (
                  code
                ): code is string =>
                  Boolean(code)
              )
              .map((code) =>
                code
                  .trim()
                  .toLowerCase()
              );

            mayUnlock =
              roleCodes.includes(
                "responsable_pharmacie"
              );
          }
        }

        setCanUnlockControl(
          mayUnlock
        );

        if (!profileError && profileData) {
          setCurrentController({
            id: profileData.id,
            first_name:
              profileData.first_name,
            last_name:
              profileData.last_name,
          });
        }

        const {
          data: firefightersData,
          error: firefightersError,
        } = await supabase
          .from("profiles")
          .select(
            "id, first_name, last_name"
          )
          .order("last_name", {
            ascending: true,
          })
          .order("first_name", {
            ascending: true,
          });

        if (!firefightersError) {
          setFirefighterOptions(
            (
              firefightersData ?? []
            ).filter(
              (firefighter) =>
                firefighter.id !==
                session.user.id
            )
          );
        }

        const response = await fetch(
          `/api/secourisme/sacs/${apiSlug}`,
          {
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

        const result =
          (await response.json()) as
            | BagResponse
            | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in result
              ? result.error ||
                  "Impossible de charger le sac."
              : "Impossible de charger le sac."
          );
        }

        const bagData =
          result as BagResponse;

        setData(bagData);

        const initialChecks:
          ItemChecks = {};

        for (const section of bagData.sections) {
          for (const item of section.items) {
            initialChecks[item.id] = {
              status: "pending",
              reasons: [],
              observedQuantity:
                item.expectedQuantity,
              comment: "",
              replacementRequested: false,
              replacementQuantity: 0,
            };
          }
        }

        setItemChecks(initialChecks);
      } catch (error) {
        console.error(
          "Erreur chargement sac de secours :",
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

    void loadBag();
  }, []);

  useEffect(() => {
    if (
      !data ||
      hasAutoOpenedRestock
    ) {
      return;
    }

    const searchParams =
      new URLSearchParams(
        window.location.search
      );

    const shouldOpenRestock =
      searchParams.get("restock") === "1";

    if (!shouldOpenRestock) {
      return;
    }

    setInterventionReference("");
    setRestockQuantities({});
    setRestockError("");
    setRestockMessage("");
    setIsRestockModalOpen(true);
    setHasAutoOpenedRestock(true);
  }, [
    data,
    hasAutoOpenedRestock,
  ]);

  const validateItem = (
    item: ExpectedItem
  ) => {
    if (
      isControlFinished ||
      data?.control?.isLocked
    ) {
      return;
    }

    setItemChecks((current) => ({
      ...current,
      [item.id]: {
        status: "validated",
        reasons: [],
        observedQuantity:
          item.expectedQuantity,
        comment: "",
        replacementRequested: false,
        replacementQuantity: 0,
      },
    }));
  };

  const openProblemModal = (
    item: ExpectedItem
  ) => {
    if (
      isControlFinished ||
      data?.control?.isLocked
    ) {
      return;
    }

    const current =
      itemChecks[item.id];

    setProblemItem(item);
    setProblemDraft({
      status: "problem",
      reasons:
        current?.status === "problem"
          ? current.reasons
          : [],
      observedQuantity:
        current?.status === "problem"
          ? current.observedQuantity
          : item.expectedQuantity,
      comment:
        current?.status === "problem"
          ? current.comment
          : "",
      replacementRequested:
        current?.status === "problem"
          ? current.replacementRequested
          : false,
      replacementQuantity:
        current?.status === "problem"
          ? current.replacementQuantity
          : 0,
    });
  };

  const toggleProblemReason = (
    reason: ProblemReason
  ) => {
    setProblemDraft((current) => {
      const selected =
        current.reasons.includes(reason);

      return {
        ...current,
        reasons: selected
          ? current.reasons.filter(
              (value) => value !== reason
            )
          : [...current.reasons, reason],
      };
    });
  };

  const confirmReplacement = () => {
    if (
      !problemItem ||
      !replacementPossible
    ) {
      return;
    }

    setProblemDraft((current) => ({
      ...current,
      replacementRequested: true,
      replacementQuantity:
        replacementNeed,
    }));
  };

  const cancelReplacement = () => {
    setProblemDraft((current) => ({
      ...current,
      replacementRequested: false,
      replacementQuantity: 0,
    }));
  };

  const saveProblem = () => {
    if (
      !problemItem ||
      problemDraft.reasons.length === 0
    ) {
      return;
    }

    setItemChecks((current) => ({
      ...current,
      [problemItem.id]: {
        ...problemDraft,
        status: "problem",
      },
    }));

    setProblemItem(null);
  };

  const getSectionProgress = (
    section: BagSection
  ) => {
    const treated =
      section.items.filter(
        (item) =>
          itemChecks[item.id]?.status !==
            undefined &&
          itemChecks[item.id]?.status !==
            "pending"
      ).length;

    const problems =
      section.items.filter((item) => {
        const check =
          itemChecks[item.id];

        return (
          check?.status === "problem" &&
          !check.replacementRequested
        );
      }).length;

    return {
      treated,
      total: section.items.length,
      problems,
      complete:
        section.items.length > 0 &&
        treated === section.items.length,
    };
  };

  const validateSection = (
    section: BagSection
  ) => {
    if (
      isControlFinished ||
      data?.control?.isLocked
    ) {
      return;
    }

    const progress =
      getSectionProgress(section);

    if (!progress.complete) {
      return;
    }

    setValidatedSectionIds(
      (current) =>
        current.includes(section.id)
          ? current
          : [...current, section.id]
    );

    setOpenSectionId(null);
  };

  const completedSections =
    data?.sections.filter(
      (section) =>
        validatedSectionIds.includes(
          section.id
        )
    ).length ?? 0;

  const allSectionsValidated =
    Boolean(
      data &&
        data.sections.length > 0 &&
        completedSections ===
          data.sections.length
    );

  const totalProblems =
    data?.sections.reduce(
      (total, section) =>
        total +
        section.items.filter((item) => {
          const check =
            itemChecks[item.id];

          return (
            check?.status === "problem" &&
            !check.replacementRequested
          );
        }).length,
      0
    ) ?? 0;

  const handleFinishControl = async () => {
    if (
      !allSectionsValidated ||
      !data ||
      isSavingControl ||
      isControlFinished ||
      data.control?.isLocked
    ) {
      return;
    }

    setIsSavingControl(true);
    setSaveError("");
    setFinishMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Votre session est invalide ou a expiré."
        );
      }

      const items =
        data.sections.flatMap(
          (section) =>
            section.items.map(
              (item) => {
                const check =
                  itemChecks[item.id];

                return {
                  expectedItemId:
                    item.id,
                  expectedQuantity:
                    item.expectedQuantity,
                  status:
                    check?.status,
                  reasons:
                    check?.reasons ?? [],
                  observedQuantity:
                    check?.observedQuantity ??
                    item.expectedQuantity,
                  comment:
                    check?.comment ?? "",
                  replacementRequested:
                    check?.replacementRequested ?? false,
                  replacementQuantity:
                    check?.replacementQuantity ?? 0,
                };
              }
            )
        );

      const response =
        await fetch(
          `/api/secourisme/sacs/${apiSlug}`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              items,
              participantProfileIds: [
                secondControllerId,
                thirdControllerId,
              ].filter(Boolean),
            }),
          }
        );

      const result =
        (await response.json()) as {
          error?: string;
          message?: string;
          anomalyCount?: number;
          replacementCount?: number;
          unresolvedAnomalyCount?: number;
          status?: string;
          replacedExpectedItemIds?: string[];
          replacementErrors?: {
            expectedItemId: string;
            message: string;
          }[];
        };

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Le contrôle n'a pas pu être enregistré."
        );
      }

      const replacedIds =
        new Set(
          result.replacedExpectedItemIds ?? []
        );

      if (replacedIds.size > 0) {
        setItemChecks((current) => {
          const next = { ...current };

          for (const [
            itemId,
            check,
          ] of Object.entries(next)) {
            if (replacedIds.has(itemId)) {
              next[itemId] = {
                ...check,
                status: "replaced",
              };
            }
          }

          return next;
        });
      }

      setFinishMessage(
        result.message ||
          "Contrôle enregistré avec succès."
      );

      setIsControlFinished(true);
      setProblemItem(null);
      setOpenSectionId(null);
    } catch (error) {
      console.error(
        "Erreur enregistrement contrôle :",
        error
      );

      setSaveError(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue pendant l'enregistrement."
      );
    } finally {
      setIsSavingControl(false);
    }
  };

  const allBagItems = useMemo(
    () =>
      data?.sections.flatMap(
        (section) => section.items
      ) ?? [],
    [data]
  );

  const selectedRestockItems = useMemo(
    () =>
      allBagItems
        .map((item) => ({
          item,
          quantity:
            restockQuantities[item.id] ?? 0,
        }))
        .filter(
          ({ quantity }) => quantity > 0
        ),
    [allBagItems, restockQuantities]
  );

  const openRestockModal = () => {
    setInterventionReference("");
    setRestockQuantities({});
    setRestockError("");
    setRestockMessage("");
    setIsRestockModalOpen(true);
  };

  const handleRestock = async () => {
    if (
      !data ||
      isSavingRestock
    ) {
      return;
    }

    if (!interventionReference.trim()) {
      setRestockError(
        "Le numéro d'intervention est obligatoire."
      );
      return;
    }

    if (selectedRestockItems.length === 0) {
      setRestockError(
        "Sélectionnez au moins un article à remettre dans le sac."
      );
      return;
    }

    const insufficientItem =
      selectedRestockItems.find(
        ({ item, quantity }) =>
          !item.medicalItem ||
          item.medicalItem.stockQuantity <
            quantity
      );

    if (insufficientItem) {
      setRestockError(
        `Stock insuffisant pour ${
          insufficientItem.item.medicalItem
            ?.name ?? "un article"
        }.`
      );
      return;
    }

    setIsSavingRestock(true);
    setRestockError("");
    setRestockMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Votre session est invalide ou a expiré."
        );
      }

      const response = await fetch(
        `/api/secourisme/sacs/${apiSlug}/restock`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            interventionReference:
              interventionReference.trim(),
            items: selectedRestockItems.map(
              ({ item, quantity }) => ({
                expectedItemId: item.id,
                quantity,
              })
            ),
          }),
        }
      );

      const result =
        (await response.json()) as {
          error?: string;
          message?: string;
          items?: {
            expectedItemId: string;
            stockAfter: number;
          }[];
        };

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Le réarmement n'a pas pu être enregistré."
        );
      }

      if (result.items?.length) {
        const stocks = new Map(
          result.items.map((item) => [
            item.expectedItemId,
            item.stockAfter,
          ])
        );

        setData((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            sections: current.sections.map(
              (section) => ({
                ...section,
                items: section.items.map(
                  (item) => {
                    const stockAfter =
                      stocks.get(item.id);

                    if (
                      stockAfter === undefined ||
                      !item.medicalItem
                    ) {
                      return item;
                    }

                    return {
                      ...item,
                      medicalItem: {
                        ...item.medicalItem,
                        stockQuantity:
                          stockAfter,
                      },
                    };
                  }
                ),
              })
            ),
          };
        });
      }

      setRestockMessage(
        result.message ||
          "Sac réarmé après intervention."
      );
      setRestockQuantities({});
      setInterventionReference("");
    } catch (error) {
      console.error(
        "Erreur réarmement du sac :",
        error
      );

      setRestockError(
        error instanceof Error
          ? error.message
          : "Le réarmement n'a pas pu être enregistré."
      );
    } finally {
      setIsSavingRestock(false);
    }
  };

  const handleUnlockControl =
    async () => {
      if (
        !data ||
        !data.control?.isLocked ||
        !canUnlockControl ||
        isUnlocking
      ) {
        return;
      }

      if (!unlockReasonCode) {
        setUnlockError(
          "Le motif du déverrouillage est obligatoire."
        );
        return;
      }

      if (
        unlockReasonCode === "other" &&
        !unlockReasonDetail.trim()
      ) {
        setUnlockError(
          "Merci de préciser le motif du déverrouillage."
        );
        return;
      }

      setIsUnlocking(true);
      setUnlockError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          throw new Error(
            "Votre session est invalide ou a expiré."
          );
        }

        const response = await fetch(
          `/api/secourisme/sacs/${apiSlug}/unlock`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              reasonCode:
                unlockReasonCode,
              reasonDetail:
                unlockReasonDetail.trim() ||
                undefined,
            }),
          }
        );

        const result =
          (await response.json()) as {
            error?: string;
            message?: string;
            unlock?: {
              id: string;
              unlocked_at: string;
              unlocked_by: string | null;
              unlocked_by_name:
                | string
                | null;
              reason: string | null;
            };
          };

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Le contrôle n'a pas pu être déverrouillé."
          );
        }

        setData((current) => {
          if (
            !current ||
            !current.control
          ) {
            return current;
          }

          return {
            ...current,
            control: {
              ...current.control,
              isLocked: false,
              canStartControl: true,
              latestUnlock:
                result.unlock
                  ? {
                      id:
                        result.unlock
                          .id,
                      unlocked_at:
                        result.unlock
                          .unlocked_at,
                      unlocked_by:
                        result.unlock
                          .unlocked_by,
                      unlocked_by_name:
                        result.unlock
                          .unlocked_by_name,
                      reason:
                        result.unlock
                          .reason,
                    }
                  : current.control
                      .latestUnlock,
            },
          };
        });

        setUnlockReasonCode(null);
        setUnlockReasonDetail("");
        setUnlockError("");
        setIsUnlockModalOpen(false);
      } catch (error) {
        console.error(
          "Erreur déverrouillage contrôle :",
          error
        );

        setUnlockError(
          error instanceof Error
            ? error.message
            : "Le contrôle n'a pas pu être déverrouillé."
        );
      } finally {
        setIsUnlocking(false);
      }
    };

  const totalItems = useMemo(
    () =>
      data?.sections.reduce(
        (total, section) =>
          total + section.items.length,
        0
      ) ?? 0,
    [data]
  );

  if (isLoading) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />

          <p className="mt-4 text-sm text-muted-foreground">
            Chargement du sac...
          </p>
        </div>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="app-page min-h-screen p-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href={homeHref}
            className="app-button-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
          >
            <ChevronLeft size={18} />
            Retour
          </Link>

          <div className="mt-6 rounded-3xl border border-red-400 bg-red-100 p-6 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
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
        <Link
          href={homeHref}
          className="app-button-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
        >
          <ChevronLeft size={18} />
          Accueil Secourisme
        </Link>

        <header className="mt-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
            Contrôle hebdomadaire
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            {data.bag.name}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Ouvrez chaque compartiment pour
            vérifier son contenu.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full border border-border bg-card px-4 py-2 text-sm font-bold">
              {data.sections.length} compartiment(s)
            </span>

            <span className="rounded-full border border-border bg-card px-4 py-2 text-sm font-bold">
              {totalItems} référence(s)
            </span>
          </div>
        </header>

        {data.control?.isLocked && (
          <section className="mt-6 rounded-3xl border border-amber-400 bg-amber-50 p-5 text-amber-950 shadow-sm dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400 bg-amber-100 dark:border-amber-800 dark:bg-amber-950">
                  <ClipboardCheck
                    size={20}
                  />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em]">
                    Consultation uniquement
                  </p>

                  <h2 className="mt-1 text-lg font-black">
                    🔒 Contrôle déjà réalisé cette semaine
                  </h2>

                  <p className="mt-2 text-sm leading-6">
                    {data.control
                      .latestCheck
                      ?.checked_by_name
                      ? `Contrôlé par ${data.control.latestCheck.checked_by_name}`
                      : "Ce sac a déjà été contrôlé"}
                    {data.control
                      .latestCheck
                      ?.checked_at
                      ? ` le ${new Intl.DateTimeFormat(
                          "fr-FR",
                          {
                            dateStyle:
                              "short",
                            timeStyle:
                              "short",
                          }
                        ).format(
                          new Date(
                            data.control.latestCheck.checked_at
                          )
                        )}.`
                      : "."}
                  </p>

                  <p className="mt-1 text-sm opacity-80">
                    Le contenu reste consultable, mais une nouvelle vérification est bloquée.
                  </p>
                </div>
              </div>

              {canUnlockControl && (
                <button
                  type="button"
                  onClick={() => {
                    setUnlockReasonCode(
                      null
                    );
                    setUnlockReasonDetail("");
                    setUnlockError("");
                    setIsUnlockModalOpen(
                      true
                    );
                  }}
                  className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white transition hover:bg-amber-700"
                >
                  <LockOpen size={17} />
                  Déverrouiller le contrôle
                </button>
              )}
            </div>
          </section>
        )}

        <section className="mt-8 space-y-4">
          {data.sections.map((section) => {
            const isOpen =
              openSectionId === section.id;

            return (
              <article
                key={section.id}
                className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenSectionId(
                      isOpen
                        ? null
                        : section.id
                    )
                  }
                  className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-accent sm:p-6"
                >
                  <SectionIcon
                    section={section}
                  />

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-black">
                      {section.name}
                    </h2>

                    {(() => {
                      const progress =
                        getSectionProgress(section);

                      return (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {progress.treated} /{" "}
                          {progress.total} vérifié(s)
                        </p>
                      );
                    })()}
                  </div>

                  {(() => {
                    const progress =
                      getSectionProgress(section);

                    const sectionValidated =
                      validatedSectionIds.includes(
                        section.id
                      );

                    const label =
                      sectionValidated
                        ? progress.problems > 0
                          ? "Anomalie"
                          : "Vérifié"
                        : progress.complete
                          ? "À valider"
                          : "À vérifier";

                    const className =
                      sectionValidated
                        ? progress.problems > 0
                          ? "border-orange-400 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
                          : "border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : progress.complete
                          ? "border-blue-400 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                          : "border-red-400 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";

                    return (
                      <span
                        className={`rounded-full border px-3 py-1.5 text-xs font-black ${className}`}
                      >
                        {label}
                      </span>
                    );
                  })()}

                  {isOpen ? (
                    <ChevronUp
                      size={20}
                      className="shrink-0"
                    />
                  ) : (
                    <ChevronDown
                      size={20}
                      className="shrink-0"
                    />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-border">
                    {section.items.length === 0 ? (
                      <div className="p-5 text-sm text-muted-foreground">
                        Aucun article configuré
                        dans ce compartiment.
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {section.items.map(
                          (item) => {
                            const check =
                              itemChecks[item.id] ?? {
                                status: "pending",
                                reasons: [],
                                observedQuantity:
                                  item.expectedQuantity,
                                comment: "",
                                replacementRequested: false,
                                replacementQuantity: 0,
                              };

                            return (
                              <div
                                key={item.id}
                                className="px-4 py-4 sm:px-5"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-bold leading-5">
                                      {item.medicalItem?.name ??
                                        "Article introuvable"}
                                    </p>

                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Attendu :{" "}
                                      <strong className="text-foreground">
                                        {
                                          item.expectedQuantity
                                        }
                                      </strong>
                                      {item.medicalItem?.unit
                                        ? ` ${item.medicalItem.unit}`
                                        : ""}
                                    </p>
                                  </div>

                                  {check.status ===
                                    "validated" && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400 bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      <Check size={13} />
                                      Validé
                                    </span>
                                  )}

                                  {check.status ===
                                    "problem" &&
                                    !check.replacementRequested && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-orange-400 bg-orange-100 px-2.5 py-1 text-[11px] font-black text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
                                      <AlertTriangle
                                        size={13}
                                      />
                                      Problème
                                    </span>
                                  )}

                                  {check.status ===
                                    "problem" &&
                                    check.replacementRequested && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400 bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      <Check size={13} />
                                      Remplacement prévu
                                    </span>
                                  )}

                                  {check.status ===
                                    "replaced" && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400 bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      <Check size={13} />
                                      Remplacé
                                    </span>
                                  )}
                                </div>

                                {(check.status ===
                                  "problem" ||
                                  check.status ===
                                    "replaced") && (
                                  <div
                                    className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                                      check.status ===
                                        "replaced" ||
                                      check.replacementRequested
                                        ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
                                        : "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-300"
                                    }`}
                                  >
                                    <div>
                                      {check.reasons
                                        .map(
                                          (reason) =>
                                            PROBLEM_REASONS.find(
                                              (entry) =>
                                                entry.value ===
                                                reason
                                            )?.label
                                        )
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </div>

                                    {check.replacementRequested && (
                                      <div className="mt-1 font-black text-emerald-700 dark:text-emerald-300">
                                        {check.status ===
                                        "replaced"
                                          ? `Remplacé depuis le stock : ${check.replacementQuantity}`
                                          : `Remplacement confirmé : ${check.replacementQuantity}`}
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      validateItem(item)
                                    }
                                    disabled={
                                      isControlFinished ||
                                      data.control?.isLocked
                                    }
                                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                                      check.status ===
                                      "validated"
                                        ? "border-emerald-500 bg-emerald-600 text-white"
                                        : "border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    }`}
                                  >
                                    <Check size={18} />
                                    {check.status ===
                                    "replaced"
                                      ? "Remplacé"
                                      : "Validé"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openProblemModal(
                                        item
                                      )
                                    }
                                    disabled={
                                      isControlFinished ||
                                      data.control?.isLocked
                                    }
                                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                                      check.status ===
                                      "problem"
                                        ? "border-red-600 bg-red-600 text-white"
                                        : "border-red-400 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                                    }`}
                                  >
                                    <X size={18} />
                                    {check.status ===
                                    "replaced"
                                      ? "Corrigé"
                                      : "Problème"}
                                  </button>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}

                    <div className="border-t border-border bg-surface-soft p-4 sm:p-5">
                      {(() => {
                        const progress =
                          getSectionProgress(section);

                        const sectionValidated =
                          validatedSectionIds.includes(
                            section.id
                          );

                        return (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                validateSection(
                                  section
                                )
                              }
                              disabled={
                                !progress.complete ||
                                sectionValidated ||
                                isControlFinished ||
                                data.control?.isLocked
                              }
                              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                                sectionValidated
                                  ? "bg-emerald-600 text-white"
                                  : progress.complete
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "cursor-not-allowed bg-surface-strong text-muted-foreground opacity-60"
                              }`}
                            >
                              <Check size={18} />

                              {sectionValidated
                                ? progress.problems > 0
                                  ? "Compartiment validé avec anomalie"
                                  : "Compartiment validé"
                                : progress.complete
                                  ? "Valider le compartiment"
                                  : `Encore ${
                                      progress.total -
                                      progress.treated
                                    } article(s) à traiter`}
                            </button>

                            <p className="mt-3 text-xs leading-5 text-muted-foreground">
                              Chaque article doit être validé ou signalé avec un problème
                              avant que le compartiment puisse être validé.
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        {!data.control?.isLocked &&
          !isControlFinished && (
          <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-red-500">
                Contrôleurs
              </p>

              <h2 className="mt-2 text-xl font-black">
                Participants à la vérification
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Le contrôleur principal est renseigné automatiquement.
                Vous pouvez ajouter jusqu&apos;à deux sapeurs-pompiers supplémentaires.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-border bg-surface-soft p-4">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Contrôleur principal
                </p>

                <p className="mt-1 font-black">
                  {currentController
                    ? [
                        currentController.first_name,
                        currentController.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ") ||
                      "Utilisateur connecté"
                    : "Utilisateur connecté"}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Renseigné automatiquement
                </p>
              </div>

              <label className="block">
                <span className="text-sm font-black">
                  Deuxième contrôleur
                  <span className="ml-2 font-normal text-muted-foreground">
                    Facultatif
                  </span>
                </span>

                <select
                  value={secondControllerId}
                  onChange={(event) => {
                    const value =
                      event.target.value;
                    setSecondControllerId(
                      value
                    );

                    if (
                      value &&
                      value ===
                        thirdControllerId
                    ) {
                      setThirdControllerId(
                        ""
                      );
                    }
                  }}
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-bold outline-none focus:border-red-500"
                >
                  <option value="">
                    Sélectionner un sapeur-pompier
                  </option>

                  {firefighterOptions
                    .filter(
                      (firefighter) =>
                        firefighter.id !==
                        thirdControllerId
                    )
                    .map((firefighter) => (
                      <option
                        key={firefighter.id}
                        value={firefighter.id}
                      >
                        {[
                          firefighter.first_name,
                          firefighter.last_name,
                        ]
                          .filter(Boolean)
                          .join(" ") ||
                          "Sapeur-pompier"}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-black">
                  Troisième contrôleur
                  <span className="ml-2 font-normal text-muted-foreground">
                    Facultatif
                  </span>
                </span>

                <select
                  value={thirdControllerId}
                  onChange={(event) => {
                    const value =
                      event.target.value;
                    setThirdControllerId(
                      value
                    );

                    if (
                      value &&
                      value ===
                        secondControllerId
                    ) {
                      setSecondControllerId(
                        ""
                      );
                    }
                  }}
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-bold outline-none focus:border-red-500"
                >
                  <option value="">
                    Sélectionner un sapeur-pompier
                  </option>

                  {firefighterOptions
                    .filter(
                      (firefighter) =>
                        firefighter.id !==
                        secondControllerId
                    )
                    .map((firefighter) => (
                      <option
                        key={firefighter.id}
                        value={firefighter.id}
                      >
                        {[
                          firefighter.first_name,
                          firefighter.last_name,
                        ]
                          .filter(Boolean)
                          .join(" ") ||
                          "Sapeur-pompier"}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-3xl border border-blue-300 bg-blue-50 p-5 shadow-sm dark:border-blue-900 dark:bg-blue-950/30 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                Après intervention
              </p>

              <h2 className="mt-2 text-xl font-black">
                Réarmer le sac
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Remettez uniquement les articles utilisés pendant une intervention.
                Cette opération ne modifie pas le contrôle hebdomadaire.
              </p>
            </div>

            <button
              type="button"
              onClick={openRestockModal}
              className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700"
            >
              <RotateCcw size={18} />
              Réarmer après intervention
            </button>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                Progression du contrôle
              </p>

              <h2 className="mt-2 text-xl font-black">
                {completedSections} / {data.sections.length} compartiment(s) validé(s)
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                {totalProblems > 0
                  ? `${totalProblems} anomalie(s) signalée(s) pendant le contrôle.`
                  : "Aucune anomalie signalée pour le moment."}
              </p>
            </div>

            <div
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wider ${
                allSectionsValidated
                  ? totalProblems > 0
                    ? "border-orange-400 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
                    : "border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-red-400 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              }`}
            >
              {isControlFinished
                ? totalProblems > 0
                  ? "Terminé avec anomalie"
                  : "Contrôle terminé"
                : allSectionsValidated
                  ? totalProblems > 0
                    ? "Prêt avec anomalie"
                    : "Prêt à terminer"
                  : "Contrôle incomplet"}
            </div>
          </div>

          {isControlFinished ? (
            <div className="mt-5 space-y-3">
              <div
                className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-black text-white ${
                  totalProblems > 0
                    ? "bg-orange-600"
                    : "bg-emerald-600"
                }`}
              >
                <Check size={21} />
                Contrôle terminé
              </div>

              <Link
                href={homeHref}
                className="app-button-secondary flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-black"
              >
                <ChevronLeft size={20} />
                Retour à l&apos;accueil Secourisme
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleFinishControl}
              disabled={
                !allSectionsValidated ||
                isSavingControl ||
                data.control?.isLocked
              }
              className={`mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-black transition ${
                allSectionsValidated
                  ? totalProblems > 0
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "cursor-not-allowed bg-surface-strong text-muted-foreground opacity-60"
              }`}
            >
              <ClipboardCheck size={20} />
              {data.control?.isLocked
                ? "Consultation uniquement — contrôle verrouillé"
                : isSavingControl
                  ? "Enregistrement..."
                  : "Terminer le contrôle"}
            </button>
          )}

          {finishMessage && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                totalProblems > 0
                  ? "border-orange-400 bg-orange-100 text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300"
                  : "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
              }`}
            >
              {finishMessage}
            </div>
          )}

          {saveError && (
            <div className="mt-4 rounded-2xl border border-red-400 bg-red-100 px-4 py-3 text-sm font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {saveError}
            </div>
          )}

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Une fois terminé, le contrôle et le détail de chaque article sont enregistrés dans l'historique.
          </p>
        </section>
      </main>

      {isRestockModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Réarmer le sac après intervention"
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-600 dark:text-blue-300">
                  Après intervention
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Réarmer {data.bag.name}
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Indiquez le numéro complet de l&apos;intervention puis les quantités réellement remises dans le sac.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isSavingRestock) {
                    setIsRestockModalOpen(false);
                    setRestockError("");
                    setRestockMessage("");
                  }
                }}
                disabled={isSavingRestock}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-strong disabled:opacity-50"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-black">
                N° d&apos;intervention *
              </span>

              <input
                type="text"
                value={interventionReference}
                onChange={(event) => {
                  setInterventionReference(
                    event.target.value
                  );
                  setRestockError("");
                }}
                placeholder="Saisir le numéro complet de l'intervention"
                disabled={isSavingRestock}
                className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-bold outline-none focus:border-blue-500 disabled:opacity-60"
              />
            </label>

            <div className="mt-6">
              <p className="text-sm font-black">
                Articles à remettre
              </p>

              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Laissez la quantité à 0 pour les articles qui n&apos;ont pas été utilisés.
              </p>

              <div className="mt-3 space-y-3">
                {data.sections.map((section) => (
                  <div
                    key={section.id}
                    className="overflow-hidden rounded-2xl border border-border"
                  >
                    <div className="bg-surface-soft px-4 py-3">
                      <p className="text-sm font-black">
                        {section.name}
                      </p>
                    </div>

                    <div className="divide-y divide-border">
                      {section.items.map((item) => {
                        const quantity =
                          restockQuantities[
                            item.id
                          ] ?? 0;

                        const stock =
                          item.medicalItem
                            ?.stockQuantity ?? 0;

                        const insufficient =
                          quantity > stock;

                        return (
                          <div
                            key={item.id}
                            className="p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-bold">
                                  {item.medicalItem
                                    ?.name ??
                                    "Article introuvable"}
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  Stock pharmacie :{" "}
                                  <strong className="text-foreground">
                                    {stock}
                                  </strong>
                                  {item.medicalItem
                                    ?.unit
                                    ? ` ${item.medicalItem.unit}`
                                    : ""}
                                </p>

                                <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <MapPin
                                    size={13}
                                    className="mt-0.5 shrink-0"
                                  />
                                  <span>
                                    {item.medicalItem
                                      ?.location
                                      ?.trim() ||
                                      "Emplacement non renseigné"}
                                  </span>
                                </p>
                              </div>

                              <label className="shrink-0">
                                <span className="sr-only">
                                  Quantité à remettre
                                </span>

                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-muted-foreground">
                                    Qté
                                  </span>

                                  <input
                                    type="number"
                                    min={0}
                                    max={stock}
                                    step={1}
                                    value={quantity}
                                    disabled={
                                      isSavingRestock ||
                                      !item.medicalItem
                                    }
                                    onChange={(event) => {
                                      const value =
                                        Math.max(
                                          0,
                                          Math.floor(
                                            Number(
                                              event
                                                .target
                                                .value
                                            ) || 0
                                          )
                                        );

                                      setRestockQuantities(
                                        (current) => ({
                                          ...current,
                                          [item.id]:
                                            value,
                                        })
                                      );
                                      setRestockError("");
                                      setRestockMessage("");
                                    }}
                                    className={`h-11 w-24 rounded-xl border bg-background px-3 text-center font-black outline-none ${
                                      insufficient
                                        ? "border-red-500 text-red-700"
                                        : "border-border focus:border-blue-500"
                                    }`}
                                  />
                                </div>
                              </label>
                            </div>

                            {insufficient && (
                              <p className="mt-2 text-xs font-black text-red-600 dark:text-red-400">
                                Stock insuffisant pour cette quantité.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-surface-soft p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-bold">
                  Articles sélectionnés
                </span>

                <span className="text-lg font-black">
                  {selectedRestockItems.length}
                </span>
              </div>
            </div>

            {restockError && (
              <div className="mt-4 rounded-xl border border-red-400 bg-red-100 px-4 py-3 text-sm font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {restockError}
              </div>
            )}

            {restockMessage && (
              <div className="mt-4 rounded-xl border border-emerald-400 bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                {restockMessage}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  if (!isSavingRestock) {
                    setIsRestockModalOpen(false);
                    setRestockError("");
                    setRestockMessage("");
                  }
                }}
                disabled={isSavingRestock}
                className="app-button-secondary min-h-12 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50"
              >
                Fermer
              </button>

              <button
                type="button"
                onClick={handleRestock}
                disabled={
                  isSavingRestock ||
                  !interventionReference.trim() ||
                  selectedRestockItems.length === 0 ||
                  selectedRestockItems.some(
                    ({ item, quantity }) =>
                      !item.medicalItem ||
                      quantity >
                        item.medicalItem
                          .stockQuantity
                  )
                }
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw size={18} />
                {isSavingRestock
                  ? "Réarmement..."
                  : "Confirmer le réarmement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isUnlockModalOpen &&
        data.control?.isLocked &&
        canUnlockControl && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Déverrouiller le contrôle"
        >
          <div className="w-full rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-amber-500">
                  Responsable pharmacie
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Déverrouiller le contrôle
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Une nouvelle vérification de{" "}
                  <strong>
                    {data.bag.name}
                  </strong>{" "}
                  sera autorisée. Cette action est enregistrée dans la traçabilité.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isUnlocking) {
                    setIsUnlockModalOpen(
                      false
                    );
                    setUnlockReasonCode(
                      null
                    );
                    setUnlockReasonDetail("");
                    setUnlockError("");
                  }
                }}
                disabled={isUnlocking}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-strong disabled:opacity-50"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6">
              <span className="text-sm font-black">
                Motif du déverrouillage
              </span>

              <div className="mt-3 space-y-2">
                {[
                  {
                    value:
                      "formation" as const,
                    label: "Formation",
                  },
                  {
                    value:
                      "verification_error" as const,
                    label:
                      "Erreur de vérification",
                  },
                  {
                    value:
                      "incomplete_verification" as const,
                    label:
                      "Vérification incomplète",
                  },
                  {
                    value:
                      "other" as const,
                    label: "Autre",
                  },
                ].map((reason) => {
                  const selected =
                    unlockReasonCode ===
                    reason.value;

                  return (
                    <button
                      key={reason.value}
                      type="button"
                      onClick={() => {
                        setUnlockReasonCode(
                          reason.value
                        );

                        if (
                          reason.value !==
                          "other"
                        ) {
                          setUnlockReasonDetail(
                            ""
                          );
                        }

                        setUnlockError("");
                      }}
                      className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                        selected
                          ? "border-amber-500 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                          : "border-border bg-surface-strong"
                      }`}
                    >
                      <span>
                        {reason.label}
                      </span>

                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          selected
                            ? "border-amber-600 bg-amber-600 text-white"
                            : "border-border"
                        }`}
                      >
                        {selected && (
                          <Check
                            size={14}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {unlockReasonCode ===
              "other" && (
              <label className="mt-5 block">
                <span className="text-sm font-black">
                  Précisez le motif
                </span>

                <textarea
                  value={unlockReasonDetail}
                  onChange={(event) =>
                    setUnlockReasonDetail(
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="Précisez la raison du déverrouillage..."
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-amber-500"
                />
              </label>
            )}

            {unlockError && (
              <div className="mt-4 rounded-xl border border-red-400 bg-red-100 p-3 text-sm font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {unlockError}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!isUnlocking) {
                    setIsUnlockModalOpen(
                      false
                    );
                    setUnlockReasonCode(
                      null
                    );
                    setUnlockReasonDetail("");
                    setUnlockError("");
                  }
                }}
                disabled={isUnlocking}
                className="app-button-secondary min-h-12 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={
                  handleUnlockControl
                }
                disabled={
                  isUnlocking ||
                  !unlockReasonCode ||
                  (unlockReasonCode ===
                    "other" &&
                    !unlockReasonDetail.trim())
                }
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LockOpen size={17} />
                {isUnlocking
                  ? "Déverrouillage..."
                  : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {problemItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Signaler un problème"
        >
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-red-500">
                  Signaler un problème
                </p>

                <h2 className="mt-2 text-xl font-black">
                  {problemItem.medicalItem?.name ??
                    "Article"}
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Attendu :{" "}
                  {problemItem.expectedQuantity}
                  {problemItem.medicalItem?.unit
                    ? ` ${problemItem.medicalItem.unit}`
                    : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setProblemItem(null)
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-strong"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-2">
              {PROBLEM_REASONS.map(
                (reason) => {
                  const selected =
                    problemDraft.reasons.includes(
                      reason.value
                    );

                  return (
                    <button
                      key={reason.value}
                      type="button"
                      onClick={() =>
                        toggleProblemReason(
                          reason.value
                        )
                      }
                      className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                        selected
                          ? "border-red-500 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                          : "border-border bg-surface-strong"
                      }`}
                    >
                      <span>
                        {reason.label}
                      </span>

                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                          selected
                            ? "border-red-600 bg-red-600 text-white"
                            : "border-border"
                        }`}
                      >
                        {selected && (
                          <Check size={15} />
                        )}
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            {problemDraft.reasons.includes(
              "quantity"
            ) && (
              <div className="mt-5">
                <label className="text-sm font-black">
                  Quantité constatée
                </label>

                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={
                    problemDraft.observedQuantity ??
                    0
                  }
                  onChange={(event) =>
                    setProblemDraft(
                      (current) => ({
                        ...current,
                        observedQuantity:
                          Math.max(
                            0,
                            Number(
                              event.target.value
                            ) || 0
                          ),
                      })
                    )
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-base font-bold outline-none focus:border-red-500"
                />
              </div>
            )}

            {problemDraft.reasons.includes(
              "other"
            ) && (
              <div className="mt-5">
                <label className="text-sm font-black">
                  Commentaire
                </label>

                <textarea
                  value={
                    problemDraft.comment
                  }
                  onChange={(event) =>
                    setProblemDraft(
                      (current) => ({
                        ...current,
                        comment:
                          event.target.value,
                      })
                    )
                  }
                  rows={3}
                  placeholder="Décrivez le problème..."
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-red-500"
                />
              </div>
            )}

            {problemDraft.reasons.length > 0 &&
              replacementNeed > 0 && (
              <div
                className={`mt-5 rounded-2xl border p-4 ${
                  replacementPossible
                    ? "border-emerald-400 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                    : "border-orange-400 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Stock pharmacie
                </p>

                <div className="mt-2 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-2xl font-black">
                      {stockAvailable}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      disponible(s)
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black">
                      {replacementNeed} nécessaire(s)
                    </p>
                    <p
                      className={`mt-1 text-xs font-bold ${
                        replacementPossible
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-orange-700 dark:text-orange-300"
                      }`}
                    >
                      {replacementPossible
                        ? "Remplacement possible"
                        : "Stock insuffisant"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-border/70 bg-background/60 px-3 py-3">
                  <div className="flex items-start gap-2">
                    <MapPin
                      size={17}
                      className="mt-0.5 shrink-0 text-muted-foreground"
                    />

                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                        Emplacement pharmacie
                      </p>

                      <p className="mt-1 text-sm font-black leading-5">
                        {problemItem?.medicalItem?.location?.trim() ||
                          "Emplacement non renseigné"}
                      </p>
                    </div>
                  </div>
                </div>

                {replacementPossible && (
                  <div className="mt-4">
                    {problemDraft.replacementRequested ? (
                      <div className="space-y-2">
                        <div className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-emerald-600 px-4 py-3 text-sm font-black text-white">
                          <Check size={18} />
                          Remplacement confirmé
                        </div>

                        <button
                          type="button"
                          onClick={cancelReplacement}
                          className="min-h-11 w-full rounded-xl border border-border bg-surface-strong px-4 py-2 text-sm font-bold"
                        >
                          Annuler le remplacement
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={confirmReplacement}
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
                      >
                        <Check size={18} />
                        Remplacer {replacementNeed} depuis le stock
                      </button>
                    )}
                  </div>
                )}

                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {problemDraft.replacementRequested
                    ? "Le remplacement sera prélevé du stock lors de la validation finale du contrôle."
                    : "Le prélèvement ne sera effectué qu'après confirmation du pompier."}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={saveProblem}
              disabled={
                problemDraft.reasons.length ===
                0
              }
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <AlertTriangle size={18} />
              Enregistrer le problème
            </button>
          </div>
        </div>
      )}
    </div>
  );
}