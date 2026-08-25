"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import {

  AlertTriangle,

  ArrowLeft,

  CalendarDays,

  CheckCircle2,

  Clock3,

  Download,

  Gauge,

  Eye,

  FilePenLine,

  Filter,

  Loader2,

  Printer,

  Search,

  Shield,

  Trash2,

  X,

} from "lucide-react";

import { supabase } from "@/lib/supabase";

import * as XLSX from "xlsx-js-style";

type Intervention = {

  id: string;

  numero_interne: string | null;

  numero_codis: string | null;

  date_intervention: string;

  heure_bip: string | null;

  heure_depart: string | null;

  heure_retour: string | null;

  categorie: string;

  sous_type: string;

  adresse: string | null;

  lieu: string | null;

  nombre_victimes: number | null;

  informations_victimes: string | null;

  moyens_exterieurs: string | null;

  compte_rendu: string | null;

  date_retour: string | null;

  victimes_details: unknown;

  statut: string;

  created_by: string;

  created_at: string;

};

type Profile = {

  id: string;

  first_name: string | null;

  last_name: string | null;

};

type PersonnelLink = {

  intervention_id: string;

  profile_id: string;

  first_name: string | null;

  last_name: string | null;

};

function formatDate(value: string) {

  return new Intl.DateTimeFormat("fr-FR", {

    day: "2-digit",

    month: "2-digit",

    year: "numeric",

  }).format(new Date(`${value}T12:00:00`));

}

function formatTime(value: string | null) {

  if (!value) return "—";

  return value.slice(0, 5);

}

function timeToMinutes(value: string | null) {

  if (!value) return null;

  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;

}

function elapsedMinutes(start: string | null, end: string | null) {

  const startMinutes = timeToMinutes(start);

  const endMinutes = timeToMinutes(end);

  if (startMinutes === null || endMinutes === null) return null;

  let duration = endMinutes - startMinutes;

  if (duration < 0) duration += 24 * 60;

  return duration;

}

function formatDuration(minutes: number | null) {

  if (minutes === null) return "—";

  const hours = Math.floor(minutes / 60);

  const mins = minutes % 60;

  if (hours === 0) return `${mins} min`;

  if (mins === 0) return `${hours} h`;

  return `${hours} h ${String(mins).padStart(2, "0")}`;

}

function formatVictimDetails(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const entries = Object.entries(item as Record<string, unknown>)
            .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined && entryValue !== "")
            .map(([key, entryValue]) => `${key.replace(/_/g, " ")}: ${String(entryValue)}`);
          return entries.length > 0 ? `Victime ${index + 1} — ${entries.join(" • ")}` : "";
        }
        return String(item);
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined && entryValue !== "")
      .map(([key, entryValue]) => `${key.replace(/_/g, " ")}: ${String(entryValue)}`)
      .join("\n");
  }
  return String(value);
}

function statusLabel(status: string) {

  return status === "terminee" ? "Terminée" : "Brouillon";

}

function excelSheetName(value: string, usedNames: Set<string>) {

  const base =

    value

      .replace(/[\\/?*\[\]:]/g, " ")

      .replace(/\s+/g, " ")

      .trim()

      .slice(0, 31) || "Pompier";

  let name = base;

  let index = 2;

  while (usedNames.has(name)) {

    const suffix = ` ${index}`;

    name = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;

    index += 1;

  }

  usedNames.add(name);

  return name;

}



const EXCEL_THEME = {

  red: "DC2626",

  redDark: "991B1B",

  redLight: "FEE2E2",

  slate: "0F172A",

  slate2: "1E293B",

  muted: "64748B",

  light: "F8FAFC",

  border: "E2E8F0",

  white: "FFFFFF",

  green: "16A34A",

  amber: "D97706",

};

function styleCell(

  cell: any,

  options: {

    fill?: string;

    color?: string;

    bold?: boolean;

    size?: number;

    align?: "left" | "center" | "right";

    border?: boolean;

  } = {}

) {

  if (!cell) return;

  cell.s = {

    font: {

      name: "Aptos",

      sz: options.size ?? 10,

      bold: options.bold ?? false,

      color: { rgb: options.color ?? EXCEL_THEME.slate },

    },

    fill: options.fill

      ? { patternType: "solid", fgColor: { rgb: options.fill } }

      : undefined,

    alignment: {

      vertical: "center",

      horizontal: options.align ?? "left",

      wrapText: true,

    },

    border: options.border

      ? {

          top: { style: "thin", color: { rgb: EXCEL_THEME.border } },

          bottom: { style: "thin", color: { rgb: EXCEL_THEME.border } },

          left: { style: "thin", color: { rgb: EXCEL_THEME.border } },

          right: { style: "thin", color: { rgb: EXCEL_THEME.border } },

        }

      : undefined,

  };

}

function styleRange(

  sheet: XLSX.WorkSheet,

  range: string,

  options: Parameters<typeof styleCell>[1]

) {

  const decoded = XLSX.utils.decode_range(range);

  for (let row = decoded.s.r; row <= decoded.e.r; row += 1) {

    for (let col = decoded.s.c; col <= decoded.e.c; col += 1) {

      const address = XLSX.utils.encode_cell({ r: row, c: col });

      styleCell(sheet[address], options);

    }

  }

}

function styleTableHeader(sheet: XLSX.WorkSheet, rowIndex: number, lastColumn: number) {

  for (let col = 0; col <= lastColumn; col += 1) {

    const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: col })];

    styleCell(cell, {

      fill: EXCEL_THEME.slate,

      color: EXCEL_THEME.white,

      bold: true,

      align: "center",

      border: true,

    });

  }

}

function styleDataArea(

  sheet: XLSX.WorkSheet,

  startRow: number,

  endRow: number,

  lastColumn: number

) {

  for (let row = startRow; row <= endRow; row += 1) {

    for (let col = 0; col <= lastColumn; col += 1) {

      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];

      styleCell(cell, {

        fill: row % 2 === 0 ? EXCEL_THEME.white : EXCEL_THEME.light,

        border: true,

      });

    }

  }

}

export default function InterventionSuiviPage() {

  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [authorized, setAuthorized] = useState(false);

  const [error, setError] = useState("");

  const [interventions, setInterventions] = useState<Intervention[]>([]);

  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const [personnelLinks, setPersonnelLinks] = useState<PersonnelLink[]>([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("tous");

  const [categoryFilter, setCategoryFilter] = useState("toutes");

  const [dateFrom, setDateFrom] = useState("");

  const [dateTo, setDateTo] = useState("");

  const [agentFilter, setAgentFilter] = useState("tous");

  const [viewTarget, setViewTarget] = useState<Intervention | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Intervention | null>(null);

  const [deleting, setDeleting] = useState(false);

  const [exporting, setExporting] = useState(false);

  const loadPage = useCallback(async () => {

    setLoading(true);

    setError("");

    try {

      const {

        data: { session },

        error: sessionError,

      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {

        router.replace("/login");

        return;

      }

      const userId = session.user.id;

      const [profileResult, rolesResult] = await Promise.all([

        supabase

          .from("profiles")

          .select("id, role")

          .eq("id", userId)

          .single(),

        supabase

          .from("profile_business_roles")

          .select(`

            business_roles (

              code

            )

          `)

          .eq("profile_id", userId),

      ]);

      if (profileResult.error) throw profileResult.error;

      if (rolesResult.error) throw rolesResult.error;

      const roleCodes = (rolesResult.data ?? [])

        .map((row: any) => {

          const role = Array.isArray(row.business_roles)

            ? row.business_roles[0]

            : row.business_roles;

          return role?.code ?? null;

        })

        .filter(Boolean);

      const isAdmin =

        String(profileResult.data?.role ?? "").toLowerCase() ===

        "administrateur";

      const canManage =

        isAdmin ||

        roleCodes.includes("chef_centre") ||

        roleCodes.includes("adjoint_chef_centre");

      setAuthorized(canManage);

      if (!canManage) {

        setLoading(false);

        return;

      }

      const interventionResult = await supabase

        .from("interventions")

        .select(`

          id,

          numero_interne,

          numero_codis,

          date_intervention,

          heure_bip,

          heure_depart,

          heure_retour,

          categorie,

          sous_type,

          adresse,

          lieu,

          nombre_victimes,

          informations_victimes,

          moyens_exterieurs,

          compte_rendu,

          date_retour,

          victimes_details,

          statut,

          created_by,

          created_at

        `)

        .order("numero_interne", { ascending: false, nullsFirst: false });

      if (interventionResult.error) throw interventionResult.error;

      const rows = (interventionResult.data ?? []) as Intervention[];

      setInterventions(rows);

      const interventionIds = rows.map((row) => row.id);

      // Les agents engagés sont chargés via une fonction SECURITY DEFINER

      // réservée au commandement/admin. Cela évite que les règles RLS de

      // profiles masquent certains agents présents sur les interventions.

      const agentsResult = await supabase.rpc(

        "get_intervention_agents_management"

      );

      if (agentsResult.error) {

        throw new Error(

          [

            "Impossible de charger les agents engagés.",

            agentsResult.error.message,

            agentsResult.error.details,

            agentsResult.error.hint,

            agentsResult.error.code

              ? `Code : ${agentsResult.error.code}`

              : "",

          ]

            .filter(Boolean)

            .join(" ")

        );

      }

      const interventionIdSet = new Set(interventionIds);

      const links = ((agentsResult.data ?? []) as PersonnelLink[]).filter(

        (link) => interventionIdSet.has(link.intervention_id)

      );

      setPersonnelLinks(links);

      // Le RPC fournit directement le nom des agents engagés.

      // On complète ensuite uniquement avec les créateurs de fiches.

      const map: Record<string, Profile> = {};

      for (const link of links) {

        map[link.profile_id] = {

          id: link.profile_id,

          first_name: link.first_name,

          last_name: link.last_name,

        };

      }

      const creatorIds = [

        ...new Set(

          rows

            .map((row) => row.created_by)

            .filter((id) => Boolean(id) && !map[id])

        ),

      ];

      if (creatorIds.length > 0) {

        const creatorProfilesResult = await supabase

          .from("profiles")

          .select("id, first_name, last_name")

          .in("id", creatorIds);

        if (creatorProfilesResult.error) {

          throw creatorProfilesResult.error;

        }

        for (const profile of creatorProfilesResult.data ?? []) {

          map[profile.id] = profile as Profile;

        }

      }

      setProfiles(map);

    } catch (err: any) {

      const message =

        err instanceof Error

          ? err.message

          : typeof err === "string"

            ? err

            : JSON.stringify(err);

      console.error("ERREUR SUIVI :", message, err);

      setError(

        message ||

          "Impossible de charger le suivi des interventions."

      );

    } finally {

      setLoading(false);

    }

  }, [router]);

  useEffect(() => {

    void loadPage();

  }, [loadPage]);

  const categories = useMemo(

    () =>

      [...new Set(interventions.map((item) => item.categorie))]

        .filter(Boolean)

        .sort((a, b) => a.localeCompare(b, "fr")),

    [interventions]

  );

  const agents = useMemo(() => {

    const engagedProfileIds = [...new Set(personnelLinks.map((link) => link.profile_id))];

    return engagedProfileIds

      .map((id) => profiles[id])

      .filter((profile): profile is Profile => Boolean(profile))

      .sort((a, b) => {

        const nameA = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();

        const nameB = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim();

        return nameA.localeCompare(nameB, "fr");

      });

  }, [personnelLinks, profiles]);

  const filtered = useMemo(() => {

    const query = search.trim().toLowerCase();

    return interventions.filter((item) => {

      if (statusFilter !== "tous" && item.statut !== statusFilter) {

        return false;

      }

      if (

        categoryFilter !== "toutes" &&

        item.categorie !== categoryFilter

      ) {

        return false;

      }

      if (dateFrom && item.date_intervention < dateFrom) {

        return false;

      }

      if (dateTo && item.date_intervention > dateTo) {

        return false;

      }

      if (

        agentFilter !== "tous" &&

        !personnelLinks.some(

          (link) =>

            link.intervention_id === item.id &&

            link.profile_id === agentFilter

        )

      ) {

        return false;

      }

      if (!query) return true;

      const creator = profiles[item.created_by];

      const creatorName = creator

        ? `${creator.first_name ?? ""} ${creator.last_name ?? ""}`

            .trim()

            .toLowerCase()

        : "";

      const engagedNames = personnelLinks

        .filter((link) => link.intervention_id === item.id)

        .map((link) => profiles[link.profile_id])

        .filter(Boolean)

        .map((profile) =>

          `${profile.first_name ?? ""} ${profile.last_name ?? ""}`

            .trim()

            .toLowerCase()

        )

        .join(" ");

      return [

        item.numero_interne,

        item.numero_codis,

        item.categorie,

        item.sous_type,

        item.adresse,

        item.lieu,

        creatorName,

        engagedNames,

      ].some((value) => String(value ?? "").toLowerCase().includes(query));

    });

  }, [

    interventions,

    profiles,

    personnelLinks,

    search,

    statusFilter,

    categoryFilter,

    dateFrom,

    dateTo,

    agentFilter,

  ]);

  const stats = useMemo(() => {

    const completed = filtered.filter((item) => item.statut === "terminee");

    const drafts = filtered.filter((item) => item.statut === "brouillon");

    const operationalMinutes = completed.reduce((total, item) => {

      return total + (elapsedMinutes(item.heure_depart, item.heure_retour) ?? 0);

    }, 0);

    const departureDelays = completed

      .map((item) => elapsedMinutes(item.heure_bip, item.heure_depart))

      .filter((value): value is number => value !== null);

    const averageDepartureDelay =

      departureDelays.length > 0

        ? Math.round(

            departureDelays.reduce((total, value) => total + value, 0) /

              departureDelays.length

          )

        : null;

    return {

      total: filtered.length,

      operationalMinutes,

      averageDepartureDelay,

      drafts: drafts.length,

      completed: completed.length,

    };

  }, [filtered]);

  async function exportExcel() {

    if (exporting || filtered.length === 0) return;

    setExporting(true);

    setError("");

    try {

      const workbook = XLSX.utils.book_new();

      const periodLabel =

        dateFrom || dateTo

          ? `${dateFrom ? formatDate(dateFrom) : "Début"} → ${

              dateTo ? formatDate(dateTo) : "Aujourd'hui"

            }`

          : "Toutes les dates";

      const categoryCounts = new Map<string, number>();

      const subtypeCounts = new Map<string, number>();

      for (const item of filtered) {

        categoryCounts.set(

          item.categorie || "Non renseigné",

          (categoryCounts.get(item.categorie || "Non renseigné") ?? 0) + 1

        );

        subtypeCounts.set(

          item.sous_type || "Non renseigné",

          (subtypeCounts.get(item.sous_type || "Non renseigné") ?? 0) + 1

        );

      }

      const summaryRows: (string | number)[][] = [

        ["SUIVI DES INTERVENTIONS - SYNTHÈSE"],

        [],

        ["Périmètre de l'export"],

        ["Période", periodLabel],

        [

          "Agent",

          agentFilter === "tous"

            ? "Tous les agents"

            : (() => {

                const agent = profiles[agentFilter];

                return agent

                  ? `${agent.first_name ?? ""} ${agent.last_name ?? ""}`.trim()

                  : agentFilter;

              })(),

        ],

        [

          "Statut",

          statusFilter === "tous" ? "Tous les statuts" : statusLabel(statusFilter),

        ],

        [

          "Type",

          categoryFilter === "toutes" ? "Tous les types" : categoryFilter,

        ],

        ["Recherche", search.trim() || "Aucune"],

        [],

        ["Indicateurs"],

        ["Nombre total d'interventions", stats.total],

        ["Interventions terminées", stats.completed],

        ["Brouillons", stats.drafts],

        ["Temps opérationnel total", formatDuration(stats.operationalMinutes)],

        ["Temps opérationnel total (minutes)", stats.operationalMinutes],

        ["Délai moyen Bip → départ", formatDuration(stats.averageDepartureDelay)],

        [],

        ["Nombre d'interventions par type"],

        ["Type", "Nombre"],

        ...[...categoryCounts.entries()]

          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))

          .map(([label, count]) => [label, count]),

        [],

        ["Nombre d'interventions par motif"],

        ["Motif", "Nombre"],

        ...[...subtypeCounts.entries()]

          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))

          .map(([label, count]) => [label, count]),

      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);

      summarySheet["!cols"] = [{ wch: 42 }, { wch: 30 }];

      summarySheet["!rows"] = [

        { hpt: 34 },

        { hpt: 10 },

        { hpt: 22 },

      ];

      summarySheet["!merges"] = [

        XLSX.utils.decode_range("A1:B1"),

      ];

      summarySheet["!freeze"] = { xSplit: 0, ySplit: 3 };

      styleRange(summarySheet, "A1:B1", {

        fill: EXCEL_THEME.red,

        color: EXCEL_THEME.white,

        bold: true,

        size: 18,

        align: "center",

      });

      const summaryRef = summarySheet["!ref"]

        ? XLSX.utils.decode_range(summarySheet["!ref"])

        : null;

      if (summaryRef) {

        for (let row = 0; row <= summaryRef.e.r; row += 1) {

          const a = summarySheet[XLSX.utils.encode_cell({ r: row, c: 0 })];

          const b = summarySheet[XLSX.utils.encode_cell({ r: row, c: 1 })];

          const label = String(a?.v ?? "");

          if (

            label === "Périmètre de l'export" ||

            label === "Indicateurs" ||

            label === "Nombre d'interventions par type" ||

            label === "Nombre d'interventions par motif"

          ) {

            styleCell(a, {

              fill: EXCEL_THEME.slate,

              color: EXCEL_THEME.white,

              bold: true,

              size: 11,

            });

            styleCell(b, {

              fill: EXCEL_THEME.slate,

              color: EXCEL_THEME.white,

              bold: true,

            });

          } else if (label === "Type" || label === "Motif") {

            styleCell(a, {

              fill: EXCEL_THEME.redDark,

              color: EXCEL_THEME.white,

              bold: true,

              border: true,

            });

            styleCell(b, {

              fill: EXCEL_THEME.redDark,

              color: EXCEL_THEME.white,

              bold: true,

              align: "center",

              border: true,

            });

          } else if (a || b) {

            styleCell(a, { border: Boolean(a?.v) });

            styleCell(b, {

              bold:

                label === "Nombre total d'interventions" ||

                label === "Temps opérationnel total" ||

                label === "Délai moyen Bip → départ",

              color:

                label === "Nombre total d'interventions" ||

                label === "Temps opérationnel total" ||

                label === "Délai moyen Bip → départ"

                  ? EXCEL_THEME.red

                  : EXCEL_THEME.slate,

              border: Boolean(a?.v),

            });

          }

        }

      }

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Synthèse");

      const allRows = filtered.map((item) => {

        const creator = profiles[item.created_by];

        const creatorName = creator

          ? `${creator.first_name ?? ""} ${creator.last_name ?? ""}`.trim()

          : "";

        const engagedNames = personnelLinks

          .filter((link) => link.intervention_id === item.id)

          .map((link) => {

            const profile = profiles[link.profile_id];

            return profile

              ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()

              : "";

          })

          .filter(Boolean)

          .join(", ");

        const duration = elapsedMinutes(item.heure_depart, item.heure_retour);

        const departureDelay = elapsedMinutes(item.heure_bip, item.heure_depart);

        return {

          "N° Inter": item.numero_interne ?? "",

          "N° CODIS": item.numero_codis ?? "",

          Date: formatDate(item.date_intervention),

          Bip: formatTime(item.heure_bip),

          Départ: formatTime(item.heure_depart),

          Retour: formatTime(item.heure_retour),

          "Délai départ": formatDuration(departureDelay),

          "Délai départ (min)": departureDelay ?? "",

          "Durée intervention": formatDuration(duration),

          "Durée intervention (min)": duration ?? "",

          Type: item.categorie ?? "",

          Motif: item.sous_type ?? "",

          Adresse: item.adresse ?? "",

          Lieu: item.lieu ?? "",

          "Agents engagés": engagedNames,

          "Créée par": creatorName,

          Statut: statusLabel(item.statut),

        };

      });

      const allSheet = XLSX.utils.json_to_sheet(allRows);

      allSheet["!cols"] = [

        { wch: 16 },

        { wch: 16 },

        { wch: 12 },

        { wch: 9 },

        { wch: 9 },

        { wch: 9 },

        { wch: 18 },

        { wch: 18 },

        { wch: 20 },

        { wch: 22 },

        { wch: 20 },

        { wch: 28 },

        { wch: 35 },

        { wch: 25 },

        { wch: 45 },

        { wch: 25 },

        { wch: 14 },

      ];

      allSheet["!freeze"] = { xSplit: 0, ySplit: 1 };

      allSheet["!autofilter"] = {

        ref: `A1:Q${Math.max(1, allRows.length + 1)}`,

      };

      allSheet["!rows"] = [{ hpt: 28 }];

      styleTableHeader(allSheet, 0, 16);

      if (allRows.length > 0) {

        styleDataArea(allSheet, 1, allRows.length, 16);

      }

      XLSX.utils.book_append_sheet(

        workbook,

        allSheet,

        "Toutes les interventions"

      );

      // Une feuille est créée pour chaque pompier réellement présent sur

      // au moins une intervention du périmètre filtré.

      const filteredIds = new Set(filtered.map((item) => item.id));

      const visibleLinks = personnelLinks.filter((link) =>

        filteredIds.has(link.intervention_id)

      );

      const agentIds = [...new Set(visibleLinks.map((link) => link.profile_id))];

      const usedSheetNames = new Set<string>([

        "Synthèse",

        "Toutes les interventions",

      ]);

      for (const agentId of agentIds) {

        const profile = profiles[agentId];

        if (!profile) continue;

        const agentName =

          `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||

          "Pompier";

        const agentInterventionIds = new Set(

          visibleLinks

            .filter((link) => link.profile_id === agentId)

            .map((link) => link.intervention_id)

        );

        const agentInterventions = filtered.filter((item) =>

          agentInterventionIds.has(item.id)

        );

        const agentMinutes = agentInterventions.reduce(

          (total, item) =>

            total +

            (elapsedMinutes(item.heure_depart, item.heure_retour) ?? 0),

          0

        );

        const agentDepartureDelays = agentInterventions

          .map((item) => elapsedMinutes(item.heure_bip, item.heure_depart))

          .filter((value): value is number => value !== null);

        const agentAverageDepartureDelay =

          agentDepartureDelays.length > 0

            ? Math.round(

                agentDepartureDelays.reduce((total, value) => total + value, 0) /

                  agentDepartureDelays.length

              )

            : null;

        const agentRows: (string | number)[][] = [

          [agentName],

          [],

          ["Nombre d'interventions", agentInterventions.length],

          ["Temps total en intervention", formatDuration(agentMinutes)],

          ["Temps total en intervention (minutes)", agentMinutes],

          [

            "Durée moyenne",

            agentInterventions.length > 0

              ? formatDuration(Math.round(agentMinutes / agentInterventions.length))

              : "—",

          ],

          ["Délai moyen Bip → départ", formatDuration(agentAverageDepartureDelay)],

          [],

          [

            "N° Inter",

            "N° CODIS",

            "Date",

            "Bip",

            "Départ",

            "Retour",

            "Durée",

            "Type",

            "Motif",

            "Adresse / lieu",

            "Statut",

          ],

          ...agentInterventions.map((item) => [

            item.numero_interne ?? "",

            item.numero_codis ?? "",

            formatDate(item.date_intervention),

            formatTime(item.heure_bip),

            formatTime(item.heure_depart),

            formatTime(item.heure_retour),

            formatDuration(elapsedMinutes(item.heure_depart, item.heure_retour)),

            item.categorie ?? "",

            item.sous_type ?? "",

            [item.adresse, item.lieu].filter(Boolean).join(" - "),

            statusLabel(item.statut),

          ]),

        ];

        const agentSheet = XLSX.utils.aoa_to_sheet(agentRows);

        agentSheet["!merges"] = [XLSX.utils.decode_range("A1:K1")];

        agentSheet["!freeze"] = { xSplit: 0, ySplit: 9 };

        agentSheet["!rows"] = [

          { hpt: 32 },

          { hpt: 8 },

        ];

        agentSheet["!cols"] = [

          { wch: 16 },

          { wch: 16 },

          { wch: 12 },

          { wch: 9 },

          { wch: 9 },

          { wch: 9 },

          { wch: 18 },

          { wch: 20 },

          { wch: 28 },

          { wch: 40 },

          { wch: 14 },

        ];

        styleRange(agentSheet, "A1:K1", {

          fill: EXCEL_THEME.red,

          color: EXCEL_THEME.white,

          bold: true,

          size: 17,

          align: "center",

        });

        for (let row = 2; row <= 6; row += 1) {

          styleCell(agentSheet[XLSX.utils.encode_cell({ r: row, c: 0 })], {

            fill: EXCEL_THEME.light,

            bold: true,

            border: true,

          });

          styleCell(agentSheet[XLSX.utils.encode_cell({ r: row, c: 1 })], {

            color: row === 2 || row === 3 ? EXCEL_THEME.red : EXCEL_THEME.slate,

            bold: true,

            border: true,

          });

        }

        styleTableHeader(agentSheet, 8, 10);

        if (agentInterventions.length > 0) {

          styleDataArea(

            agentSheet,

            9,

            8 + agentInterventions.length,

            10

          );

          agentSheet["!autofilter"] = {

            ref: `A9:K${9 + agentInterventions.length}`,

          };

        }

        XLSX.utils.book_append_sheet(

          workbook,

          agentSheet,

          excelSheetName(agentName, usedSheetNames)

        );

      }

      const datePart = new Date().toISOString().slice(0, 10);

      XLSX.writeFile(

        workbook,

        `suivi-interventions-${datePart}.xlsx`,

        { compression: true }

      );

    } catch (err: any) {

      console.error("ERREUR EXPORT EXCEL :", err);

      setError(

        err?.message ||

          "Impossible de générer l'export Excel."

      );

    } finally {

      setExporting(false);

    }

  }

  async function confirmDelete() {

    if (!deleteTarget || deleting) return;

    setDeleting(true);

    setError("");

    try {

      const { error: rpcError } = await supabase.rpc(

        "delete_intervention_and_renumber",

        {

          p_intervention_id: deleteTarget.id,

        }

      );

      if (rpcError) throw rpcError;

      setDeleteTarget(null);

      await loadPage();

    } catch (err: any) {

      console.error(err);

      setError(

        err?.message ||

          "Impossible de supprimer cette intervention."

      );

    } finally {

      setDeleting(false);

    }

  }

  if (loading) {

    return (

      <main className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4">

        <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">

          <Loader2 className="animate-spin" size={20} />

          Chargement du suivi...

        </div>

      </main>

    );

  }

  if (!authorized) {

    return (

      <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4">

        <section className="w-full rounded-3xl border border-red-500/30 bg-card p-8 text-center shadow-sm">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">

            <Shield size={26} />

          </div>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-red-500">

            Accès restreint

          </p>

          <h1 className="mt-2 text-2xl font-black">

            Suivi réservé au commandement

          </h1>

          <p className="mt-3 text-sm text-muted-foreground">

            Cette page est accessible uniquement à l&apos;administrateur,

            au chef de centre et à l&apos;adjoint chef de centre.

          </p>

          <Link

            href="/dashboard/interventions"

            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white hover:bg-red-700"

          >

            <ArrowLeft size={18} />

            Retour aux interventions

          </Link>

        </section>

      </main>

    );

  }

  return (

    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <Link

            href="/dashboard/interventions"

            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"

          >

            <ArrowLeft size={17} />

            Interventions

          </Link>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-red-500">

            Commandement

          </p>

          <h1 className="mt-1 text-3xl font-black sm:text-4xl">

            Suivi des interventions

          </h1>

          <p className="mt-2 text-sm text-muted-foreground">

            Consultez, recherchez et gérez les fiches d&apos;intervention du centre.

          </p>

        </div>

        <button

          type="button"

          onClick={() => void exportExcel()}

          disabled={exporting || filtered.length === 0}

          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"

        >

          {exporting ? (

            <Loader2 className="animate-spin" size={18} />

          ) : (

            <Download size={18} />

          )}

          {exporting ? "Export en cours..." : "Exporter Excel"}

        </button>

      </div>

      {error && (

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-500">

          <AlertTriangle className="mt-0.5 shrink-0" size={19} />

          <span>{error}</span>

        </div>

      )}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

        <StatCard

          icon={CalendarDays}

          label="Interventions"

          value={stats.total}

          description="Selon les filtres actifs"

        />

        <StatCard

          icon={Clock3}

          label="Temps opérationnel"

          value={formatDuration(stats.operationalMinutes)}

          description="Départ → retour"

        />

        <StatCard

          icon={Gauge}

          label="Délai moyen départ"

          value={formatDuration(stats.averageDepartureDelay)}

          description="Bip → départ"

        />

        <StatCard

          icon={FilePenLine}

          label="À terminer"

          value={stats.drafts}

          description="Brouillons en attente"

        />

        <StatCard

          icon={CheckCircle2}

          label="Terminées"

          value={stats.completed}

          description="Fiches validées"

        />

      </section>

      <section className="mt-7 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">

        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.4fr)_repeat(5,minmax(150px,0.8fr))]">

          <label className="relative">

            <Search

              size={18}

              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"

            />

            <input

              value={search}

              onChange={(e) => setSearch(e.target.value)}

              placeholder="N° inter, CODIS, motif, lieu, agent..."

              className="min-h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-red-500"

            />

          </label>

          <label>

            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">

              Du

            </span>

            <input

              type="date"

              value={dateFrom}

              max={dateTo || undefined}

              onChange={(e) => setDateFrom(e.target.value)}

              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-500"

            />

          </label>

          <label>

            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">

              Au

            </span>

            <input

              type="date"

              value={dateTo}

              min={dateFrom || undefined}

              onChange={(e) => setDateTo(e.target.value)}

              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-500"

            />

          </label>

          <label>

            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">

              Agent engagé

            </span>

            <select

              value={agentFilter}

              onChange={(e) => setAgentFilter(e.target.value)}

              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-500"

            >

              <option value="tous">Tous les agents</option>

              {agents.map((agent) => (

                <option key={agent.id} value={agent.id}>

                  {`${agent.first_name ?? ""} ${agent.last_name ?? ""}`.trim()}

                </option>

              ))}

            </select>

          </label>

          <label>

            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">

              Statut

            </span>

            <select

              value={statusFilter}

              onChange={(e) => setStatusFilter(e.target.value)}

              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-500"

            >

              <option value="tous">Tous les statuts</option>

              <option value="brouillon">Brouillons</option>

              <option value="terminee">Terminées</option>

            </select>

          </label>

          <label>

            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">

              Type

            </span>

            <select

              value={categoryFilter}

              onChange={(e) => setCategoryFilter(e.target.value)}

              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-red-500"

            >

              <option value="toutes">Tous les types</option>

              {categories.map((category) => (

                <option key={category} value={category}>

                  {category}

                </option>

              ))}

            </select>

          </label>

        </div>

        <p className="mt-3 text-xs font-semibold text-muted-foreground">

          {filtered.length} intervention{filtered.length > 1 ? "s" : ""} affichée

          {filtered.length > 1 ? "s" : ""}

        </p>

      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">

        <div className="border-b border-border px-5 py-5 sm:px-6">

          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">

            Registre opérationnel

          </p>

          <h2 className="mt-1 text-xl font-black">

            Toutes les interventions

          </h2>

        </div>

        {filtered.length === 0 ? (

          <div className="px-6 py-16 text-center">

            <CalendarDays

              size={30}

              className="mx-auto text-muted-foreground"

            />

            <p className="mt-4 font-black">

              Aucune intervention trouvée

            </p>

            <p className="mt-1 text-sm text-muted-foreground">

              Modifiez vos filtres ou votre recherche.

            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1450px] text-left">

              <thead className="border-b border-border bg-muted/30">

                <tr className="text-xs font-black uppercase tracking-wider text-muted-foreground">

                  <th className="px-5 py-4">N° Inter</th>

                  <th className="px-5 py-4">N° CODIS</th>

                  <th className="px-5 py-4">Date</th>

                  <th className="px-5 py-4">Bip</th>

                  <th className="px-5 py-4">Départ</th>

                  <th className="px-5 py-4">Retour</th>

                  <th className="px-5 py-4">Délai départ</th>

                  <th className="px-5 py-4">Durée inter</th>

                  <th className="px-5 py-4">Type / motif</th>

                  <th className="px-5 py-4">Créée par</th>

                  <th className="px-5 py-4">Statut</th>

                  <th className="px-5 py-4 text-right">Actions</th>

                </tr>

              </thead>

              <tbody className="divide-y divide-border">

                {filtered.map((item) => {

                  const creator = profiles[item.created_by];

                  const creatorName = creator

                    ? `${creator.first_name ?? ""} ${creator.last_name ?? ""}`.trim()

                    : "—";

                  return (

                    <tr

                      key={item.id}

                      className="transition hover:bg-muted/20"

                    >

                      <td className="px-5 py-4 font-black">

                        {item.numero_interne || "—"}

                      </td>

                      <td className="px-5 py-4 text-sm font-bold">

                        {item.numero_codis || "—"}

                      </td>

                      <td className="px-5 py-4 text-sm font-semibold">

                        {formatDate(item.date_intervention)}

                      </td>

                      <td className="px-5 py-4 text-sm font-semibold">

                        {formatTime(item.heure_bip)}

                      </td>

                      <td className="px-5 py-4 text-sm font-semibold">

                        {formatTime(item.heure_depart)}

                      </td>

                      <td className="px-5 py-4 text-sm font-semibold">

                        {formatTime(item.heure_retour)}

                      </td>

                      <td className="px-5 py-4 text-sm font-black">

                        {formatDuration(elapsedMinutes(item.heure_bip, item.heure_depart))}

                      </td>

                      <td className="px-5 py-4 text-sm font-black">

                        {formatDuration(elapsedMinutes(item.heure_depart, item.heure_retour))}

                      </td>

                      <td className="px-5 py-4">

                        <p className="text-sm font-black">

                          {item.sous_type}

                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">

                          {item.categorie}

                        </p>

                      </td>

                      <td className="px-5 py-4 text-sm font-semibold">

                        {creatorName || "—"}

                      </td>

                      <td className="px-5 py-4">

                        <span

                          className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${

                            item.statut === "terminee"

                              ? "bg-emerald-500/10 text-emerald-500"

                              : "bg-amber-500/10 text-amber-500"

                          }`}

                        >

                          {statusLabel(item.statut)}

                        </span>

                      </td>

                      <td className="px-5 py-4">

                        <div className="flex justify-end gap-2">

                          <button
                            type="button"
                            onClick={() => setViewTarget(item)}
                            title="Voir le détail de l'intervention"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500"
                          >
                            <Eye size={18} />
                          </button>

                          <button

                            type="button"

                            title="Supprimer l'intervention"

                            onClick={() => setDeleteTarget(item)}

                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/30 text-red-500 transition hover:bg-red-500 hover:text-white"

                          >

                            <Trash2 size={18} />

                          </button>

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

      {viewTarget && (() => {
        const creator = profiles[viewTarget.created_by];
        const creatorName = creator ? `${creator.first_name ?? ""} ${creator.last_name ?? ""}`.trim() : "";
        const engagedNames = personnelLinks
          .filter((link) => link.intervention_id === viewTarget.id)
          .map((link) => profiles[link.profile_id])
          .filter((profile): profile is Profile => Boolean(profile))
          .map((profile) => `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim())
          .filter(Boolean);
        const victimDetails = formatVictimDetails(viewTarget.victimes_details);

        const printIntervention = () => {
          const popup = window.open("", "_blank", "width=900,height=1100");
          if (!popup) return;
          const esc = (value: unknown) => String(value ?? "—")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
          const row = (label: string, value: unknown) => `<div class="field"><span>${esc(label)}</span><strong>${esc(value || "—")}</strong></div>`;
          popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(viewTarget.numero_interne || "Intervention")}</title><style>
            *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:32px;line-height:1.35}h1{margin:4px 0 0;font-size:28px}.eyebrow{color:#d71920;font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-size:12px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:24px}.grid.two{grid-template-columns:repeat(2,1fr)}.field,.block{border:1px solid #cbd5e1;border-radius:10px;padding:12px}.field span,.block span{display:block;color:#64748b;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.field strong,.block p{display:block;margin:6px 0 0;font-size:14px;white-space:pre-wrap}.block{margin-top:12px}.footer{margin-top:24px;color:#64748b;font-size:11px}@media print{body{margin:14mm}.no-print{display:none}}@media(max-width:700px){.grid,.grid.two{grid-template-columns:1fr}}
          </style></head><body><div class="eyebrow">Fiche d'intervention</div><h1>${esc(viewTarget.numero_interne || "Intervention")}</h1>
          <div class="grid">${row("N° intervention",viewTarget.numero_interne)}${row("N° CODIS",viewTarget.numero_codis)}${row("Date",formatDate(viewTarget.date_intervention))}${row("Heure bip",formatTime(viewTarget.heure_bip))}${row("Départ",formatTime(viewTarget.heure_depart))}${row("Retour",formatTime(viewTarget.heure_retour))}${row("Délai bip → départ",formatDuration(elapsedMinutes(viewTarget.heure_bip,viewTarget.heure_depart)))}${row("Durée intervention",formatDuration(elapsedMinutes(viewTarget.heure_depart,viewTarget.heure_retour)))}${row("Statut",statusLabel(viewTarget.statut))}</div>
          <div class="grid two">${row("Type",viewTarget.categorie)}${row("Motif",viewTarget.sous_type)}${row("Adresse",viewTarget.adresse)}${row("Lieu",viewTarget.lieu)}${row("Nombre de victimes",viewTarget.nombre_victimes ?? 0)}${row("Date retour",viewTarget.date_retour ? formatDate(viewTarget.date_retour) : "—")}</div>
          ${viewTarget.informations_victimes ? `<div class="block"><span>Informations victimes</span><p>${esc(viewTarget.informations_victimes)}</p></div>` : ""}
          ${victimDetails ? `<div class="block"><span>Détails victimes</span><p>${esc(victimDetails)}</p></div>` : ""}
          ${viewTarget.moyens_exterieurs ? `<div class="block"><span>Moyens extérieurs</span><p>${esc(viewTarget.moyens_exterieurs)}</p></div>` : ""}
          ${viewTarget.compte_rendu ? `<div class="block"><span>Compte rendu</span><p>${esc(viewTarget.compte_rendu)}</p></div>` : ""}
          <div class="block"><span>Agents engagés</span><p>${esc(engagedNames.length ? engagedNames.join(", ") : "Aucun agent renseigné")}</p></div><div class="block"><span>Fiche créée par</span><p>${esc(creatorName || "—")}</p></div>
          <p class="footer">Document généré depuis SP Viriat.</p><script>window.onload=()=>{window.print();}</script></body></html>`);
          popup.document.close();
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Fiche d'intervention</p>
                  <h2 className="mt-2 text-2xl font-black">{viewTarget.numero_interne || "Intervention"}</h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Consultation en lecture seule</p>
                </div>
                <button type="button" onClick={() => setViewTarget(null)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground" title="Fermer"><X size={18} /></button>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DetailField label="N° intervention" value={viewTarget.numero_interne || "—"} />
                <DetailField label="N° CODIS" value={viewTarget.numero_codis || "—"} />
                <DetailField label="Date" value={formatDate(viewTarget.date_intervention)} />
                <DetailField label="Heure bip" value={formatTime(viewTarget.heure_bip)} />
                <DetailField label="Départ" value={formatTime(viewTarget.heure_depart)} />
                <DetailField label="Retour" value={formatTime(viewTarget.heure_retour)} />
                <DetailField label="Délai bip → départ" value={formatDuration(elapsedMinutes(viewTarget.heure_bip, viewTarget.heure_depart))} />
                <DetailField label="Durée intervention" value={formatDuration(elapsedMinutes(viewTarget.heure_depart, viewTarget.heure_retour))} />
                <DetailField label="Statut" value={statusLabel(viewTarget.statut)} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailField label="Type" value={viewTarget.categorie || "—"} />
                <DetailField label="Motif" value={viewTarget.sous_type || "—"} />
                <DetailField label="Adresse" value={viewTarget.adresse || "—"} />
                <DetailField label="Lieu" value={viewTarget.lieu || "—"} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailField label="Nombre de victimes" value={String(viewTarget.nombre_victimes ?? 0)} />
                {viewTarget.date_retour && <DetailField label="Date retour" value={formatDate(viewTarget.date_retour)} />}
              </div>
              {viewTarget.informations_victimes && <DetailText label="Informations victimes" value={viewTarget.informations_victimes} />}
              {victimDetails && <DetailText label="Détails victimes" value={victimDetails} />}
              {viewTarget.moyens_exterieurs && <DetailText label="Moyens extérieurs" value={viewTarget.moyens_exterieurs} />}
              {viewTarget.compte_rendu && <DetailText label="Compte rendu" value={viewTarget.compte_rendu} />}
              <div className="mt-4 rounded-2xl border border-border bg-background/50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Agents engagés</p>
                <p className="mt-2 text-sm font-bold">{engagedNames.length > 0 ? engagedNames.join(", ") : "Aucun agent renseigné"}</p>
              </div>
              <div className="mt-4 rounded-2xl border border-border bg-background/50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Fiche créée par</p>
                <p className="mt-2 text-sm font-bold">{creatorName || "—"}</p>
              </div>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setViewTarget(null)} className="min-h-12 rounded-xl border border-border px-6 text-sm font-black transition hover:bg-muted">Fermer</button>
                <button type="button" onClick={printIntervention} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 text-sm font-black text-white transition hover:bg-red-700"><Printer size={18} /> Télécharger / imprimer</button>
              </div>
            </section>
          </div>
        );
      })()}

      {deleteTarget && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">

          <section className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-card p-6 shadow-2xl sm:p-7">

            <div className="flex items-start justify-between gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">

                <Trash2 size={22} />

              </div>

              <button

                type="button"

                onClick={() => !deleting && setDeleteTarget(null)}

                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground"

              >

                <X size={18} />

              </button>

            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-red-500">

              Suppression définitive

            </p>

            <h2 className="mt-2 text-2xl font-black">

              Supprimer {deleteTarget.numero_interne || "cette intervention"} ?

            </h2>

            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">

              <p className="text-sm font-bold text-red-500">

                Cette action supprimera définitivement la fiche et renumérotera

                automatiquement les interventions suivantes de la même série.

              </p>

              <p className="mt-2 text-xs font-semibold text-muted-foreground">

                Le numéro CODIS et les autres séries ne seront pas renumérotés.

              </p>

            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

              <button

                type="button"

                disabled={deleting}

                onClick={() => setDeleteTarget(null)}

                className="min-h-12 rounded-xl border border-border px-5 text-sm font-black transition hover:bg-muted disabled:opacity-50"

              >

                Annuler

              </button>

              <button

                type="button"

                disabled={deleting}

                onClick={() => void confirmDelete()}

                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50"

              >

                {deleting ? (

                  <Loader2 className="animate-spin" size={18} />

                ) : (

                  <Trash2 size={18} />

                )}

                {deleting ? "Suppression..." : "Supprimer définitivement"}

              </button>

            </div>

          </section>

        </div>

      )}

    </main>

  );

}

function DetailText({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-background/50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm font-bold">{value}</p>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-sm font-black">{value}</p>
    </div>
  );
}

function StatCard({

  icon: Icon,

  label,

  value,

  description,

}: {

  icon: typeof CalendarDays;

  label: string;

  value: number | string;

  description: string;

}) {

  return (

    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">

      <div className="flex items-start justify-between gap-4">

        <div>

          <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">

            {label}

          </p>

          <p className="mt-2 text-3xl font-black">{value}</p>

          <p className="mt-1 text-xs font-medium text-muted-foreground">

            {description}

          </p>

        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">

          <Icon size={20} />

        </div>

      </div>

    </div>

  );

}