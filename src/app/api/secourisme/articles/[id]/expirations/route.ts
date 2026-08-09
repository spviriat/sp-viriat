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

const EXPIRATION_READ_ROLES = [
  "responsable_pharmacie",
  "chef_centre",
  "adjoint_chef_centre",
] as const;

const EXPIRATION_WRITE_ROLES = [
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
  canRead: boolean;
  canWrite: boolean;
  profile: CurrentProfile | null;
};

type CreateExpirationPayload = {
  quantity?: unknown;
  expirationDate?: unknown;
  notes?: unknown;
};

type ExpirationRow = {
  id: string;
  medical_item_id: string;
  quantity: number;
  expiration_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
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

function normalizeNullableString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
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

async function getExpirationPermission(
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
      canRead: false,
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
      canRead: true,
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
      canRead: false,
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

  const canRead =
    roleCodes.some((code) =>
      EXPIRATION_READ_ROLES.includes(
        code as
          (typeof EXPIRATION_READ_ROLES)[number]
      )
    );

  const canWrite =
    roleCodes.some((code) =>
      EXPIRATION_WRITE_ROLES.includes(
        code as
          (typeof EXPIRATION_WRITE_ROLES)[number]
      )
    );

  return {
    canRead,
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
    await getExpirationPermission(
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

function getExpirationStatus(
  expirationDate: string
) {
  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const date =
    new Date(
      `${expirationDate}T00:00:00`
    );

  const differenceMs =
    date.getTime() -
    today.getTime();

  const daysRemaining =
    Math.ceil(
      differenceMs /
        (1000 * 60 * 60 * 24)
    );

  if (daysRemaining < 0) {
    return {
      status: "expired",
      daysRemaining,
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: "critical",
      daysRemaining,
    };
  }

  if (daysRemaining <= 90) {
    return {
      status: "soon",
      daysRemaining,
    };
  }

  return {
    status: "valid",
    daysRemaining,
  };
}

function enrichExpiration(
  expiration: ExpirationRow
) {
  return {
    ...expiration,
    ...getExpirationStatus(
      expiration.expiration_date
    ),
  };
}

/*
 * =========================================================
 * GET
 * =========================================================
 *
 * Liste des lots / péremptions d'un article.
 */

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const {
    error,
    permission,
  } =
    await authenticateRequest(
      request
    );

  if (error) {
    return error;
  }

  if (
    !permission ||
    !permission.canRead
  ) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à consulter les péremptions.",
      },
      {
        status: 403,
      }
    );
  }

  const {
    id: medicalItemId,
  } =
    await context.params;

  if (!medicalItemId) {
    return NextResponse.json(
      {
        error:
          "L'article est invalide.",
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

  if (articleError) {
    console.error(
      "Impossible de récupérer l'article :",
      articleError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer cet article.",
      },
      {
        status: 500,
      }
    );
  }

  if (!article) {
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
    data: expirationData,
    error: expirationsError,
  } = await supabaseAdmin
    .from(
      "medical_item_expirations"
    )
    .select(`
      id,
      medical_item_id,
      quantity,
      expiration_date,
      notes,
      created_at,
      updated_at
    `)
    .eq(
      "medical_item_id",
      medicalItemId
    )
    .order(
      "expiration_date",
      {
        ascending: true,
      }
    );

  if (expirationsError) {
    console.error(
      "Impossible de récupérer les péremptions :",
      expirationsError
    );

    return NextResponse.json(
      {
        error:
          "Les péremptions n'ont pas pu être récupérées.",
      },
      {
        status: 500,
      }
    );
  }

  const expirations =
    (
      (expirationData ?? []) as
        ExpirationRow[]
    ).map(
      enrichExpiration
    );

  const assignedQuantity =
    expirations.reduce(
      (
        total,
        expiration
      ) =>
        total +
        expiration.quantity,
      0
    );

  return NextResponse.json({
    article,

    expirations,

    summary: {
      stockQuantity:
        article.quantity,

      assignedQuantity,

      unassignedQuantity:
        Math.max(
          article.quantity -
            assignedQuantity,
          0
        ),

      expiredQuantity:
        expirations
          .filter(
            (expiration) =>
              expiration.status ===
              "expired"
          )
          .reduce(
            (
              total,
              expiration
            ) =>
              total +
              expiration.quantity,
            0
          ),

      expiringWithin30Days:
        expirations
          .filter(
            (expiration) =>
              expiration.status ===
              "critical"
          )
          .reduce(
            (
              total,
              expiration
            ) =>
              total +
              expiration.quantity,
            0
          ),

      expiringWithin90Days:
        expirations
          .filter(
            (expiration) =>
              expiration.status ===
                "critical" ||
              expiration.status ===
                "soon"
          )
          .reduce(
            (
              total,
              expiration
            ) =>
              total +
              expiration.quantity,
            0
          ),
    },

    permissions: {
      canRead:
        permission.canRead,

      canWrite:
        permission.canWrite,
    },
  });
}

/*
 * =========================================================
 * POST
 * =========================================================
 *
 * Ajoute un lot / une date de péremption à un article.
 *
 * Important :
 * cette route répartit le stock existant entre les lots.
 * Elle ne modifie PAS medical_items.quantity.
 *
 * Pour recevoir du nouveau stock :
 * 1. créer une Entrée de stock ;
 * 2. affecter ensuite la quantité au lot.
 */

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
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
    !permission.profile
  ) {
    return NextResponse.json(
      {
        error:
          "Impossible de vérifier vos autorisations.",
      },
      {
        status: 403,
      }
    );
  }

  if (!permission.canWrite) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à gérer les péremptions.",
      },
      {
        status: 403,
      }
    );
  }

  const {
    id: medicalItemId,
  } =
    await context.params;

  if (!medicalItemId) {
    return NextResponse.json(
      {
        error:
          "L'article est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  let payload:
    CreateExpirationPayload;

  try {
    payload =
      (await request.json()) as
        CreateExpirationPayload;
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

  const quantity =
    typeof payload.quantity ===
      "number"
      ? payload.quantity
      : Number(
          payload.quantity
        );

  const expirationDate =
    typeof payload.expirationDate ===
    "string"
      ? payload.expirationDate.trim()
      : "";

  const notes =
    normalizeNullableString(
      payload.notes
    );

  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "La quantité du lot doit être un entier supérieur à 0.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      expirationDate
    )
  ) {
    return NextResponse.json(
      {
        error:
          "La date de péremption est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const parsedDate =
    new Date(
      `${expirationDate}T00:00:00`
    );

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return NextResponse.json(
      {
        error:
          "La date de péremption est invalide.",
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
      has_expiration,
      is_active
    `)
    .eq(
      "id",
      medicalItemId
    )
    .maybeSingle();

  if (articleError) {
    console.error(
      "Impossible de récupérer l'article :",
      articleError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer cet article.",
      },
      {
        status: 500,
      }
    );
  }

  if (!article) {
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

  if (!article.has_expiration) {
    return NextResponse.json(
      {
        error:
          "Le suivi des péremptions n'est pas activé pour cet article.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: existingExpirations,
    error:
      existingExpirationsError,
  } = await supabaseAdmin
    .from(
      "medical_item_expirations"
    )
    .select(`
      id,
      quantity
    `)
    .eq(
      "medical_item_id",
      medicalItemId
    );

  if (existingExpirationsError) {
    console.error(
      "Impossible de vérifier les quantités déjà affectées aux lots :",
      existingExpirationsError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier les lots existants.",
      },
      {
        status: 500,
      }
    );
  }

  const assignedQuantity =
    (
      existingExpirations ?? []
    ).reduce(
      (
        total,
        expiration
      ) =>
        total +
        Number(
          expiration.quantity ?? 0
        ),
      0
    );

  const availableQuantity =
    article.quantity -
    assignedQuantity;

  if (
    quantity >
    availableQuantity
  ) {
    return NextResponse.json(
      {
        error:
          `Quantité insuffisante à affecter. ${Math.max(
            availableQuantity,
            0
          )} unité(s) du stock ne sont pas encore affectée(s) à un lot.`,
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: createdExpiration,
    error: creationError,
  } = await supabaseAdmin
    .from(
      "medical_item_expirations"
    )
    .insert({
      medical_item_id:
        medicalItemId,

      quantity,

      expiration_date:
        expirationDate,

      notes,
    })
    .select(`
      id,
      medical_item_id,
      quantity,
      expiration_date,
      notes,
      created_at,
      updated_at
    `)
    .single();

  if (
    creationError ||
    !createdExpiration
  ) {
    console.error(
      "Impossible de créer le lot de péremption :",
      creationError
    );

    return NextResponse.json(
      {
        error:
          "Le lot de péremption n'a pas pu être créé.",
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
        "CREATE_MEDICAL_ITEM_EXPIRATION",

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
          createdExpiration.id,

        expiration_date:
          createdExpiration
            .expiration_date,

        quantity:
          createdExpiration.quantity,

        notes:
          createdExpiration.notes,
      },
    });

  if (auditError) {
    console.error(
      "Lot de péremption créé, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json(
    {
      message:
        "Le lot de péremption a été ajouté avec succès.",

      expiration:
        enrichExpiration(
          createdExpiration as
            ExpirationRow
        ),

      remainingUnassignedQuantity:
        Math.max(
          availableQuantity -
            quantity,
          0
        ),
    },
    {
      status: 201,
    }
  );
}