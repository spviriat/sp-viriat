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

const STOCK_READ_ROLES = [
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

type MovementRow = {
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

type MedicalItemRow = {
  id: string;
  name: string;
  quantity: number;
  minimum_quantity: number;
  location: string | null;
  is_active: boolean;
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

async function getStockPermission(
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
      STOCK_READ_ROLES.includes(
        code as
          (typeof STOCK_READ_ROLES)[number]
      )
    );

  const canWrite =
    roleCodes.includes(
      "responsable_pharmacie"
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
    await getStockPermission(
      requestSupabase,
      currentUser.id
    );

  return {
    error: null,
    currentUser,
    permission,
  };
}

export async function GET(
  request: Request
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
          "Vous n'êtes pas autorisé à consulter les mouvements de stock.",
      },
      {
        status: 403,
      }
    );
  }

  const {
    data: movementsData,
    error: movementsError,
  } = await supabaseAdmin
    .from(
      "medical_stock_movements"
    )
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
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(1000);

  if (movementsError) {
    console.error(
      "Impossible de récupérer les mouvements de stock :",
      movementsError
    );

    return NextResponse.json(
      {
        error:
          "L'historique global des mouvements n'a pas pu être récupéré.",
      },
      {
        status: 500,
      }
    );
  }

  const movements =
    (movementsData ??
      []) as MovementRow[];

  const itemIds =
    Array.from(
      new Set(
        movements.map(
          (movement) =>
            movement.medical_item_id
        )
      )
    );

  let items:
    MedicalItemRow[] = [];

  if (itemIds.length > 0) {
    const {
      data: itemsData,
      error: itemsError,
    } = await supabaseAdmin
      .from("medical_items")
      .select(`
        id,
        name,
        quantity,
        minimum_quantity,
        location,
        is_active
      `)
      .in(
        "id",
        itemIds
      );

    if (itemsError) {
      console.error(
        "Impossible de récupérer les articles associés aux mouvements :",
        itemsError
      );

      return NextResponse.json(
        {
          error:
            "Les articles associés aux mouvements n'ont pas pu être récupérés.",
        },
        {
          status: 500,
        }
      );
    }

    items =
      (itemsData ??
        []) as MedicalItemRow[];
  }

  const itemById =
    new Map(
      items.map(
        (item) => [
          item.id,
          item,
        ]
      )
    );

  const enrichedMovements =
    movements.map(
      (movement) => ({
        ...movement,

        article:
          itemById.get(
            movement.medical_item_id
          ) ?? null,
      })
    );

  return NextResponse.json({
    movements:
      enrichedMovements,

    permissions: {
      canRead:
        permission.canRead,

      canWrite:
        permission.canWrite,
    },
  });
}