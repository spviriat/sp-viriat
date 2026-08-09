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

const STOCK_WRITE_ROLES = [
  "responsable_pharmacie",
] as const;

type CurrentProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  access_role: string | null;
};

type BusinessRoleAssignment = {
  business_roles:
    | {
        code: string;
      }
    | {
        code: string;
      }[]
    | null;
};

type PermissionResult = {
  canWrite: boolean;
  profile: CurrentProfile | null;
};

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
  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
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
  if (
    !assignment.business_roles
  ) {
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

async function getWritePermission(
  requestSupabase: SupabaseClient<any>,
  currentUserId: string
): Promise<PermissionResult> {
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
    .eq(
      "id",
      currentUserId
    )
    .single();

  if (
    profileError ||
    !profileData
  ) {
    console.error(
      "Impossible de récupérer le profil connecté :",
      profileError
    );

    return {
      canWrite: false,
      profile: null,
    };
  }

  const profile =
    profileData as CurrentProfile;

  if (
    profile.access_role === "admin"
  ) {
    return {
      canWrite: true,
      profile,
    };
  }

  const {
    data: assignmentsData,
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
      canWrite: false,
      profile,
    };
  }

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
      code.trim().toLowerCase()
    );

  const canWrite =
    roleCodes.some((code) =>
      STOCK_WRITE_ROLES.includes(
        code as
          (typeof STOCK_WRITE_ROLES)[number]
      )
    );

  return {
    canWrite,
    profile,
  };
}

async function authenticateRequest(
  request: Request
) {
  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "La configuration du serveur est incomplète.",
          },
          {
            status: 500,
          }
        ),
      currentUser: null,
      permission: null,
    };
  }

  const accessToken =
    getBearerToken(
      request.headers.get(
        "authorization"
      )
    );

  if (!accessToken) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Vous devez être connecté.",
          },
          {
            status: 401,
          }
        ),
      currentUser: null,
      permission: null,
    };
  }

  const requestSupabase =
    createRequestSupabase(
      accessToken
    );

  if (!requestSupabase) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "La configuration du serveur est incomplète.",
          },
          {
            status: 500,
          }
        ),
      currentUser: null,
      permission: null,
    };
  }

  const {
    data: {
      user: currentUser,
    },
    error: currentUserError,
  } =
    await requestSupabase.auth.getUser(
      accessToken
    );

  if (
    currentUserError ||
    !currentUser
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Votre session est invalide ou a expiré.",
          },
          {
            status: 401,
          }
        ),
      currentUser: null,
      permission: null,
    };
  }

  const permission =
    await getWritePermission(
      requestSupabase,
      currentUser.id
    );

  return {
    error: null,
    currentUser,
    permission,
  };
}

function getActorName(
  profile: CurrentProfile,
  email: string | undefined
) {
  return (
    `${
      profile.first_name ?? ""
    } ${
      profile.last_name ?? ""
    }`.trim() ||
    email ||
    "Utilisateur inconnu"
  );
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
      expirationId: string;
    }>;
  }
) {
  const {
    error,
    currentUser,
    permission,
  } =
    await authenticateRequest(
      request
    );

  if (error) {
    return error;
  }

  if (
    !currentUser ||
    !permission ||
    !permission.profile ||
    !permission.canWrite
  ) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à détruire du stock périmé.",
      },
      {
        status: 403,
      }
    );
  }

  const {
    id: medicalItemId,
    expirationId,
  } =
    await context.params;

  if (
    !medicalItemId ||
    !expirationId
  ) {
    return NextResponse.json(
      {
        error:
          "Le lot de péremption est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: article,
    error: articleError,
  } = await supabaseAdmin
    .from("medical_items")
    .select(`
      id,
      name,
      quantity,
      minimum_quantity,
      has_expiration,
      is_active
    `)
    .eq(
      "id",
      medicalItemId
    )
    .maybeSingle();

  if (
    articleError ||
    !article
  ) {
    console.error(
      "Impossible de récupérer l'article :",
      articleError
    );

    return NextResponse.json(
      {
        error:
          "Article introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    data: expiration,
    error: expirationError,
  } = await supabaseAdmin
    .from(
      "medical_item_expirations"
    )
    .select(`
      id,
      medical_item_id,
      quantity,
      expiration_date,
      notes
    `)
    .eq(
      "id",
      expirationId
    )
    .eq(
      "medical_item_id",
      medicalItemId
    )
    .maybeSingle();

  if (
    expirationError ||
    !expiration
  ) {
    console.error(
      "Impossible de récupérer le lot :",
      expirationError
    );

    return NextResponse.json(
      {
        error:
          "Lot de péremption introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const lotQuantity =
    Number(
      expiration.quantity ?? 0
    );

  if (
    !Number.isInteger(lotQuantity) ||
    lotQuantity <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Ce lot ne contient plus de quantité à détruire.",
      },
      {
        status: 400,
      }
    );
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const expirationDate =
    new Date(
      `${expiration.expiration_date}T00:00:00`
    );

  if (
    Number.isNaN(
      expirationDate.getTime()
    ) ||
    expirationDate.getTime() >=
      today.getTime()
  ) {
    return NextResponse.json(
      {
        error:
          "Seuls les lots réellement expirés peuvent être détruits avec cette action.",
      },
      {
        status: 400,
      }
    );
  }

  const previousQuantity =
    Number(
      article.quantity ?? 0
    );

  const newQuantity =
    previousQuantity -
    lotQuantity;

  if (newQuantity < 0) {
    return NextResponse.json(
      {
        error:
          "Le stock global est incohérent avec la quantité du lot expiré.",
      },
      {
        status: 409,
      }
    );
  }

  /*
   * 1. On diminue le stock global.
   */

  const {
    data: updatedArticle,
    error: stockUpdateError,
  } = await supabaseAdmin
    .from("medical_items")
    .update({
      quantity:
        newQuantity,

      updated_by:
        currentUser.id,
    })
    .eq(
      "id",
      medicalItemId
    )
    .select(`
      id,
      name,
      quantity,
      minimum_quantity,
      has_expiration,
      is_active,
      updated_at
    `)
    .single();

  if (
    stockUpdateError ||
    !updatedArticle
  ) {
    console.error(
      "Impossible de diminuer le stock :",
      stockUpdateError
    );

    return NextResponse.json(
      {
        error:
          "Le stock n'a pas pu être mis à jour.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * 2. On passe le lot à 0.
   */

  const {
    error: lotUpdateError,
  } = await supabaseAdmin
    .from(
      "medical_item_expirations"
    )
    .update({
      quantity: 0,
    })
    .eq(
      "id",
      expirationId
    );

  if (lotUpdateError) {
    console.error(
      "Impossible de vider le lot périmé :",
      lotUpdateError
    );

    await supabaseAdmin
      .from("medical_items")
      .update({
        quantity:
          previousQuantity,

        updated_by:
          currentUser.id,
      })
      .eq(
        "id",
        medicalItemId
      );

    return NextResponse.json(
      {
        error:
          "La destruction du lot n'a pas pu être appliquée.",
      },
      {
        status: 500,
      }
    );
  }

  const actorName =
    getActorName(
      permission.profile,
      currentUser.email
    );

  const reason =
    `Destruction lot périmé du ${expiration.expiration_date}${
      expiration.notes
        ? ` - ${expiration.notes}`
        : ""
    }`;

  /*
   * 3. Historique stock : expired_disposal.
   */

  const {
    data: movement,
    error: movementError,
  } = await supabaseAdmin
    .from(
      "medical_stock_movements"
    )
    .insert({
      medical_item_id:
        medicalItemId,

      movement_type:
        "expired_disposal",

      quantity_change:
        -lotQuantity,

      previous_quantity:
        previousQuantity,

      new_quantity:
        newQuantity,

      reason,

      actor_id:
        currentUser.id,

      actor_name:
        actorName,
    })
    .select(`
      id,
      medical_item_id,
      movement_type,
      quantity_change,
      previous_quantity,
      new_quantity,
      reason,
      actor_id,
      actor_name,
      created_at
    `)
    .single();

  if (
    movementError ||
    !movement
  ) {
    console.error(
      "Destruction appliquée mais mouvement impossible :",
      movementError
    );

    const {
      error:
        rollbackLotError,
    } = await supabaseAdmin
      .from(
        "medical_item_expirations"
      )
      .update({
        quantity:
          lotQuantity,
      })
      .eq(
        "id",
        expirationId
      );

    const {
      error:
        rollbackStockError,
    } = await supabaseAdmin
      .from("medical_items")
      .update({
        quantity:
          previousQuantity,

        updated_by:
          currentUser.id,
      })
      .eq(
        "id",
        medicalItemId
      );

    if (
      rollbackLotError ||
      rollbackStockError
    ) {
      console.error(
        "Rollback destruction périmé incomplet :",
        {
          rollbackLotError,
          rollbackStockError,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "La destruction n'a pas pu être enregistrée dans l'historique. Les données ont été restaurées.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * 4. Audit complémentaire.
   */

  const {
    error: auditError,
  } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      actor_id:
        currentUser.id,

      actor_name:
        actorName,

      actor_email:
        currentUser.email ??
        null,

      action:
        "DESTROY_EXPIRED_MEDICAL_STOCK",

      target_profile_id:
        null,

      target_name:
        article.name,

      target_email:
        null,

      module:
        "secourisme",

      details: {
        medical_item_id:
          medicalItemId,

        medical_item_name:
          article.name,

        expiration_id:
          expiration.id,

        expiration_date:
          expiration.expiration_date,

        disposed_quantity:
          lotQuantity,

        previous_quantity:
          previousQuantity,

        new_quantity:
          newQuantity,

        notes:
          expiration.notes,
      },
    });

  if (auditError) {
    console.error(
      "Destruction enregistrée, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json(
    {
      message:
        `${lotQuantity} unité(s) périmée(s) ont été détruite(s).`,

      article:
        updatedArticle,

      movement,

      disposed: {
        expirationId:
          expiration.id,

        quantity:
          lotQuantity,

        expirationDate:
          expiration.expiration_date,
      },
    },
    {
      status: 201,
    }
  );
}