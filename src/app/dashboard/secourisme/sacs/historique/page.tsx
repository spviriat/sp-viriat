"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ClipboardCheck,
  Download,
  PackageCheck,
  RotateCcw,
  UserRoundCheck,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type HistoryItem = {
  id: string;
  expectedItemId: string;
  article: {
    id: string | null;
    name: string;
    unit: string | null;
  };
  expectedQuantity: number | null;
  observedQuantity: number | null;
  status: string;
  replacedFromStock: boolean;
  replacedQuantity: number | null;
  notes: unknown;
  anomalyResolutionStatus:
    | "to_treat"
    | "resolved_immediately"
    | "resolved_later"
    | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolutionComment: string | null;
  createdAt: string;
};

type HistoryCheck = {
  id: string;
  bag: {
    id: string;
    code: string | null;
    name: string;
  };
  status: string;
  checkedById: string | null;
  checkedByName: string | null;
  checkedAt: string;
  notes: unknown;
  anomalyCount: number;
  replacementCount: number;
  anomalies: HistoryItem[];
  items: HistoryItem[];
};

type HistoryResponse = {
  checks: HistoryCheck[];
  error?: string;
};

type BusinessRoleAssignment = {
  business_roles:
    | { code: string }
    | { code: string }[]
    | null;
};

type PeriodKey =
  | "7d"
  | "30d"
  | "90d"
  | "365d"
  | "custom"
  | "all";

const PERIODS: {
  value: PeriodKey;
  label: string;
  days: number | null;
}[] = [
  {
    value: "7d",
    label: "7 jours",
    days: 7,
  },
  {
    value: "30d",
    label: "30 jours",
    days: 30,
  },
  {
    value: "90d",
    label: "3 mois",
    days: 90,
  },
  {
    value: "365d",
    label: "1 an",
    days: 365,
  },
  {
    value: "custom",
    label: "De date à date",
    days: null,
  },
  {
    value: "all",
    label: "Tout",
    days: null,
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getCheckTone(check: HistoryCheck) {
  if (check.anomalyCount > 0) {
    return {
      label: "Avec anomalie",
      className:
        "border-orange-400 bg-orange-100 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
    };
  }

  return {
    label: "Conforme",
    className:
      "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  };
}

function getItemStatusLabel(status: string) {
  switch (status) {
    case "ok":
      return "Conforme";
    case "replaced":
      return "Remplacé";
    case "problem":
      return "Anomalie";
    default:
      return status || "Inconnu";
  }
}

function getNotesText(notes: unknown) {
  if (!notes) {
    return "";
  }

  if (typeof notes === "string") {
    return notes;
  }

  if (
    typeof notes === "object" &&
    !Array.isArray(notes)
  ) {
    const record =
      notes as Record<string, unknown>;

    const preferred = [
      "comment",
      "comments",
      "reason",
      "reasons",
      "text",
      "message",
    ];

    const values = preferred
      .map((key) => record[key])
      .filter(
        (value) =>
          value !== undefined &&
          value !== null &&
          value !== ""
      )
      .map((value) =>
        Array.isArray(value)
          ? value.join(", ")
          : String(value)
      );

    if (values.length > 0) {
      return values.join(" · ");
    }

    try {
      return JSON.stringify(notes);
    } catch {
      return "";
    }
  }

  return String(notes);
}

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

export default function RescueBagsHistoryPage() {
  const [checks, setChecks] =
    useState<HistoryCheck[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [period, setPeriod] =
    useState<PeriodKey>("30d");

  const [bagCode, setBagCode] =
    useState("all");

  const [controller, setController] =
    useState("all");

  const [dateFrom, setDateFrom] =
    useState("");

  const [dateTo, setDateTo] =
    useState("");

  const [openCheckId, setOpenCheckId] =
    useState<string | null>(null);

  const [isExporting, setIsExporting] =
    useState(false);

  const [canResolveAnomalies, setCanResolveAnomalies] =
    useState(false);

  const [resolveItem, setResolveItem] =
    useState<{
      check: HistoryCheck;
      item: HistoryItem;
    } | null>(null);

  const [resolutionComment, setResolutionComment] =
    useState("");

  const [isResolving, setIsResolving] =
    useState(false);

  const [resolutionError, setResolutionError] =
    useState("");

  const loadHistory = async () => {
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
        .select("access_role")
        .eq("id", session.user.id)
        .single();

      let mayResolve =
        !profileError &&
        profileData?.access_role === "admin";

      if (!mayResolve) {
        const {
          data: assignmentsData,
          error: assignmentsError,
        } = await supabase
          .from("profile_business_roles")
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
            (assignmentsData ?? []) as
              BusinessRoleAssignment[]
          )
            .map(getBusinessRoleCode)
            .filter(
              (code): code is string =>
                Boolean(code)
            )
            .map((code) =>
              code
                .trim()
                .toLowerCase()
            );

          mayResolve =
            roleCodes.includes(
              "responsable_pharmacie"
            );
        }
      }

      setCanResolveAnomalies(
        mayResolve
      );

      const response = await fetch(
        "/api/secourisme/sacs/historique?limit=200",
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
          HistoryResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Impossible de charger l'historique."
        );
      }

      setChecks(result.checks ?? []);
    } catch (error) {
      console.error(
        "Erreur historique sacs :",
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

  useEffect(() => {
    void loadHistory();
  }, []);

  const bags = useMemo(() => {
    const map = new Map<
      string,
      string
    >();

    for (const check of checks) {
      if (check.bag.code) {
        map.set(
          check.bag.code,
          check.bag.name
        );
      }
    }

    return Array.from(
      map.entries()
    ).sort((a, b) =>
      a[1].localeCompare(
        b[1],
        "fr"
      )
    );
  }, [checks]);

  const controllers = useMemo(() => {
    const values = new Set<string>();

    for (const check of checks) {
      if (check.checkedByName) {
        values.add(
          check.checkedByName
        );
      }
    }

    return Array.from(values).sort(
      (a, b) =>
        a.localeCompare(
          b,
          "fr"
        )
    );
  }, [checks]);

  const filteredChecks =
    useMemo(() => {
      const currentPeriod =
        PERIODS.find(
          (entry) =>
            entry.value === period
        );

      const threshold =
        currentPeriod?.days == null
          ? null
          : Date.now() -
            currentPeriod.days *
              24 *
              60 *
              60 *
              1000;

      const customFrom =
        period === "custom" &&
        dateFrom
          ? new Date(
              `${dateFrom}T00:00:00`
            ).getTime()
          : null;

      const customTo =
        period === "custom" &&
        dateTo
          ? new Date(
              `${dateTo}T23:59:59.999`
            ).getTime()
          : null;

      return checks.filter(
        (check) => {
          const checkedAt =
            new Date(
              check.checkedAt
            ).getTime();

          if (
            period !== "custom" &&
            threshold !== null &&
            checkedAt < threshold
          ) {
            return false;
          }

          if (
            customFrom !== null &&
            checkedAt < customFrom
          ) {
            return false;
          }

          if (
            customTo !== null &&
            checkedAt > customTo
          ) {
            return false;
          }

          if (
            bagCode !== "all" &&
            check.bag.code !==
              bagCode
          ) {
            return false;
          }

          if (
            controller !== "all" &&
            check.checkedByName !==
              controller
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      checks,
      period,
      dateFrom,
      dateTo,
      bagCode,
      controller,
    ]);

  const stats = useMemo(() => {
    const total =
      filteredChecks.length;

    const withAnomaly =
      filteredChecks.filter(
        (check) =>
          check.anomalyCount > 0
      ).length;

    const replacements =
      filteredChecks.reduce(
        (sum, check) =>
          sum +
          check.replacementCount,
        0
      );

    const compliant =
      total - withAnomaly;

    return {
      total,
      withAnomaly,
      replacements,
      compliant,
      complianceRate:
        total > 0
          ? Math.round(
              (compliant / total) *
                100
            )
          : 0,
    };
  }, [filteredChecks]);

  const anomalyFollowUp =
    useMemo(() => {
      const allAnomalies =
        filteredChecks.flatMap(
          (check) =>
            check.anomalies.map(
              (item) => ({
                check,
                item,
              })
            )
        );

      return {
        toTreat:
          allAnomalies.filter(
            ({ item }) =>
              item.anomalyResolutionStatus ===
              "to_treat"
          ),
        resolvedImmediately:
          allAnomalies.filter(
            ({ item }) =>
              item.anomalyResolutionStatus ===
              "resolved_immediately"
          ),
        resolvedLater:
          allAnomalies.filter(
            ({ item }) =>
              item.anomalyResolutionStatus ===
              "resolved_later"
          ),
      };
    }, [filteredChecks]);

  const resolveAnomaly = async () => {
    if (
      !resolveItem ||
      isResolving
    ) {
      return;
    }

    setIsResolving(true);
    setResolutionError("");

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
        `/api/secourisme/sacs/historique/${resolveItem.item.id}/resolve`,
        {
          method: "PATCH",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            comment:
              resolutionComment.trim() ||
              undefined,
          }),
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
            "Impossible de résoudre cette anomalie."
        );
      }

      setResolveItem(null);
      setResolutionComment("");
      await loadHistory();
    } catch (error) {
      console.error(
        "Erreur résolution anomalie :",
        error
      );

      setResolutionError(
        error instanceof Error
          ? error.message
          : "Impossible de résoudre cette anomalie."
      );
    } finally {
      setIsResolving(false);
    }
  };

  const controllerStats =
    useMemo(() => {
      const map = new Map<
        string,
        {
          name: string;
          checks: number;
          anomalies: number;
          replacements: number;
          lastCheckAt: string;
        }
      >();

      for (const check of filteredChecks) {
        const name =
          check.checkedByName ??
          "Contrôleur inconnu";

        const current =
          map.get(name) ?? {
            name,
            checks: 0,
            anomalies: 0,
            replacements: 0,
            lastCheckAt:
              check.checkedAt,
          };

        current.checks += 1;
        current.anomalies +=
          check.anomalyCount;
        current.replacements +=
          check.replacementCount;

        if (
          new Date(
            check.checkedAt
          ).getTime() >
          new Date(
            current.lastCheckAt
          ).getTime()
        ) {
          current.lastCheckAt =
            check.checkedAt;
        }

        map.set(name, current);
      }

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.checks - a.checks ||
          a.name.localeCompare(
            b.name,
            "fr"
          )
      );
    }, [filteredChecks]);

  const bagStats = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        checks: number;
        anomalies: number;
        replacements: number;
        lastCheckAt: string;
      }
    >();

    for (const check of filteredChecks) {
      const key =
        check.bag.code ??
        check.bag.id;

      const current =
        map.get(key) ?? {
          name: check.bag.name,
          checks: 0,
          anomalies: 0,
          replacements: 0,
          lastCheckAt:
            check.checkedAt,
        };

      current.checks += 1;
      current.anomalies +=
        check.anomalyCount;
      current.replacements +=
        check.replacementCount;

      if (
        new Date(
          check.checkedAt
        ).getTime() >
        new Date(
          current.lastCheckAt
        ).getTime()
      ) {
        current.lastCheckAt =
          check.checkedAt;
      }

      map.set(key, current);
    }

    return Array.from(
      map.values()
    ).sort((a, b) =>
      a.name.localeCompare(
        b.name,
        "fr"
      )
    );
  }, [filteredChecks]);


  const handleExportExcel = async () => {
    if (
      isExporting ||
      filteredChecks.length === 0
    ) {
      return;
    }

    setIsExporting(true);
    setErrorMessage("");

    try {
      const { Workbook } =
        await import("exceljs");

      const workbook =
        new Workbook();

      // Logo officiel SP Viriat utilisé dans les documents Excel.
      // Le fichier doit être placé dans : public/images/logo-sp-viriat.png
      let logoImageId: number | null =
        null;

      try {
        const logoResponse =
          await fetch(
            "/images/logo-sp-viriat.png"
          );

        if (logoResponse.ok) {
          const logoBuffer =
            await logoResponse.arrayBuffer();

          logoImageId =
            workbook.addImage({
              buffer:
                logoBuffer as any,
              extension: "png",
            });
        }
      } catch (logoError) {
        // L'export reste possible même si le logo est momentanément indisponible.
        console.warn(
          "Logo SP Viriat indisponible pour l'export Excel :",
          logoError
        );
      }

      workbook.creator = "SP Viriat";
      workbook.company = "SP Viriat";
      workbook.subject =
        "Statistiques des contrôles des sacs de secours";
      workbook.title =
        "Dossier de suivi des sacs de secours";
      workbook.created =
        new Date();

      const periodEntry =
        PERIODS.find(
          (entry) =>
            entry.value === period
        );

      const periodLabel =
        period === "custom"
          ? `Du ${
              dateFrom ||
              "début"
            } au ${
              dateTo ||
              "aujourd'hui"
            }`
          : periodEntry?.label ??
            "Tout";

      const selectedBagName =
        bagCode === "all"
          ? "Tous les sacs"
          : bags.find(
              ([code]) =>
                code === bagCode
            )?.[1] ??
            bagCode;

      const selectedController =
        controller === "all"
          ? "Tous les contrôleurs"
          : controller;

      const generatedAt =
        new Date();

      const darkFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: {
          argb: "FF172033",
        },
      };

      const redFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: {
          argb: "FFDC2626",
        },
      };

      const lightFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: {
          argb: "FFF3F4F6",
        },
      };

      const greenFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: {
          argb: "FFDCFCE7",
        },
      };

      const orangeFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: {
          argb: "FFFFEDD5",
        },
      };

      const whiteFont = {
        color: {
          argb: "FFFFFFFF",
        },
        bold: true,
      };

      const border = {
        top: {
          style: "thin" as const,
          color: {
            argb: "FFD1D5DB",
          },
        },
        left: {
          style: "thin" as const,
          color: {
            argb: "FFD1D5DB",
          },
        },
        bottom: {
          style: "thin" as const,
          color: {
            argb: "FFD1D5DB",
          },
        },
        right: {
          style: "thin" as const,
          color: {
            argb: "FFD1D5DB",
          },
        },
      };

      const styleHeaderRow = (
        worksheet: any,
        rowNumber: number,
        startColumn: number,
        endColumn: number
      ) => {
        const row =
          worksheet.getRow(
            rowNumber
          );

        for (
          let column =
            startColumn;
          column <= endColumn;
          column += 1
        ) {
          const cell =
            row.getCell(column);

          cell.fill = darkFill;
          cell.font = whiteFont;
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: true,
          };
          cell.border = border;
        }

        row.height = 24;
      };

      const addSheetTitle = (
        worksheet: any,
        title: string,
        subtitle: string,
        lastColumn: string
      ) => {
        worksheet.mergeCells(
          `A1:${lastColumn}2`
        );

        const titleCell =
          worksheet.getCell("A1");

        titleCell.value = title;
        titleCell.fill = darkFill;
        titleCell.font = {
          color: {
            argb: "FFFFFFFF",
          },
          bold: true,
          size: 20,
        };
        titleCell.alignment = {
          vertical: "middle",
          horizontal: "left",
        };

        worksheet.mergeCells(
          `A3:${lastColumn}3`
        );

        const subtitleCell =
          worksheet.getCell("A3");

        subtitleCell.value =
          subtitle;
        subtitleCell.font = {
          color: {
            argb: "FF6B7280",
          },
          italic: true,
          size: 10,
        };
        subtitleCell.alignment = {
          vertical: "middle",
        };

        worksheet.getRow(1).height =
          28;
        worksheet.getRow(2).height =
          18;
      };

      // -------------------------------------------------
      // FICHE RÉUNION — pensée pour impression A4
      // -------------------------------------------------
      const meeting =
        workbook.addWorksheet(
          "Fiche réunion",
          {
            properties: {
              defaultRowHeight: 18,
            },
            pageSetup: {
              paperSize: 9,
              orientation:
                "portrait",
              fitToPage: true,
              fitToWidth: 1,
              fitToHeight: 1,
              margins: {
                left: 0.35,
                right: 0.35,
                top: 0.45,
                bottom: 0.45,
                header: 0.2,
                footer: 0.2,
              },
            },
          }
        );

      meeting.views = [
        {
          showGridLines: false,
        },
      ];

      meeting.columns = [
        { width: 17 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
      ];

      // En-tête avec le logo officiel à gauche.
      // Le titre commence en C afin de laisser une zone propre au logo.
      meeting.mergeCells(
        "A1:B2"
      );

      if (logoImageId !== null) {
        meeting.addImage(
          logoImageId,
          {
            tl: {
              col: 0.15,
              row: 0.12,
            },
            ext: {
              width: 105,
              height: 105,
            },
            editAs: "oneCell",
          }
        );
      } else {
        meeting.getCell("A1").value =
          "SAPEURS-POMPIERS\nVIRIAT";
        meeting.getCell("A1").font = {
          bold: true,
          color: {
            argb: "FFFFFFFF",
          },
          size: 12,
        };
        meeting.getCell(
          "A1"
        ).alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
      }

      meeting.getCell("A1").fill =
        darkFill;

      meeting.mergeCells(
        "C1:H2"
      );
      meeting.getCell("C1").value =
        "SUIVI DES SACS DE SECOURS";
      meeting.getCell("C1").fill =
        darkFill;
      meeting.getCell("C1").font =
        {
          color: {
            argb: "FFFFFFFF",
          },
          bold: true,
          size: 20,
        };
      meeting.getCell(
        "C1"
      ).alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      meeting.getRow(1).height = 42;
      meeting.getRow(2).height = 42;

      meeting.mergeCells(
        "A3:H3"
      );
      meeting.getCell("A3").value =
        "Fiche de synthèse pour réunion";
      meeting.getCell("A3").fill =
        redFill;
      meeting.getCell("A3").font =
        {
          color: {
            argb: "FFFFFFFF",
          },
          bold: true,
          size: 12,
        };
      meeting.getCell(
        "A3"
      ).alignment = {
        horizontal: "center",
      };

      const infoRows = [
        [
          "Période analysée",
          periodLabel,
          "Sac",
          selectedBagName,
        ],
        [
          "Contrôleur",
          selectedController,
          "Édité le",
          generatedAt,
        ],
      ];

      let meetingRow = 5;

      for (
        const info of infoRows
      ) {
        meeting.mergeCells(
          `A${meetingRow}:B${meetingRow}`
        );
        meeting.mergeCells(
          `C${meetingRow}:D${meetingRow}`
        );
        meeting.mergeCells(
          `E${meetingRow}:F${meetingRow}`
        );
        meeting.mergeCells(
          `G${meetingRow}:H${meetingRow}`
        );

        meeting.getCell(
          `A${meetingRow}`
        ).value = info[0];

        meeting.getCell(
          `C${meetingRow}`
        ).value = info[1];

        meeting.getCell(
          `E${meetingRow}`
        ).value = info[2];

        meeting.getCell(
          `G${meetingRow}`
        ).value = info[3];

        for (
          const address of [
            `A${meetingRow}`,
            `C${meetingRow}`,
            `E${meetingRow}`,
          ]
        ) {
          meeting.getCell(
            address
          ).font = {
            bold: true,
            color: {
              argb: "FF374151",
            },
          };
        }

        for (
          const address of [
            `A${meetingRow}`,
            `C${meetingRow}`,
            `E${meetingRow}`,
            `G${meetingRow}`,
          ]
        ) {
          meeting.getCell(
            address
          ).border = border;
          meeting.getCell(
            address
          ).alignment = {
            vertical: "middle",
            wrapText: true,
          };
        }

        meetingRow += 1;
      }

      meeting.getCell(
        "G6"
      ).numFmt =
        "dd/mm/yyyy hh:mm";

      meeting.mergeCells(
        "A8:H8"
      );
      meeting.getCell("A8").value =
        "INDICATEURS CLÉS";
      meeting.getCell("A8").fill =
        darkFill;
      meeting.getCell("A8").font =
        whiteFont;
      meeting.getCell(
        "A8"
      ).alignment = {
        horizontal: "center",
      };

      const meetingKpis = [
        [
          "Contrôles",
          stats.total,
          greenFill,
        ],
        [
          "Conformes",
          stats.compliant,
          greenFill,
        ],
        [
          "Avec anomalie",
          stats.withAnomaly,
          orangeFill,
        ],
        [
          "Remplacements",
          stats.replacements,
          lightFill,
        ],
      ];

      let kpiColumn = 1;

      for (
        const [
          label,
          value,
          fill,
        ] of meetingKpis
      ) {
        const startColumn =
          kpiColumn;
        const endColumn =
          Math.min(
            kpiColumn + 1,
            8
          );

        meeting.mergeCells(
          9,
          startColumn,
          9,
          endColumn
        );
        meeting.mergeCells(
          10,
          startColumn,
          11,
          endColumn
        );

        const labelCell =
          meeting.getCell(
            9,
            startColumn
          );
        labelCell.value = String(label);
        labelCell.fill =
          fill as any;
        labelCell.font = {
          bold: true,
          color: {
            argb: "FF374151",
          },
        };
        labelCell.alignment = {
          horizontal: "center",
          vertical: "middle",
        };
        labelCell.border =
          border;

        const valueCell =
          meeting.getCell(
            10,
            startColumn
          );
        valueCell.value = String(value);
        valueCell.fill =
          fill as any;
        valueCell.font = {
          bold: true,
          size: 18,
          color: {
            argb: "FF111827",
          },
        };
        valueCell.alignment = {
          horizontal: "center",
          vertical: "middle",
        };
        valueCell.border =
          border;

        kpiColumn += 2;

        if (kpiColumn > 7) {
          break;
        }
      }

      meeting.mergeCells(
        "A12:H12"
      );
      meeting.getCell(
        "A12"
      ).value =
        `Taux de conformité : ${stats.complianceRate}%`;
      meeting.getCell(
        "A12"
      ).fill = lightFill;
      meeting.getCell(
        "A12"
      ).font = {
        bold: true,
        size: 13,
        color: {
          argb: "FF111827",
        },
      };
      meeting.getCell(
        "A12"
      ).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      meeting.getCell(
        "A12"
      ).border = border;

      meeting.mergeCells(
        "A13:H13"
      );
      meeting.getCell(
        "A13"
      ).value =
        "SUIVI PAR SAC";
      meeting.getCell(
        "A13"
      ).fill = darkFill;
      meeting.getCell(
        "A13"
      ).font = whiteFont;
      meeting.getCell(
        "A13"
      ).alignment = {
        horizontal: "center",
      };

      const bagHeaderRow = 14;
      meeting
        .getRow(
          bagHeaderRow
        )
        .values = [
        "Sac",
        "Vérifs",
        "Anomalies",
        "Remplacements",
        "Dernière vérification",
      ];

      meeting.mergeCells(
        `E${bagHeaderRow}:H${bagHeaderRow}`
      );
      styleHeaderRow(
        meeting,
        bagHeaderRow,
        1,
        5
      );

      let currentRow =
        bagHeaderRow + 1;

      for (const entry of bagStats) {
        meeting.getCell(
          currentRow,
          1
        ).value = entry.name;
        meeting.getCell(
          currentRow,
          2
        ).value = entry.checks;
        meeting.getCell(
          currentRow,
          3
        ).value = entry.anomalies;
        meeting.getCell(
          currentRow,
          4
        ).value =
          entry.replacements;

        meeting.mergeCells(
          currentRow,
          5,
          currentRow,
          8
        );

        meeting.getCell(
          currentRow,
          5
        ).value =
          new Date(
            entry.lastCheckAt
          );
        meeting.getCell(
          currentRow,
          5
        ).numFmt =
          "dd/mm/yyyy hh:mm";

        for (
          let column = 1;
          column <= 5;
          column += 1
        ) {
          meeting.getCell(
            currentRow,
            column
          ).border = border;
          meeting.getCell(
            currentRow,
            column
          ).alignment = {
            vertical: "middle",
            wrapText: true,
          };
        }

        currentRow += 1;
      }

      currentRow += 1;

      meeting.mergeCells(
        `A${currentRow}:H${currentRow}`
      );
      meeting.getCell(
        `A${currentRow}`
      ).value =
        "ACTIVITÉ DES CONTRÔLEURS";
      meeting.getCell(
        `A${currentRow}`
      ).fill = darkFill;
      meeting.getCell(
        `A${currentRow}`
      ).font = whiteFont;
      meeting.getCell(
        `A${currentRow}`
      ).alignment = {
        horizontal: "center",
      };

      currentRow += 1;

      const controllerHeader =
        currentRow;

      meeting
        .getRow(
          controllerHeader
        )
        .values = [
        "Contrôleur",
        "Vérifs",
        "Anomalies",
        "Remplacements",
        "Dernière vérification",
      ];

      meeting.mergeCells(
        `E${controllerHeader}:H${controllerHeader}`
      );
      styleHeaderRow(
        meeting,
        controllerHeader,
        1,
        5
      );

      currentRow += 1;

      for (
        const entry of controllerStats.slice(
          0,
          6
        )
      ) {
        meeting.getCell(
          currentRow,
          1
        ).value = entry.name;
        meeting.getCell(
          currentRow,
          2
        ).value = entry.checks;
        meeting.getCell(
          currentRow,
          3
        ).value = entry.anomalies;
        meeting.getCell(
          currentRow,
          4
        ).value =
          entry.replacements;

        meeting.mergeCells(
          currentRow,
          5,
          currentRow,
          8
        );

        meeting.getCell(
          currentRow,
          5
        ).value =
          new Date(
            entry.lastCheckAt
          );
        meeting.getCell(
          currentRow,
          5
        ).numFmt =
          "dd/mm/yyyy hh:mm";

        for (
          let column = 1;
          column <= 5;
          column += 1
        ) {
          meeting.getCell(
            currentRow,
            column
          ).border = border;
          meeting.getCell(
            currentRow,
            column
          ).alignment = {
            vertical: "middle",
            wrapText: true,
          };
        }

        currentRow += 1;
      }

      currentRow += 1;

      meeting.mergeCells(
        `A${currentRow}:H${currentRow}`
      );
      meeting.getCell(
        `A${currentRow}`
      ).value =
        "ANOMALIES À RETENIR";
      meeting.getCell(
        `A${currentRow}`
      ).fill = redFill;
      meeting.getCell(
        `A${currentRow}`
      ).font = whiteFont;
      meeting.getCell(
        `A${currentRow}`
      ).alignment = {
        horizontal: "center",
      };

      currentRow += 1;

      const anomalyRows =
        filteredChecks.flatMap(
          (check) =>
            check.anomalies.map(
              (item) => ({
                check,
                item,
              })
            )
        );

      if (
        anomalyRows.length === 0
      ) {
        meeting.mergeCells(
          `A${currentRow}:H${currentRow + 1}`
        );
        meeting.getCell(
          `A${currentRow}`
        ).value =
          "Aucune anomalie sur la période sélectionnée.";
        meeting.getCell(
          `A${currentRow}`
        ).fill = greenFill;
        meeting.getCell(
          `A${currentRow}`
        ).font = {
          bold: true,
          color: {
            argb: "FF166534",
          },
        };
        meeting.getCell(
          `A${currentRow}`
        ).alignment = {
          horizontal: "center",
          vertical: "middle",
        };
      } else {
        for (
          const {
            check,
            item,
          } of anomalyRows.slice(
            0,
            8
          )
        ) {
          meeting.mergeCells(
            `A${currentRow}:B${currentRow}`
          );
          meeting.mergeCells(
            `C${currentRow}:D${currentRow}`
          );
          meeting.mergeCells(
            `E${currentRow}:F${currentRow}`
          );
          meeting.mergeCells(
            `G${currentRow}:H${currentRow}`
          );

          meeting.getCell(
            `A${currentRow}`
          ).value =
            check.bag.name;
          meeting.getCell(
            `C${currentRow}`
          ).value =
            item.article.name;
          meeting.getCell(
            `E${currentRow}`
          ).value =
            getItemStatusLabel(
              item.status
            );
          meeting.getCell(
            `G${currentRow}`
          ).value =
            item.replacedFromStock
              ? `Remplacé ×${
                  item.replacedQuantity ??
                  0
                }`
              : "Non remplacé";

          for (
            const address of [
              `A${currentRow}`,
              `C${currentRow}`,
              `E${currentRow}`,
              `G${currentRow}`,
            ]
          ) {
            meeting.getCell(
              address
            ).fill = orangeFill;
            meeting.getCell(
              address
            ).border = border;
            meeting.getCell(
              address
            ).alignment = {
              wrapText: true,
              vertical: "middle",
            };
          }

          currentRow += 1;
        }
      }

      meeting.pageSetup.printArea =
        `A1:H${Math.max(
          currentRow + 1,
          30
        )}`;

      meeting.headerFooter.oddFooter =
        "&LSP Viriat&CConfidentiel — usage interne&RPage &P / &N";

      // -------------------------------------------------
      // SYNTHÈSE
      // -------------------------------------------------
      const summarySheet =
        workbook.addWorksheet(
          "Synthèse"
        );

      summarySheet.views = [
        {
          state: "frozen",
          ySplit: 5,
          showGridLines: false,
        },
      ];

      summarySheet.columns = [
        {
          key: "label",
          width: 30,
        },
        {
          key: "value",
          width: 28,
        },
        {
          key: "detail",
          width: 58,
        },
      ];

      addSheetTitle(
        summarySheet,
        "Synthèse des contrôles",
        `Période : ${periodLabel} — Sac : ${selectedBagName} — Contrôleur : ${selectedController}`,
        "C"
      );

      summarySheet.addRow([]);
      summarySheet.addRow([
        "Indicateur",
        "Valeur",
        "Lecture",
      ]);
      styleHeaderRow(
        summarySheet,
        5,
        1,
        3
      );

      const summaryRows = [
        [
          "Contrôles",
          stats.total,
          "Nombre total de vérifications correspondant aux filtres.",
        ],
        [
          "Contrôles conformes",
          stats.compliant,
          "Contrôles terminés sans anomalie.",
        ],
        [
          "Contrôles avec anomalie",
          stats.withAnomaly,
          "Contrôles ayant fait remonter au moins une anomalie.",
        ],
        [
          "Remplacements depuis le stock",
          stats.replacements,
          "Nombre de références remplacées depuis la pharmacie.",
        ],
        [
          "Taux de conformité",
          `${stats.complianceRate}%`,
          "Part des contrôles terminés sans anomalie.",
        ],
      ];

      for (
        const rowData of summaryRows
      ) {
        const row =
          summarySheet.addRow(
            rowData
          );

        row.eachCell(
          (cell: any) => {
            cell.border = border;
            cell.alignment = {
              vertical: "top",
              wrapText: true,
            };
          }
        );
      }

      summarySheet.addRow([]);
      summarySheet.addRow([
        "Filtres appliqués",
        "",
        "",
      ]);

      const filterTitleRow =
        summarySheet.rowCount;

      summarySheet.mergeCells(
        filterTitleRow,
        1,
        filterTitleRow,
        3
      );
      summarySheet.getCell(
        filterTitleRow,
        1
      ).fill = darkFill;
      summarySheet.getCell(
        filterTitleRow,
        1
      ).font = whiteFont;

      for (
        const [
          label,
          value,
        ] of [
          [
            "Période",
            periodLabel,
          ],
          [
            "Sac",
            selectedBagName,
          ],
          [
            "Contrôleur",
            selectedController,
          ],
          [
            "Généré le",
            generatedAt,
          ],
        ]
      ) {
        const row =
          summarySheet.addRow([
            label,
            value,
            "",
          ]);

        row.getCell(1).font = {
          bold: true,
        };

        row.eachCell(
          (cell: any) => {
            cell.border = border;
            cell.alignment = {
              vertical: "middle",
              wrapText: true,
            };
          }
        );
      }

      summarySheet.getColumn(
        2
      ).numFmt =
        "dd/mm/yyyy hh:mm";

      // -------------------------------------------------
      // PAR SAC
      // -------------------------------------------------
      const bagsSheet =
        workbook.addWorksheet(
          "Par sac"
        );

      bagsSheet.views = [
        {
          state: "frozen",
          ySplit: 5,
          showGridLines: false,
        },
      ];

      bagsSheet.columns = [
        {
          header: "Sac",
          key: "bag",
          width: 32,
        },
        {
          header: "Vérifications",
          key: "checks",
          width: 16,
        },
        {
          header: "Anomalies",
          key: "anomalies",
          width: 15,
        },
        {
          header: "Remplacements",
          key: "replacements",
          width: 18,
        },
        {
          header:
            "Dernière vérification",
          key: "last",
          width: 23,
        },
      ];

      addSheetTitle(
        bagsSheet,
        "Statistiques par sac",
        `Filtres : ${periodLabel} — ${selectedController}`,
        "E"
      );

      bagsSheet.getRow(5).values =
        bagsSheet.columns.map(
          (column: any) =>
            column.header
        );
      styleHeaderRow(
        bagsSheet,
        5,
        1,
        5
      );

      for (const entry of bagStats) {
        const row =
          bagsSheet.addRow({
            bag: entry.name,
            checks: entry.checks,
            anomalies:
              entry.anomalies,
            replacements:
              entry.replacements,
            last: new Date(
              entry.lastCheckAt
            ),
          });

        row.getCell(5).numFmt =
          "dd/mm/yyyy hh:mm";

        row.eachCell(
          (cell: any) => {
            cell.border = border;
          }
        );
      }

      bagsSheet.autoFilter =
        "A5:E5";

      // -------------------------------------------------
      // CONTRÔLEURS
      // -------------------------------------------------
      const controllersSheet =
        workbook.addWorksheet(
          "Contrôleurs"
        );

      controllersSheet.views = [
        {
          state: "frozen",
          ySplit: 5,
          showGridLines: false,
        },
      ];

      controllersSheet.columns = [
        {
          header: "Contrôleur",
          key: "name",
          width: 30,
        },
        {
          header: "Vérifications",
          key: "checks",
          width: 16,
        },
        {
          header: "Anomalies",
          key: "anomalies",
          width: 15,
        },
        {
          header: "Remplacements",
          key: "replacements",
          width: 18,
        },
        {
          header:
            "Dernière vérification",
          key: "last",
          width: 23,
        },
      ];

      addSheetTitle(
        controllersSheet,
        "Activité des contrôleurs",
        `Filtres : ${periodLabel} — ${selectedBagName}`,
        "E"
      );

      controllersSheet.getRow(
        5
      ).values =
        controllersSheet.columns.map(
          (column: any) =>
            column.header
        );
      styleHeaderRow(
        controllersSheet,
        5,
        1,
        5
      );

      for (
        const entry of controllerStats
      ) {
        const row =
          controllersSheet.addRow({
            name: entry.name,
            checks: entry.checks,
            anomalies:
              entry.anomalies,
            replacements:
              entry.replacements,
            last: new Date(
              entry.lastCheckAt
            ),
          });

        row.getCell(5).numFmt =
          "dd/mm/yyyy hh:mm";

        row.eachCell(
          (cell: any) => {
            cell.border = border;
          }
        );
      }

      controllersSheet.autoFilter =
        "A5:E5";

      // -------------------------------------------------
      // HISTORIQUE
      // -------------------------------------------------
      const historySheet =
        workbook.addWorksheet(
          "Historique"
        );

      historySheet.views = [
        {
          state: "frozen",
          ySplit: 5,
          showGridLines: false,
        },
      ];

      historySheet.columns = [
        {
          header: "Date",
          key: "date",
          width: 21,
        },
        {
          header: "Sac",
          key: "bag",
          width: 28,
        },
        {
          header: "Contrôleur",
          key: "controller",
          width: 28,
        },
        {
          header: "Statut",
          key: "status",
          width: 18,
        },
        {
          header: "Articles contrôlés",
          key: "items",
          width: 18,
        },
        {
          header: "Anomalies",
          key: "anomalies",
          width: 14,
        },
        {
          header: "Remplacements",
          key: "replacements",
          width: 16,
        },
      ];

      addSheetTitle(
        historySheet,
        "Historique des vérifications",
        `Filtres : ${periodLabel} — ${selectedBagName} — ${selectedController}`,
        "G"
      );

      historySheet.getRow(
        5
      ).values =
        historySheet.columns.map(
          (column: any) =>
            column.header
        );
      styleHeaderRow(
        historySheet,
        5,
        1,
        7
      );

      for (
        const check of filteredChecks
      ) {
        const row =
          historySheet.addRow({
            date: new Date(
              check.checkedAt
            ),
            bag: check.bag.name,
            controller:
              check.checkedByName ??
              "Contrôleur inconnu",
            status:
              check.anomalyCount > 0
                ? "Avec anomalie"
                : "Conforme",
            items:
              check.items.length,
            anomalies:
              check.anomalyCount,
            replacements:
              check.replacementCount,
          });

        row.getCell(1).numFmt =
          "dd/mm/yyyy hh:mm";

        row.eachCell(
          (cell: any) => {
            cell.border = border;
          }
        );

        row.getCell(4).fill =
          check.anomalyCount > 0
            ? orangeFill
            : greenFill;
        row.getCell(4).font = {
          bold: true,
        };
      }

      historySheet.autoFilter =
        "A5:G5";

      // -------------------------------------------------
      // ANOMALIES
      // -------------------------------------------------
      const anomaliesSheet =
        workbook.addWorksheet(
          "Anomalies"
        );

      anomaliesSheet.views = [
        {
          state: "frozen",
          ySplit: 5,
          showGridLines: false,
        },
      ];

      anomaliesSheet.columns = [
        {
          header: "Date",
          key: "date",
          width: 21,
        },
        {
          header: "Sac",
          key: "bag",
          width: 28,
        },
        {
          header: "Contrôleur",
          key: "controller",
          width: 28,
        },
        {
          header: "Article",
          key: "article",
          width: 34,
        },
        {
          header: "Statut",
          key: "status",
          width: 16,
        },
        {
          header: "Attendu",
          key: "expected",
          width: 12,
        },
        {
          header: "Constaté",
          key: "observed",
          width: 12,
        },
        {
          header:
            "Remplacé stock",
          key: "replaced",
          width: 16,
        },
        {
          header:
            "Qté remplacée",
          key: "replacementQuantity",
          width: 16,
        },
        {
          header: "Détail",
          key: "notes",
          width: 45,
        },
      ];

      addSheetTitle(
        anomaliesSheet,
        "Anomalies et remplacements",
        `Filtres : ${periodLabel} — ${selectedBagName} — ${selectedController}`,
        "J"
      );

      anomaliesSheet.getRow(
        5
      ).values =
        anomaliesSheet.columns.map(
          (column: any) =>
            column.header
        );
      styleHeaderRow(
        anomaliesSheet,
        5,
        1,
        10
      );

      for (
        const check of filteredChecks
      ) {
        for (
          const item of check.anomalies
        ) {
          const row =
            anomaliesSheet.addRow({
              date: new Date(
                check.checkedAt
              ),
              bag: check.bag.name,
              controller:
                check.checkedByName ??
                "Contrôleur inconnu",
              article:
                item.article.name,
              status:
                getItemStatusLabel(
                  item.status
                ),
              expected:
                item.expectedQuantity,
              observed:
                item.observedQuantity,
              replaced:
                item.replacedFromStock
                  ? "Oui"
                  : "Non",
              replacementQuantity:
                item.replacedQuantity ??
                0,
              notes:
                getNotesText(
                  item.notes
                ),
            });

          row.getCell(1).numFmt =
            "dd/mm/yyyy hh:mm";

          row.eachCell(
            (cell: any) => {
              cell.border =
                border;
              cell.alignment = {
                vertical:
                  "top",
                wrapText: true,
              };
            }
          );

          row.getCell(5).fill =
            item.replacedFromStock
              ? greenFill
              : orangeFill;
          row.getCell(5).font = {
            bold: true,
          };
        }
      }

      anomaliesSheet.autoFilter =
        "A5:J5";

      // Signature visuelle sur les autres feuilles du dossier.
      if (logoImageId !== null) {
        for (const sheet of [
          summarySheet,
          bagsSheet,
          controllersSheet,
          historySheet,
          anomaliesSheet,
        ]) {
          const lastColumn =
            sheet.columnCount;

          sheet.addImage(
            logoImageId,
            {
              tl: {
                col: Math.max(
                  lastColumn - 1.05,
                  0
                ),
                row: 0.12,
              },
              ext: {
                width: 62,
                height: 62,
              },
              editAs: "oneCell",
            }
          );
        }
      }

      // Mise en page des feuilles détaillées.
      for (
        const sheet of [
          summarySheet,
          bagsSheet,
          controllersSheet,
          historySheet,
          anomaliesSheet,
        ]
      ) {
        sheet.pageSetup = {
          paperSize: 9,
          orientation:
            sheet.name ===
            "Anomalies"
              ? "landscape"
              : "portrait",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: {
            left: 0.3,
            right: 0.3,
            top: 0.45,
            bottom: 0.45,
            header: 0.2,
            footer: 0.2,
          },
        };

        sheet.headerFooter.oddFooter =
          "&LSP Viriat&CConfidentiel — usage interne&RPage &P / &N";
      }

      const buffer =
        await workbook.xlsx.writeBuffer();

      const blob = new Blob(
        [
          buffer as BlobPart,
        ],
        {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement(
          "a"
        );

      const dateLabel =
        new Date()
          .toISOString()
          .slice(0, 10);

      link.href = url;
      link.download =
        `SP_Viriat_controles_sacs_${dateLabel}.xlsx`;

      document.body.appendChild(
        link
      );
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(
        "Erreur export Excel :",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `Export Excel impossible : ${error.message}`
          : "Export Excel impossible."
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />
          <p className="mt-4 text-sm text-muted-foreground">
            Chargement de
            l&apos;historique...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page min-h-screen">
      <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <Link
          href="/dashboard/secourisme"
          className="app-button-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
        >
          <ChevronLeft size={18} />
          Accueil Secourisme
        </Link>

        <header className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
              Suivi des sacs
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Historique & statistiques
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Contrôles réalisés,
              anomalies, remplacements
              depuis le stock et activité
              des contrôleurs.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={
              isExporting ||
              filteredChecks.length === 0
            }
            title={
              filteredChecks.length === 0
                ? "Aucune donnée à exporter avec les filtres actuels."
                : "Exporter le dossier Excel correspondant aux filtres actuels."
            }
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={18} />
            {isExporting
              ? "Préparation..."
              : "Export Excel"}
          </button>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-400 bg-red-100 p-4 text-sm font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Période
              </span>

              <select
                value={period}
                onChange={(event) =>
                  setPeriod(
                    event.target
                      .value as PeriodKey
                  )
                }
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-500"
              >
                {PERIODS.map(
                  (entry) => (
                    <option
                      key={
                        entry.value
                      }
                      value={
                        entry.value
                      }
                    >
                      {entry.label}
                    </option>
                  )
                )}
              </select>
            </label>

            {period === "custom" && (
              <>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Du
                  </span>

                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(event) =>
                      setDateFrom(
                        event.target.value
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-500"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Au
                  </span>

                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(event) =>
                      setDateTo(
                        event.target.value
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-500"
                  />
                </label>
              </>
            )}

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Sac
              </span>

              <select
                value={bagCode}
                onChange={(event) =>
                  setBagCode(
                    event.target.value
                  )
                }
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-500"
              >
                <option value="all">
                  Tous les sacs
                </option>

                {bags.map(
                  ([code, name]) => (
                    <option
                      key={code}
                      value={code}
                    >
                      {name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Contrôleur
              </span>

              <select
                value={controller}
                onChange={(event) =>
                  setController(
                    event.target.value
                  )
                }
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-500"
              >
                <option value="all">
                  Tous les contrôleurs
                </option>

                {controllers.map(
                  (name) => (
                    <option
                      key={name}
                      value={name}
                    >
                      {name}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              setPeriod("30d");
              setDateFrom("");
              setDateTo("");
              setBagCode("all");
              setController("all");
            }}
            className="app-button-secondary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
          >
            <RotateCcw size={16} />
            Réinitialiser les filtres
          </button>

          {period === "custom" && (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Vous pouvez renseigner uniquement une date de début, uniquement une date de fin,
              ou les deux pour limiter précisément la période analysée.
            </p>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={ClipboardCheck}
            label="Contrôles"
            value={stats.total}
          />

          <MetricCard
            icon={PackageCheck}
            label="Conformes"
            value={stats.compliant}
          />

          <MetricCard
            icon={AlertTriangle}
            label="Avec anomalie"
            value={stats.withAnomaly}
          />

          <MetricCard
            icon={RotateCcw}
            label="Remplacements"
            value={stats.replacements}
          />

          <MetricCard
            icon={BarChart3}
            label="Taux conforme"
            value={`${stats.complianceRate}%`}
          />
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-red-500">
                Suivi des anomalies
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Résolution des anomalies
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Les anomalies historiques restent comptabilisées même après résolution.
                Cette zone indique uniquement leur état de traitement actuel.
              </p>
            </div>

            {!canResolveAnomalies && (
              <span className="w-fit rounded-full border border-blue-400 bg-blue-100 px-3 py-1.5 text-xs font-black text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                Lecture seule
              </span>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <ResolutionMetric
              label="À traiter"
              value={
                anomalyFollowUp.toTreat.length
              }
              tone="danger"
            />

            <ResolutionMetric
              label="Résolues immédiatement"
              value={
                anomalyFollowUp
                  .resolvedImmediately
                  .length
              }
              tone="ok"
            />

            <ResolutionMetric
              label="Résolues ultérieurement"
              value={
                anomalyFollowUp.resolvedLater
                  .length
              }
              tone="info"
            />
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-black">
              Anomalies à traiter
            </h3>

            {anomalyFollowUp.toTreat.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-emerald-400 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                Aucune anomalie ouverte avec les filtres actuels.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {anomalyFollowUp.toTreat.map(
                  ({ check, item }) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-orange-300 bg-orange-50 p-4 dark:border-orange-900/70 dark:bg-orange-950/30"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-orange-400 bg-orange-100 px-2.5 py-1 text-[11px] font-black text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
                              À traiter
                            </span>

                            <span className="text-xs font-bold text-muted-foreground">
                              {formatDate(
                                check.checkedAt
                              )}
                            </span>
                          </div>

                          <p className="mt-2 font-black">
                            {item.article.name}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {check.bag.name}
                            {" · "}
                            {check.checkedByName ??
                              "Contrôleur inconnu"}
                          </p>

                          <p className="mt-2 text-xs text-muted-foreground">
                            Attendu :{" "}
                            <strong className="text-foreground">
                              {item.expectedQuantity ??
                                "—"}
                            </strong>
                            {" · "}
                            Constaté :{" "}
                            <strong className="text-foreground">
                              {item.observedQuantity ??
                                "—"}
                            </strong>
                          </p>
                        </div>

                        {canResolveAnomalies && (
                          <button
                            type="button"
                            onClick={() => {
                              setResolveItem({
                                check,
                                item,
                              });
                              setResolutionComment("");
                              setResolutionError("");
                            }}
                            className="min-h-11 shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700"
                          >
                            Marquer comme résolue
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <UserRoundCheck size={20} />
              <h2 className="text-xl font-black">
                Contrôleurs
              </h2>
            </div>

            {controllerStats.length ===
            0 ? (
              <p className="mt-5 text-sm text-muted-foreground">
                Aucun contrôle sur cette
                période.
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 pr-4">
                        Contrôleur
                      </th>
                      <th className="pb-3 pr-4">
                        Vérifs
                      </th>
                      <th className="pb-3 pr-4">
                        Anomalies
                      </th>
                      <th className="pb-3 pr-4">
                        Remplacements
                      </th>
                      <th className="pb-3">
                        Dernière
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {controllerStats.map(
                      (entry) => (
                        <tr
                          key={
                            entry.name
                          }
                          className="border-b border-border/70 last:border-0"
                        >
                          <td className="py-3 pr-4 font-black">
                            {entry.name}
                          </td>
                          <td className="py-3 pr-4">
                            {entry.checks}
                          </td>
                          <td className="py-3 pr-4">
                            {
                              entry.anomalies
                            }
                          </td>
                          <td className="py-3 pr-4">
                            {
                              entry.replacements
                            }
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {formatDate(
                              entry.lastCheckAt
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <BarChart3 size={20} />
              <h2 className="text-xl font-black">
                Par sac
              </h2>
            </div>

            {bagStats.length === 0 ? (
              <p className="mt-5 text-sm text-muted-foreground">
                Aucun contrôle sur cette
                période.
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[580px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 pr-4">
                        Sac
                      </th>
                      <th className="pb-3 pr-4">
                        Vérifs
                      </th>
                      <th className="pb-3 pr-4">
                        Anomalies
                      </th>
                      <th className="pb-3 pr-4">
                        Remplacements
                      </th>
                      <th className="pb-3">
                        Dernière
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {bagStats.map(
                      (entry) => (
                        <tr
                          key={
                            entry.name
                          }
                          className="border-b border-border/70 last:border-0"
                        >
                          <td className="py-3 pr-4 font-black">
                            {entry.name}
                          </td>
                          <td className="py-3 pr-4">
                            {entry.checks}
                          </td>
                          <td className="py-3 pr-4">
                            {
                              entry.anomalies
                            }
                          </td>
                          <td className="py-3 pr-4">
                            {
                              entry.replacements
                            }
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {formatDate(
                              entry.lastCheckAt
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="mt-8">
          <div>
            <h2 className="text-2xl font-black">
              Historique des vérifications
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {filteredChecks.length} contrôle(s)
              correspondant aux filtres.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {filteredChecks.length === 0 ? (
              <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Aucun contrôle à afficher.
              </div>
            ) : (
              filteredChecks.map(
                (check) => {
                  const isOpen =
                    openCheckId ===
                    check.id;

                  const tone =
                    getCheckTone(
                      check
                    );

                  return (
                    <article
                      key={check.id}
                      className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenCheckId(
                            isOpen
                              ? null
                              : check.id
                          )
                        }
                        className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-black">
                            {check.bag.name}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(
                              check.checkedAt
                            )}
                            {" · "}
                            {check.checkedByName ??
                              "Contrôleur inconnu"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black ${tone.className}`}
                        >
                          {tone.label}
                        </span>

                        {isOpen ? (
                          <ChevronUp
                            size={19}
                          />
                        ) : (
                          <ChevronDown
                            size={19}
                          />
                        )}
                      </button>

                      {isOpen && (
                        <div className="border-t border-border p-5">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <SmallStat
                              label="Articles contrôlés"
                              value={
                                check
                                  .items
                                  .length
                              }
                            />
                            <SmallStat
                              label="Anomalies"
                              value={
                                check
                                  .anomalyCount
                              }
                            />
                            <SmallStat
                              label="Remplacements"
                              value={
                                check
                                  .replacementCount
                              }
                            />
                          </div>

                          {check.anomalies
                            .length > 0 && (
                            <div className="mt-5">
                              <h3 className="text-sm font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                                Anomalies
                              </h3>

                              <div className="mt-3 space-y-2">
                                {check.anomalies.map(
                                  (
                                    item
                                  ) => (
                                    <div
                                      key={
                                        item.id
                                      }
                                      className="rounded-2xl border border-orange-300 bg-orange-50 p-4 text-sm dark:border-orange-900/70 dark:bg-orange-950/30"
                                    >
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                          <p className="font-black">
                                            {
                                              item
                                                .article
                                                .name
                                            }
                                          </p>

                                          <p className="mt-1 text-xs text-muted-foreground">
                                            Statut :{" "}
                                            <strong>
                                              {
                                                item.status
                                              }
                                            </strong>
                                            {item.observedQuantity !==
                                              null &&
                                              ` · constaté : ${item.observedQuantity}`}
                                          </p>
                                        </div>

                                        {item.replacedFromStock && (
                                          <span className="rounded-full border border-emerald-400 bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                            Remplacé depuis le stock
                                            {item.replacedQuantity
                                              ? ` ×${item.replacedQuantity}`
                                              : ""}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                }
              )
            )}
          </div>
        </section>
      </main>

      {resolveItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Résoudre une anomalie"
        >
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-500">
                Résolution d&apos;anomalie
              </p>

              <h2 className="mt-2 text-xl font-black">
                {resolveItem.item.article.name}
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {resolveItem.check.bag.name}
                {" · "}
                Contrôle du{" "}
                {formatDate(
                  resolveItem.check.checkedAt
                )}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-surface-strong p-4 text-sm">
              <p>
                Attendu :{" "}
                <strong>
                  {resolveItem.item
                    .expectedQuantity ?? "—"}
                </strong>
              </p>

              <p className="mt-1">
                Constaté :{" "}
                <strong>
                  {resolveItem.item
                    .observedQuantity ?? "—"}
                </strong>
              </p>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-black">
                Commentaire de résolution
              </span>

              <textarea
                value={resolutionComment}
                onChange={(event) =>
                  setResolutionComment(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Ex. Réapprovisionnement effectué, article remis dans le sac..."
                className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />
            </label>

            {resolutionError && (
              <div className="mt-4 rounded-xl border border-red-400 bg-red-100 p-3 text-sm font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {resolutionError}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!isResolving) {
                    setResolveItem(null);
                    setResolutionComment("");
                    setResolutionError("");
                  }
                }}
                disabled={isResolving}
                className="app-button-secondary min-h-12 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={resolveAnomaly}
                disabled={isResolving}
                className="min-h-12 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isResolving
                  ? "Enregistrement..."
                  : "Confirmer la résolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResolutionMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "ok" | "info";
}) {
  const className =
    tone === "danger"
      ? "border-orange-400 bg-orange-100 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
      : tone === "ok"
        ? "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        : "border-blue-400 bg-blue-100 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";

  return (
    <div
      className={`rounded-2xl border p-4 ${className}`}
    >
      <p className="text-xs font-black uppercase tracking-wider">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: string | number;
}) {
  const Icon = icon;

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <Icon
        size={20}
        className="text-red-500"
      />

      <p className="mt-4 text-xs font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-strong p-4">
      <p className="text-xs font-bold text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-xl font-black">
        {value}
      </p>
    </div>
  );
}