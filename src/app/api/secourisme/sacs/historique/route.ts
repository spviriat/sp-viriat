import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type BusinessRoleAssignment = {
  business_roles:
    | { code: string }
    | { code: string }[]
    | null;
};

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

function createRequestSupabase(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function getBusinessRoleCode(
  assignment: BusinessRoleAssignment
): string | null {
  if (!assignment.business_roles) {
    return null;
  }

  if (Array.isArray(assignment.business_roles)) {
    return assignment.business_roles[0]?.code ?? null;
  }

  return assignment.business_roles.code;
}

async function authenticate(request: Request) {
  const accessToken = getBearerToken(
    request.headers.get("authorization")
  );

  if (!accessToken) {
    return {
      error: NextResponse.json(
        { error: "Vous devez être connecté." },
        { status: 401 }
      ),
      userId: null,
    };
  }

  const requestSupabase = createRequestSupabase(accessToken);

  if (!requestSupabase) {
    return {
      error: NextResponse.json(
        { error: "Configuration serveur incomplète." },
        { status: 500 }
      ),
      userId: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await requestSupabase.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { error: "Session invalide ou expirée." },
        { status: 401 }
      ),
      userId: null,
    };
  }

  const { data: profile, error: profileError } =
    await requestSupabase
      .from("profiles")
      .select("access_role")
      .eq("id", user.id)
      .single();

  if (profileError || !profile) {
    return {
      error: NextResponse.json(
        { error: "Profil utilisateur introuvable." },
        { status: 403 }
      ),
      userId: null,
    };
  }

  if (profile.access_role === "admin") {
    return {
      error: null,
      userId: user.id,
    };
  }

  const {
    data: assignments,
    error: assignmentsError,
  } = await requestSupabase
    .from("profile_business_roles")
    .select(`
      business_roles!inner (
        code
      )
    `)
    .eq("profile_id", user.id);

  if (assignmentsError) {
    return {
      error: NextResponse.json(
        { error: "Impossible de vérifier vos droits." },
        { status: 403 }
      ),
      userId: null,
    };
  }

  const allowedRoles = new Set([
    "sapeur_pompier",
    "responsable_pharmacie",
    "chef_centre",
    "adjoint_chef_centre",
  ]);

  const roleCodes = (
    (assignments ?? []) as BusinessRoleAssignment[]
  )
    .map(getBusinessRoleCode)
    .filter((code): code is string => Boolean(code))
    .map((code) => code.trim().toLowerCase());

  const allowed = roleCodes.some((code) =>
    allowedRoles.has(code)
  );

  if (!allowed) {
    return {
      error: NextResponse.json(
        {
          error:
            "Vous n'êtes pas autorisé à consulter l'historique des sacs.",
        },
        { status: 403 }
      ),
      userId: null,
    };
  }

  return {
    error: null,
    userId: user.id,
  };
}

function parseNotes(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return { text: value };
  }
}

export async function GET(request: Request) {
  const { error } = await authenticate(request);

  if (error) {
    return error;
  }

  const url = new URL(request.url);
  const bagCode = url.searchParams.get("bagCode")?.trim() || null;

  const rawLimit = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200)
    : 50;

  let checksQuery = supabaseAdmin
    .from("rescue_bag_checks")
    .select(`
      id,
      bag_id,
      checked_by,
      checked_by_name,
      status,
      notes,
      checked_at,
      rescue_bags!inner (
        id,
        code,
        name
      )
    `)
    .order("checked_at", { ascending: false })
    .limit(limit);

  if (bagCode) {
    checksQuery = checksQuery.eq("rescue_bags.code", bagCode);
  }

  const {
    data: checks,
    error: checksError,
  } = await checksQuery;

  if (checksError) {
    console.error(
      "Erreur historique contrôles sacs :",
      checksError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de charger l'historique des contrôles.",
      },
      { status: 500 }
    );
  }

  if (!checks || checks.length === 0) {
    return NextResponse.json({ checks: [] });
  }

  const checkIds = checks.map((check) => check.id);

  const {
    data: itemRows,
    error: itemRowsError,
  } = await supabaseAdmin
    .from("rescue_bag_check_items")
    .select(`
      id,
      check_id,
      expected_item_id,
      observed_quantity,
      status,
      replaced_from_stock,
      replaced_quantity,
      notes,
      anomaly_resolution_status,
      resolved_at,
      resolved_by,
      resolved_by_name,
      resolution_comment,
      created_at,
      rescue_bag_expected_items!inner (
        id,
        expected_quantity,
        medical_item_id,
        medical_items!inner (
          id,
          name,
          unit
        )
      )
    `)
    .in("check_id", checkIds)
    .order("created_at", { ascending: true });

  if (itemRowsError) {
    console.error(
      "Erreur détail historique sacs :",
      itemRowsError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de charger le détail des contrôles.",
      },
      { status: 500 }
    );
  }

  const itemsByCheck = new Map<string, any[]>();

  for (const row of itemRows ?? []) {
    const current = itemsByCheck.get(row.check_id) ?? [];
    current.push(row);
    itemsByCheck.set(row.check_id, current);
  }

  const responseChecks = checks.map((check: any) => {
    const bag = Array.isArray(check.rescue_bags)
      ? check.rescue_bags[0]
      : check.rescue_bags;

    const items = (itemsByCheck.get(check.id) ?? []).map(
      (row: any) => {
        const expected = Array.isArray(
          row.rescue_bag_expected_items
        )
          ? row.rescue_bag_expected_items[0]
          : row.rescue_bag_expected_items;

        const article = Array.isArray(expected?.medical_items)
          ? expected.medical_items[0]
          : expected?.medical_items;

        return {
          id: row.id,
          expectedItemId: row.expected_item_id,
          article: {
            id: article?.id ?? null,
            name: article?.name ?? "Article inconnu",
            unit: article?.unit ?? null,
          },
          expectedQuantity:
            expected?.expected_quantity ?? null,
          observedQuantity: row.observed_quantity,
          status: row.status,
          replacedFromStock: row.replaced_from_stock,
          replacedQuantity: row.replaced_quantity,
          notes: parseNotes(row.notes),
          anomalyResolutionStatus:
            row.anomaly_resolution_status,
          resolvedAt: row.resolved_at,
          resolvedBy: row.resolved_by,
          resolvedByName:
            row.resolved_by_name,
          resolutionComment:
            row.resolution_comment,
          createdAt: row.created_at,
        };
      }
    );

    const anomalies = items.filter(
      (item: any) => item.status !== "ok"
    );

    return {
      id: check.id,
      bag: {
        id: bag?.id ?? check.bag_id,
        code: bag?.code ?? null,
        name: bag?.name ?? "Sac",
      },
      status: check.status,
      checkedById: check.checked_by,
      checkedByName: check.checked_by_name,
      checkedAt: check.checked_at,
      notes: parseNotes(check.notes),
      anomalyCount: anomalies.length,
      replacementCount: items.filter(
        (item: any) => item.replacedFromStock
      ).length,
      anomalies,
      items,
    };
  });

  return NextResponse.json({
    checks: responseChecks,
  });
}