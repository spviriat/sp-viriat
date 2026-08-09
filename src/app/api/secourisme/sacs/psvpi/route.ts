import { NextResponse } from "next/server";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const READ_ROLES = [
  "sapeur_pompier",
  "responsable_pharmacie",
  "chef_centre",
  "adjoint_chef_centre",
] as const;

type CurrentProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  access_role: string | null;
};

type BusinessRoleAssignment = {
  business_roles:
    | { code: string }
    | { code: string }[]
    | null;
};

type AccessContext = {
  allowed: boolean;
  profile: CurrentProfile | null;
};

type ProblemReason =
  | "absent"
  | "quantity"
  | "expired"
  | "damaged"
  | "other";

type SubmittedItem = {
  expectedItemId?: unknown;
  expectedQuantity?: unknown;
  status?: unknown;
  reasons?: unknown;
  observedQuantity?: unknown;
  comment?: unknown;
  replacementRequested?: unknown;
  replacementQuantity?: unknown;
};

type SubmitPayload = {
  items?: unknown;
};

function getBearerToken(
  authorizationHeader: string | null
) {
  if (
    !authorizationHeader?.startsWith("Bearer ")
  ) {
    return null;
  }

  return authorizationHeader
    .slice("Bearer ".length)
    .trim();
}

function createRequestSupabase(
  accessToken: string
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
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

async function getAccessContext(
  requestSupabase: SupabaseClient<any>,
  currentUserId: string
): Promise<AccessContext> {
  const {
    data: profileData,
    error: profileError,
  } = await requestSupabase
    .from("profiles")
    .select(`
      id,
      first_name,
      last_name,
      access_role
    `)
    .eq("id", currentUserId)
    .single();

  if (profileError || !profileData) {
    console.error(
      "Impossible de récupérer le profil :",
      profileError
    );

    return {
      allowed: false,
      profile: null,
    };
  }

  const profile =
    profileData as CurrentProfile;

  if (profile.access_role === "admin") {
    return {
      allowed: true,
      profile,
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
    .eq("profile_id", currentUserId);

  if (assignmentsError) {
    console.error(
      "Impossible de récupérer les rôles métier :",
      assignmentsError
    );

    return {
      allowed: false,
      profile,
    };
  }

  const codes = (
    (assignments ?? []) as
      BusinessRoleAssignment[]
  )
    .map(getBusinessRoleCode)
    .filter(
      (code): code is string =>
        Boolean(code)
    )
    .map((code) =>
      code.trim().toLowerCase()
    );

  const allowed =
    codes.some((code) =>
      READ_ROLES.includes(
        code as (typeof READ_ROLES)[number]
      )
    );

  return {
    allowed,
    profile,
  };
}

async function authenticateRequest(
  request: Request
) {
  const accessToken =
    getBearerToken(
      request.headers.get("authorization")
    );

  if (!accessToken) {
    return {
      error: NextResponse.json(
        {
          error:
            "Vous devez être connecté.",
        },
        {
          status: 401,
        }
      ),
      user: null,
      profile: null,
    };
  }

  const requestSupabase =
    createRequestSupabase(accessToken);

  if (!requestSupabase) {
    return {
      error: NextResponse.json(
        {
          error:
            "La configuration du serveur est incomplète.",
        },
        {
          status: 500,
        }
      ),
      user: null,
      profile: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await requestSupabase.auth.getUser(
    accessToken
  );

  if (userError || !user) {
    return {
      error: NextResponse.json(
        {
          error:
            "Votre session est invalide ou a expiré.",
        },
        {
          status: 401,
        }
      ),
      user: null,
      profile: null,
    };
  }

  const access =
    await getAccessContext(
      requestSupabase,
      user.id
    );

  if (!access.allowed) {
    return {
      error: NextResponse.json(
        {
          error:
            "Vous n'êtes pas autorisé à utiliser ce contrôle.",
        },
        {
          status: 403,
        }
      ),
      user: null,
      profile: access.profile,
    };
  }

  return {
    error: null,
    user,
    profile: access.profile,
  };
}

export async function GET(
  request: Request
) {
  const {
    error,
  } = await authenticateRequest(request);

  if (error) {
    return error;
  }

  const {
    data: bag,
    error: bagError,
  } = await supabaseAdmin
    .from("rescue_bags")
    .select(`
      id,
      code,
      name,
      description
    `)
    .eq("code", "ps_vpi")
    .eq("is_active", true)
    .single();

  if (bagError || !bag) {
    console.error(
      "Impossible de récupérer le sac PS VPI :",
      bagError
    );

    return NextResponse.json(
      {
        error:
          "Le sac Premier secours VPI n'a pas pu être récupéré.",
      },
      {
        status: 500,
      }
    );
  }

  const {
    data: sections,
    error: sectionsError,
  } = await supabaseAdmin
    .from("rescue_bag_sections")
    .select(`
      id,
      name,
      section_type,
      color,
      display_order,
      parent_section_id
    `)
    .eq("bag_id", bag.id)
    .eq("is_active", true)
    .order("display_order", {
      ascending: true,
    });

  if (sectionsError) {
    console.error(
      "Impossible de récupérer les compartiments :",
      sectionsError
    );

    return NextResponse.json(
      {
        error:
          "Les compartiments du sac n'ont pas pu être récupérés.",
      },
      {
        status: 500,
      }
    );
  }

  const sectionIds =
    (sections ?? []).map(
      (section) => section.id
    );

  let expectedItems: any[] = [];

  if (sectionIds.length > 0) {
    const {
      data,
      error: itemsError,
    } = await supabaseAdmin
      .from("rescue_bag_expected_items")
      .select(`
        id,
        section_id,
        expected_quantity,
        is_required,
        display_order,
        notes,
        medical_items (
          id,
          name,
          unit,
          quantity,
          has_expiration
        )
      `)
      .in("section_id", sectionIds)
      .eq("is_active", true)
      .order("display_order", {
        ascending: true,
      });

    if (itemsError) {
      console.error(
        "Impossible de récupérer le contenu attendu :",
        itemsError
      );

      return NextResponse.json(
        {
          error:
            "Le contenu attendu du sac n'a pas pu être récupéré.",
        },
        {
          status: 500,
        }
      );
    }

    expectedItems = data ?? [];
  }

  const responseSections =
    (sections ?? []).map(
      (section) => ({
        ...section,
        items: expectedItems
          .filter(
            (item) =>
              item.section_id === section.id
          )
          .map((item) => {
            const medicalItem =
              Array.isArray(
                item.medical_items
              )
                ? item.medical_items[0]
                : item.medical_items;

            return {
              id: item.id,
              expectedQuantity:
                item.expected_quantity,
              isRequired:
                item.is_required,
              displayOrder:
                item.display_order,
              notes:
                item.notes,
              medicalItem: medicalItem
                ? {
                    id: medicalItem.id,
                    name: medicalItem.name,
                    unit: medicalItem.unit,
                    stockQuantity:
                      medicalItem.quantity ?? 0,
                    hasExpiration:
                      medicalItem.has_expiration,
                  }
                : null,
            };
          }),
      })
    );

  return NextResponse.json({
    bag,
    sections: responseSections,
  });
}

function normalizeReasons(
  value: unknown
): ProblemReason[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed:
    ProblemReason[] = [
      "absent",
      "quantity",
      "expired",
      "damaged",
      "other",
    ];

  return value.filter(
    (reason): reason is ProblemReason =>
      typeof reason === "string" &&
      allowed.includes(
        reason as ProblemReason
      )
  );
}

function getItemDbStatus(
  status: "validated" | "problem",
  reasons: ProblemReason[]
) {
  if (status === "validated") {
    return "ok";
  }

  const unavailable =
    reasons.includes("expired") ||
    reasons.includes("damaged") ||
    reasons.includes("other");

  return unavailable
    ? "unavailable"
    : "missing";
}

export async function POST(
  request: Request
) {
  const {
    error,
    user,
    profile,
  } = await authenticateRequest(request);

  if (error) {
    return error;
  }

  if (!user || !profile) {
    return NextResponse.json(
      {
        error:
          "Impossible d'identifier le contrôleur.",
      },
      {
        status: 403,
      }
    );
  }

  let payload: SubmitPayload;

  try {
    payload =
      (await request.json()) as
        SubmitPayload;
  } catch {
    return NextResponse.json(
      {
        error:
          "La requête envoyée est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  if (!Array.isArray(payload.items)) {
    return NextResponse.json(
      {
        error:
          "Le détail du contrôle est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  const submittedItems =
    payload.items as SubmittedItem[];

  const {
    data: bag,
    error: bagError,
  } = await supabaseAdmin
    .from("rescue_bags")
    .select("id, name")
    .eq("code", "ps_vpi")
    .eq("is_active", true)
    .single();

  if (bagError || !bag) {
    return NextResponse.json(
      {
        error:
          "Le sac Premier secours VPI est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    data: expectedRows,
    error: expectedError,
  } = await supabaseAdmin
    .from("rescue_bag_expected_items")
    .select(`
      id,
      expected_quantity,
      rescue_bag_sections!inner (
        bag_id
      )
    `)
    .eq(
      "rescue_bag_sections.bag_id",
      bag.id
    );

  if (expectedError) {
    console.error(
      "Impossible de vérifier le contenu attendu :",
      expectedError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier le contenu attendu du sac.",
      },
      {
        status: 500,
      }
    );
  }

  const expectedMap =
    new Map<
      string,
      number
    >(
      (expectedRows ?? []).map(
        (row: any) => [
          row.id,
          row.expected_quantity,
        ]
      )
    );

  if (
    submittedItems.length !==
    expectedMap.size
  ) {
    return NextResponse.json(
      {
        error:
          "Tous les articles du sac doivent être traités avant de terminer le contrôle.",
      },
      {
        status: 400,
      }
    );
  }

  const normalizedItems:
    {
      expected_item_id: string;
      observed_quantity: number;
      status:
        | "ok"
        | "missing"
        | "unavailable";
      replaced_from_stock: boolean;
      replaced_quantity: number;
      notes: string | null;
      replacement_requested: boolean;
      replacement_quantity_requested: number;
    }[] = [];

  let anomalyCount = 0;

  for (const item of submittedItems) {
    if (
      typeof item.expectedItemId !==
        "string" ||
      !expectedMap.has(
        item.expectedItemId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Un article du contrôle est invalide.",
        },
        {
          status: 400,
        }
      );
    }

    const expectedQuantity =
      expectedMap.get(
        item.expectedItemId
      ) ?? 0;

    if (
      item.status !== "validated" &&
      item.status !== "problem"
    ) {
      return NextResponse.json(
        {
          error:
            "Chaque article doit être validé ou signalé en problème.",
        },
        {
          status: 400,
        }
      );
    }

    const reasons =
      normalizeReasons(
        item.reasons
      );

    if (
      item.status === "problem" &&
      reasons.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Un motif est obligatoire pour chaque problème signalé.",
        },
        {
          status: 400,
        }
      );
    }

    let observedQuantity =
      expectedQuantity;

    if (
      reasons.includes("absent")
    ) {
      observedQuantity = 0;
    } else if (
      reasons.includes("quantity")
    ) {
      observedQuantity =
        typeof item.observedQuantity ===
          "number" &&
        Number.isFinite(
          item.observedQuantity
        )
          ? Math.max(
              0,
              Math.floor(
                item.observedQuantity
              )
            )
          : expectedQuantity;
    }

    const dbStatus =
      getItemDbStatus(
        item.status,
        reasons
      );

    if (item.status === "problem") {
      anomalyCount += 1;
    }

    const comment =
      typeof item.comment === "string"
        ? item.comment.trim()
        : "";

    const replacementRequested =
      item.replacementRequested === true;

    const requestedReplacementQuantity =
      replacementRequested &&
      typeof item.replacementQuantity === "number" &&
      Number.isFinite(item.replacementQuantity)
        ? Math.max(
            0,
            Math.floor(item.replacementQuantity)
          )
        : 0;

    if (
      replacementRequested &&
      item.status !== "problem"
    ) {
      return NextResponse.json(
        {
          error:
            "Un remplacement ne peut être demandé que pour un article en problème.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      replacementRequested &&
      requestedReplacementQuantity <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "La quantité de remplacement demandée est invalide.",
        },
        {
          status: 400,
        }
      );
    }

    normalizedItems.push({
      expected_item_id:
        item.expectedItemId,
      observed_quantity:
        observedQuantity,
      status: dbStatus,
      replaced_from_stock: false,
      replaced_quantity: 0,
      replacement_requested:
        replacementRequested,
      replacement_quantity_requested:
        requestedReplacementQuantity,
      notes:
        item.status === "problem"
          ? JSON.stringify({
              reasons,
              comment:
                comment || null,
              expected_quantity:
                expectedQuantity,
            })
          : null,
    });
  }

  const checkedByName =
    `${
      profile.first_name ?? ""
    } ${
      profile.last_name ?? ""
    }`.trim() ||
    user.email ||
    "Utilisateur";

  const globalStatus =
    anomalyCount > 0
      ? "incomplete"
      : "operational";

  const {
    data: createdCheck,
    error: checkError,
  } = await supabaseAdmin
    .from("rescue_bag_checks")
    .insert({
      bag_id: bag.id,
      checked_by: user.id,
      checked_by_name:
        checkedByName,
      status:
        globalStatus,
      notes:
        anomalyCount > 0
          ? JSON.stringify({
              anomaly_count:
                anomalyCount,
            })
          : null,
    })
    .select(`
      id,
      bag_id,
      checked_by,
      checked_by_name,
      status,
      notes,
      checked_at
    `)
    .single();

  if (
    checkError ||
    !createdCheck
  ) {
    console.error(
      "Impossible de créer le contrôle :",
      checkError
    );

    return NextResponse.json(
      {
        error:
          "Le contrôle n'a pas pu être enregistré.",
      },
      {
        status: 500,
      }
    );
  }

  const checkItemsToInsert =
    normalizedItems.map(
      (item) => ({
        check_id:
          createdCheck.id,
        expected_item_id:
          item.expected_item_id,
        observed_quantity:
          item.observed_quantity,
        status:
          item.status,
        replaced_from_stock:
          false,
        replaced_quantity:
          0,
        notes:
          item.notes,
      })
    );

  const {
    data: insertedCheckItems,
    error: itemInsertError,
  } = await supabaseAdmin
    .from("rescue_bag_check_items")
    .insert(
      checkItemsToInsert
    )
    .select(`
      id,
      expected_item_id,
      status
    `);

  if (itemInsertError) {
    console.error(
      "Impossible d'enregistrer le détail du contrôle :",
      itemInsertError
    );

    /*
     * Nettoyage pour éviter de laisser un contrôle global
     * sans ses lignes de détail.
     */
    await supabaseAdmin
      .from("rescue_bag_checks")
      .delete()
      .eq(
        "id",
        createdCheck.id
      );

    return NextResponse.json(
      {
        error:
          "Le détail du contrôle n'a pas pu être enregistré.",
      },
      {
        status: 500,
      }
    );
  }

  const insertedByExpectedItem =
    new Map(
      (insertedCheckItems ?? []).map(
        (row) => [
          row.expected_item_id,
          row,
        ]
      )
    );

  let replacementCount = 0;
  let unresolvedAnomalyCount =
    anomalyCount;

  const replacedExpectedItemIds:
    string[] = [];

  const replacementErrors:
    {
      expectedItemId: string;
      message: string;
    }[] = [];

  for (const item of normalizedItems) {
    if (!item.replacement_requested) {
      continue;
    }

    const inserted =
      insertedByExpectedItem.get(
        item.expected_item_id
      );

    if (!inserted) {
      continue;
    }

    const {
      error: replacementError,
    } = await supabaseAdmin.rpc(
      "restock_rescue_bag_item",
      {
        p_check_item_id:
          inserted.id,
        p_quantity:
          item.replacement_quantity_requested,
        p_actor_id:
          user.id,
        p_actor_name:
          checkedByName,
        p_mark_resolved:
          true,
      }
    );

    if (replacementError) {
      console.error(
        "Erreur remplacement depuis le stock :",
        replacementError
      );

      replacementErrors.push({
        expectedItemId:
          item.expected_item_id,
        message:
          replacementError.message ||
          "Le remplacement n'a pas pu être effectué.",
      });

      continue;
    }

    replacementCount += 1;
    replacedExpectedItemIds.push(
      item.expected_item_id
    );

    unresolvedAnomalyCount =
      Math.max(
        0,
        unresolvedAnomalyCount - 1
      );
  }

  const finalGlobalStatus =
    unresolvedAnomalyCount > 0
      ? "incomplete"
      : "operational";

  if (
    finalGlobalStatus !== globalStatus
  ) {
    await supabaseAdmin
      .from("rescue_bag_checks")
      .update({
        status:
          finalGlobalStatus,
        notes:
          JSON.stringify({
            anomaly_count:
              anomalyCount,
            replacement_count:
              replacementCount,
            unresolved_anomaly_count:
              unresolvedAnomalyCount,
          }),
      })
      .eq("id", createdCheck.id);
  }

  return NextResponse.json(
    {
      message:
        unresolvedAnomalyCount > 0
          ? "Contrôle enregistré avec anomalie."
          : replacementCount > 0
            ? "Contrôle enregistré. Les anomalies remplacées depuis le stock ont été corrigées."
            : "Contrôle enregistré avec succès.",
      check: {
        ...createdCheck,
        status:
          finalGlobalStatus,
      },
      anomalyCount,
      replacementCount,
      unresolvedAnomalyCount,
      replacedExpectedItemIds,
      replacementErrors,
      status:
        finalGlobalStatus,
    },
    {
      status: 201,
    }
  );
}