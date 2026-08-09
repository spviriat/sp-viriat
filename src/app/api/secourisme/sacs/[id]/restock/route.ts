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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SubmittedRestockItem = {
  expectedItemId?: unknown;
  quantity?: unknown;
};

type RestockPayload = {
  interventionReference?: unknown;
  items?: unknown;
};

const BAG_CODE_ALIASES: Record<string, string> = {
  psvpi: "ps_vpi",
  ps_vpi: "ps_vpi",

  oxy: "oxy_vpi",
  oxyvpi: "oxy_vpi",
  oxy_vpi: "oxy_vpi",

  psfpt: "ps_fpt",
  ps_fpt: "ps_fpt",
};

function resolveBagCode(value: string) {
  const normalized =
    value.trim().toLowerCase();

  return (
    BAG_CODE_ALIASES[normalized] ??
    normalized
  );
}

function getBearerToken(
  authorizationHeader: string | null
) {
  if (
    !authorizationHeader?.startsWith(
      "Bearer "
    )
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
    .eq(
      "profile_id",
      currentUserId
    );

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
      request.headers.get(
        "authorization"
      )
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
  } =
    await requestSupabase.auth.getUser(
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
            "Vous n'êtes pas autorisé à réarmer ce sac.",
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

export async function POST(
  request: Request,
  context: RouteContext
) {
  const { id } =
    await context.params;

  const bagCode =
    resolveBagCode(id);

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
          "Impossible d'identifier le sapeur-pompier.",
      },
      {
        status: 403,
      }
    );
  }

  let payload: RestockPayload;

  try {
    payload =
      (await request.json()) as
        RestockPayload;
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

  const interventionReference =
    typeof payload.interventionReference ===
      "string"
      ? payload.interventionReference.trim()
      : "";

  if (!interventionReference) {
    return NextResponse.json(
      {
        error:
          "Le numéro d'intervention est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    interventionReference.length > 100
  ) {
    return NextResponse.json(
      {
        error:
          "Le numéro d'intervention est trop long.",
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
          "Vous devez sélectionner au moins un article à remettre dans le sac.",
      },
      {
        status: 400,
      }
    );
  }

  const submittedItems =
    payload.items as
      SubmittedRestockItem[];

  if (submittedItems.length === 0) {
    return NextResponse.json(
      {
        error:
          "Vous devez sélectionner au moins un article à remettre dans le sac.",
      },
      {
        status: 400,
      }
    );
  }

  const normalizedItems:
    {
      expectedItemId: string;
      quantity: number;
    }[] = [];

  for (const item of submittedItems) {
    if (
      typeof item.expectedItemId !==
        "string" ||
      !item.expectedItemId.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Un article sélectionné est invalide.",
        },
        {
          status: 400,
        }
      );
    }

    const quantity =
      typeof item.quantity === "number" &&
      Number.isFinite(item.quantity)
        ? Math.floor(item.quantity)
        : NaN;

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Chaque quantité à remettre doit être supérieure à zéro.",
        },
        {
          status: 400,
        }
      );
    }

    normalizedItems.push({
      expectedItemId:
        item.expectedItemId.trim(),
      quantity,
    });
  }

  const uniqueExpectedItemIds =
    Array.from(
      new Set(
        normalizedItems.map(
          (item) =>
            item.expectedItemId
        )
      )
    );

  if (
    uniqueExpectedItemIds.length !==
    normalizedItems.length
  ) {
    return NextResponse.json(
      {
        error:
          "Un même article ne peut pas être ajouté plusieurs fois au réarmement.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: bag,
    error: bagError,
  } = await supabaseAdmin
    .from("rescue_bags")
    .select(`
      id,
      code,
      name
    `)
    .eq("code", bagCode)
    .eq("is_active", true)
    .single();

  if (bagError || !bag) {
    return NextResponse.json(
      {
        error:
          "Le sac demandé est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    data: expectedRows,
    error: expectedRowsError,
  } = await supabaseAdmin
    .from(
      "rescue_bag_expected_items"
    )
    .select(`
      id,
      medical_item_id,
      rescue_bag_sections!inner (
        bag_id,
        is_active
      ),
      medical_items!inner (
        id,
        name,
        unit,
        quantity,
        location
      )
    `)
    .in(
      "id",
      uniqueExpectedItemIds
    )
    .eq(
      "rescue_bag_sections.bag_id",
      bag.id
    )
    .eq(
      "rescue_bag_sections.is_active",
      true
    )
    .eq("is_active", true);

  if (expectedRowsError) {
    console.error(
      "Impossible de récupérer les articles à réarmer :",
      expectedRowsError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier les articles du sac.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    (expectedRows ?? []).length !==
    uniqueExpectedItemIds.length
  ) {
    return NextResponse.json(
      {
        error:
          "Un des articles sélectionnés n'appartient pas à ce sac ou n'est plus actif.",
      },
      {
        status: 400,
      }
    );
  }

  const rowsByExpectedItemId =
    new Map(
      (expectedRows ?? []).map(
        (row: any) => [
          row.id,
          row,
        ]
      )
    );

  const preparedItems:
    {
      expectedItemId: string;
      medicalItemId: string;
      medicalItemName: string;
      unit: string | null;
      location: string | null;
      quantity: number;
      stockBefore: number;
      stockAfter: number;
    }[] = [];

  for (const item of normalizedItems) {
    const row =
      rowsByExpectedItemId.get(
        item.expectedItemId
      );

    if (!row) {
      return NextResponse.json(
        {
          error:
            "Un article sélectionné est introuvable.",
        },
        {
          status: 400,
        }
      );
    }

    const medicalRelation =
      Array.isArray(
        row.medical_items
      )
        ? row.medical_items[0]
        : row.medical_items;

    if (!medicalRelation) {
      return NextResponse.json(
        {
          error:
            "Un article sélectionné n'est plus relié au stock pharmacie.",
        },
        {
          status: 400,
        }
      );
    }

    const stockBefore =
      Number(
        medicalRelation.quantity ?? 0
      );

    if (
      !Number.isFinite(stockBefore) ||
      stockBefore < item.quantity
    ) {
      return NextResponse.json(
        {
          error:
            `Stock insuffisant pour ${medicalRelation.name ?? "un article"}.`,
          code:
            "INSUFFICIENT_PHARMACY_STOCK",
          item: {
            expectedItemId:
              item.expectedItemId,
            medicalItemId:
              medicalRelation.id,
            name:
              medicalRelation.name ??
              "Article",
            requestedQuantity:
              item.quantity,
            availableQuantity:
              Number.isFinite(
                stockBefore
              )
                ? stockBefore
                : 0,
            location:
              medicalRelation.location ??
              null,
          },
        },
        {
          status: 409,
        }
      );
    }

    preparedItems.push({
      expectedItemId:
        item.expectedItemId,
      medicalItemId:
        medicalRelation.id,
      medicalItemName:
        medicalRelation.name ??
        "Article",
      unit:
        medicalRelation.unit ?? null,
      location:
        medicalRelation.location ??
        null,
      quantity:
        item.quantity,
      stockBefore,
      stockAfter:
        stockBefore - item.quantity,
    });
  }

  const restockedByName =
    [
      profile.first_name,
      profile.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    user.email ||
    "Utilisateur";

  const {
    data: createdRestock,
    error: restockError,
  } = await supabaseAdmin
    .from("rescue_bag_restocks")
    .insert({
      bag_id:
        bag.id,
      restocked_by:
        user.id,
      restocked_by_name:
        restockedByName,
      intervention_reference:
        interventionReference,
      notes: null,
    })
    .select(`
      id,
      bag_id,
      restocked_by,
      restocked_by_name,
      intervention_reference,
      notes,
      restocked_at
    `)
    .single();

  if (
    restockError ||
    !createdRestock
  ) {
    console.error(
      "Impossible de créer le réarmement :",
      restockError
    );

    return NextResponse.json(
      {
        error:
          "Le réarmement n'a pas pu être enregistré.",
      },
      {
        status: 500,
      }
    );
  }

  const updatedStocks:
    {
      medicalItemId: string;
      stockBefore: number;
    }[] = [];

  for (
    const preparedItem of
    preparedItems
  ) {
    const {
      data: updatedMedicalItem,
      error: stockUpdateError,
    } = await supabaseAdmin
      .from("medical_items")
      .update({
        quantity:
          preparedItem.stockAfter,
      })
      .eq(
        "id",
        preparedItem.medicalItemId
      )
      .eq(
        "quantity",
        preparedItem.stockBefore
      )
      .select(`
        id,
        quantity
      `)
      .maybeSingle();

    if (
      stockUpdateError ||
      !updatedMedicalItem
    ) {
      console.error(
        "Impossible de décrémenter le stock pharmacie :",
        stockUpdateError
      );

      for (
        const previous of
        updatedStocks.reverse()
      ) {
        await supabaseAdmin
          .from("medical_items")
          .update({
            quantity:
              previous.stockBefore,
          })
          .eq(
            "id",
            previous.medicalItemId
          );
      }

      await supabaseAdmin
        .from(
          "rescue_bag_restocks"
        )
        .delete()
        .eq(
          "id",
          createdRestock.id
        );

      return NextResponse.json(
        {
          error:
            `Le stock de ${preparedItem.medicalItemName} a changé pendant le réarmement. Rechargez la page puis réessayez.`,
          code:
            "PHARMACY_STOCK_CHANGED",
        },
        {
          status: 409,
        }
      );
    }

    updatedStocks.push({
      medicalItemId:
        preparedItem.medicalItemId,
      stockBefore:
        preparedItem.stockBefore,
    });
  }

  const restockItemsToInsert =
    preparedItems.map(
      (preparedItem) => ({
        restock_id:
          createdRestock.id,
        expected_item_id:
          preparedItem.expectedItemId,
        quantity:
          preparedItem.quantity,
      })
    );

  const {
    error: restockItemsError,
  } = await supabaseAdmin
    .from(
      "rescue_bag_restock_items"
    )
    .insert(
      restockItemsToInsert
    );

  if (restockItemsError) {
    console.error(
      "Impossible d'enregistrer le détail du réarmement :",
      restockItemsError
    );

    for (
      const previous of
      updatedStocks.reverse()
    ) {
      await supabaseAdmin
        .from("medical_items")
        .update({
          quantity:
            previous.stockBefore,
        })
        .eq(
          "id",
          previous.medicalItemId
        );
    }

    await supabaseAdmin
      .from("rescue_bag_restocks")
      .delete()
      .eq(
        "id",
        createdRestock.id
      );

    return NextResponse.json(
      {
        error:
          "Le détail du réarmement n'a pas pu être enregistré.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json(
    {
      message:
        "Sac réarmé après intervention.",
      restock: createdRestock,
      bag: {
        id: bag.id,
        code: bag.code,
        name: bag.name,
      },
      items:
        preparedItems.map(
          (item) => ({
            expectedItemId:
              item.expectedItemId,
            medicalItemId:
              item.medicalItemId,
            name:
              item.medicalItemName,
            unit:
              item.unit,
            location:
              item.location,
            quantity:
              item.quantity,
            stockBefore:
              item.stockBefore,
            stockAfter:
              item.stockAfter,
          })
        ),
    },
    {
      status: 201,
    }
  );
}