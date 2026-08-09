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

const CATEGORY_READ_ROLES = [
  "responsable_pharmacie",
  "chef_centre",
  "adjoint_chef_centre",
] as const;

const CATEGORY_WRITE_ROLES = [
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
  authenticated: boolean;
  canRead: boolean;
  canWrite: boolean;
  isAdmin: boolean;
  profile: CurrentProfile | null;
  roleCodes: string[];
};

type UpdateCategoryPayload = {
  label?: unknown;
  displayOrder?: unknown;
  isActive?: unknown;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
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

function createCategoryCode(
  label: string
) {
  return label
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

async function getCategoryPermission(
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
    .eq("id", currentUserId)
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
      authenticated: true,
      canRead: false,
      canWrite: false,
      isAdmin: false,
      profile: null,
      roleCodes: [],
    };
  }

  const profile =
    profileData as CurrentProfile;

  if (
    profile.access_role === "admin"
  ) {
    return {
      authenticated: true,
      canRead: true,
      canWrite: true,
      isAdmin: true,
      profile,
      roleCodes: [],
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
      authenticated: true,
      canRead: false,
      canWrite: false,
      isAdmin: false,
      profile,
      roleCodes: [],
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
      CATEGORY_READ_ROLES.includes(
        code as
          (typeof CATEGORY_READ_ROLES)[number]
      )
    );

  const canWrite =
    roleCodes.some((code) =>
      CATEGORY_WRITE_ROLES.includes(
        code as
          (typeof CATEGORY_WRITE_ROLES)[number]
      )
    );

  return {
    authenticated: true,
    canRead,
    canWrite,
    isAdmin: false,
    profile,
    roleCodes,
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
      error: NextResponse.json(
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
      error: NextResponse.json(
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
      error: NextResponse.json(
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
      error: NextResponse.json(
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
    await getCategoryPermission(
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
    `${profile.first_name ?? ""} ${
      profile.last_name ?? ""
    }`.trim() ||
    email ||
    "Utilisateur inconnu"
  );
}

export async function GET(
  request: Request,
  context: RouteContext
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
          "Vous n'êtes pas autorisé à consulter cette catégorie.",
      },
      {
        status: 403,
      }
    );
  }

  const { id } =
    await context.params;

  const {
    data: category,
    error: categoryError,
  } = await supabaseAdmin
    .from("medical_categories")
    .select(`
      id,
      code,
      label,
      display_order,
      is_active,
      created_at
    `)
    .eq("id", id)
    .maybeSingle();

  if (categoryError) {
    console.error(
      "Impossible de récupérer la catégorie :",
      categoryError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer cette catégorie.",
      },
      {
        status: 500,
      }
    );
  }

  if (!category) {
    return NextResponse.json(
      {
        error:
          "Cette catégorie est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    category,

    permissions: {
      canRead:
        permission.canRead,

      canWrite:
        permission.canWrite,
    },
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext
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
          "Vous n'êtes pas autorisé à modifier cette catégorie.",
      },
      {
        status: 403,
      }
    );
  }

  const { id } =
    await context.params;

  const {
    data: existingCategory,
    error: existingCategoryError,
  } = await supabaseAdmin
    .from("medical_categories")
    .select(`
      id,
      code,
      label,
      display_order,
      is_active
    `)
    .eq("id", id)
    .maybeSingle();

  if (existingCategoryError) {
    console.error(
      "Impossible de récupérer la catégorie à modifier :",
      existingCategoryError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier cette catégorie.",
      },
      {
        status: 500,
      }
    );
  }

  if (!existingCategory) {
    return NextResponse.json(
      {
        error:
          "Cette catégorie est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  let payload:
    UpdateCategoryPayload;

  try {
    payload =
      (await request.json()) as
        UpdateCategoryPayload;
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

  const label =
    typeof payload.label ===
    "string"
      ? payload.label.trim()
      : existingCategory.label;

  if (!label) {
    return NextResponse.json(
      {
        error:
          "Le nom de la catégorie est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  if (label.length > 100) {
    return NextResponse.json(
      {
        error:
          "Le nom de la catégorie ne peut pas dépasser 100 caractères.",
      },
      {
        status: 400,
      }
    );
  }

  const code =
    createCategoryCode(label);

  if (!code) {
    return NextResponse.json(
      {
        error:
          "Le nom de la catégorie est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const displayOrder =
    typeof payload.displayOrder ===
      "number" &&
    Number.isInteger(
      payload.displayOrder
    )
      ? payload.displayOrder
      : existingCategory.display_order;

  const isActive =
    typeof payload.isActive ===
    "boolean"
      ? payload.isActive
      : existingCategory.is_active;

  const {
    data: duplicate,
    error: duplicateError,
  } = await supabaseAdmin
    .from("medical_categories")
    .select("id")
    .eq("code", code)
    .neq("id", id)
    .maybeSingle();

  if (duplicateError) {
    console.error(
      "Impossible de vérifier les doublons de catégorie :",
      duplicateError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier si cette catégorie existe déjà.",
      },
      {
        status: 500,
      }
    );
  }

  if (duplicate) {
    return NextResponse.json(
      {
        error:
          "Une catégorie portant ce nom existe déjà.",
      },
      {
        status: 409,
      }
    );
  }

  const {
    data: updatedCategory,
    error: updateError,
  } = await supabaseAdmin
    .from("medical_categories")
    .update({
      label,
      code,
      display_order:
        displayOrder,
      is_active:
        isActive,
    })
    .eq("id", id)
    .select(`
      id,
      code,
      label,
      display_order,
      is_active,
      created_at
    `)
    .single();

  if (
    updateError ||
    !updatedCategory
  ) {
    console.error(
      "Impossible de modifier la catégorie :",
      updateError
    );

    return NextResponse.json(
      {
        error:
          "La catégorie n'a pas pu être modifiée.",
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
        currentUser.email ?? null,

      action:
        "UPDATE_MEDICAL_CATEGORY",

      target_profile_id:
        null,

      target_name:
        updatedCategory.label,

      target_email:
        null,

      module:
        "secourisme",

      details: {
        category_id:
          updatedCategory.id,

        previous:
          existingCategory,

        new:
          updatedCategory,
      },
    });

  if (auditError) {
    console.error(
      "Catégorie modifiée, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json({
    message:
      "La catégorie a été modifiée avec succès.",

    category:
      updatedCategory,
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext
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
          "Vous n'êtes pas autorisé à supprimer cette catégorie.",
      },
      {
        status: 403,
      }
    );
  }

  const { id } =
    await context.params;

  const {
    data: category,
    error: categoryError,
  } = await supabaseAdmin
    .from("medical_categories")
    .select(`
      id,
      code,
      label,
      display_order,
      is_active
    `)
    .eq("id", id)
    .maybeSingle();

  if (categoryError) {
    console.error(
      "Impossible de récupérer la catégorie à supprimer :",
      categoryError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier cette catégorie.",
      },
      {
        status: 500,
      }
    );
  }

  if (!category) {
    return NextResponse.json(
      {
        error:
          "Cette catégorie n'existe pas ou a déjà été supprimée.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    count: linkedItemsCount,
    error: linkedItemsError,
  } = await supabaseAdmin
    .from("medical_items")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("category_id", id);

  if (linkedItemsError) {
    console.error(
      "Impossible de vérifier les articles liés à la catégorie :",
      linkedItemsError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier si cette catégorie est encore utilisée.",
      },
      {
        status: 500,
      }
    );
  }

  if ((linkedItemsCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          `Impossible de supprimer cette catégorie : ${linkedItemsCount} article(s) du stock y sont encore associé(s). Changez d'abord leur catégorie.`,

        linkedItemsCount:
          linkedItemsCount ?? 0,
      },
      {
        status: 409,
      }
    );
  }

  const {
    error: deleteError,
  } = await supabaseAdmin
    .from("medical_categories")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error(
      "Impossible de supprimer la catégorie :",
      deleteError
    );

    return NextResponse.json(
      {
        error:
          "La catégorie n'a pas pu être supprimée.",
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
        currentUser.email ?? null,

      action:
        "DELETE_MEDICAL_CATEGORY",

      target_profile_id:
        null,

      target_name:
        category.label,

      target_email:
        null,

      module:
        "secourisme",

      details: {
        category_id:
          category.id,

        code:
          category.code,

        label:
          category.label,

        display_order:
          category.display_order,
      },
    });

  if (auditError) {
    console.error(
      "Catégorie supprimée, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json({
    message:
      `La catégorie « ${category.label} » a été supprimée.`,

    deleted: true,
  });
}