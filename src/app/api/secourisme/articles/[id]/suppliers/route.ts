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

const ARTICLE_READ_ROLES = [
  "responsable_pharmacie",
  "chef_centre",
  "adjoint_chef_centre",
] as const;

const ARTICLE_WRITE_ROLES = [
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
  isAdmin: boolean;
  profile: CurrentProfile | null;
  roleCodes: string[];
};

type UpdateArticlePayload = {
  name?: unknown;
  categoryId?: unknown;
  description?: unknown;
  packagingType?: unknown;
  unitsPerBox?: unknown;
  quantity?: unknown;
  minimumQuantity?: unknown;
  location?: unknown;
  notes?: unknown;
  hasExpiration?: unknown;
  isActive?: unknown;
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

function normalizeNullableString(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
}

async function getArticlePermission(
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
      ARTICLE_READ_ROLES.includes(
        code as
          (typeof ARTICLE_READ_ROLES)[number]
      )
    );

  const canWrite =
    roleCodes.some((code) =>
      ARTICLE_WRITE_ROLES.includes(
        code as
          (typeof ARTICLE_WRITE_ROLES)[number]
      )
    );

  return {
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
    await getArticlePermission(
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
          "Vous n'êtes pas autorisé à consulter cet article.",
      },
      {
        status: 403,
      }
    );
  }

  const { id } =
    await context.params;

  const {
    data: article,
    error: articleError,
  } = await supabaseAdmin
    .from("medical_items")
    .select(`
      id,
      name,
      description,
      unit,
      packaging_type,
      units_per_box,
      quantity,
      minimum_quantity,
      location,
      notes,
      has_expiration,
      is_active,
      created_at,
      updated_at,

      category:medical_categories (
        id,
        code,
        label
      ),

      expirations:medical_item_expirations (
        id,
        quantity,
        expiration_date,
        notes,
        created_at
      ),

      suppliers:medical_item_suppliers (
        id,
        supplier_reference,
        packaging_type,
        units_per_box,
        is_primary,
        notes,

        supplier:medical_suppliers (
          id,
          name,
          phone,
          email,
          website,
          contact_name
        )
      )
    `)
    .eq("id", id)
    .single();

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
          "Cet article est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    article,

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
    !permission.profile ||
    !permission.canWrite
  ) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à modifier cet article.",
      },
      {
        status: 403,
      }
    );
  }

  const { id } =
    await context.params;

  const {
    data: existingArticle,
    error:
      existingArticleError,
  } = await supabaseAdmin
    .from("medical_items")
    .select(`
      id,
      name,
      category_id,
      description,
      packaging_type,
      units_per_box,
      quantity,
      minimum_quantity,
      location,
      notes,
      has_expiration,
      is_active
    `)
    .eq("id", id)
    .single();

  if (
    existingArticleError ||
    !existingArticle
  ) {
    return NextResponse.json(
      {
        error:
          "Cet article est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  let payload:
    UpdateArticlePayload;

  try {
    payload =
      (await request.json()) as
        UpdateArticlePayload;
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

  const name =
    typeof payload.name ===
    "string"
      ? payload.name.trim()
      : "";

  const categoryId =
    typeof payload.categoryId ===
      "number" &&
    Number.isInteger(
      payload.categoryId
    ) &&
    payload.categoryId > 0
      ? payload.categoryId
      : null;

  const packagingType =
    payload.packagingType ===
      "unit" ||
    payload.packagingType ===
      "box"
      ? payload.packagingType
      : null;

  const unitsPerBox =
    typeof payload.unitsPerBox ===
      "number" &&
    Number.isInteger(
      payload.unitsPerBox
    ) &&
    payload.unitsPerBox > 0
      ? payload.unitsPerBox
      : null;

  // La quantité réelle ne se modifie pas depuis la fiche article :
  // elle reste gérée par les mouvements Entrée / Sortie.
  const quantity =
    existingArticle.quantity;

  const minimumQuantity =
    typeof payload.minimumQuantity ===
      "number" &&
    Number.isInteger(
      payload.minimumQuantity
    ) &&
    payload.minimumQuantity >= 0
      ? payload.minimumQuantity
      : null;

  const hasExpiration =
    typeof payload.hasExpiration ===
    "boolean"
      ? payload.hasExpiration
      : null;

  const requestedIsActive =
    typeof payload.isActive === "boolean"
      ? payload.isActive
      : existingArticle.is_active;

  if (!name) {
    return NextResponse.json(
      {
        error:
          "Le nom de l'article est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  if (!categoryId) {
    return NextResponse.json(
      {
        error:
          "La catégorie est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  if (!packagingType) {
    return NextResponse.json(
      {
        error:
          "Le conditionnement est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    packagingType === "box" &&
    !unitsPerBox
  ) {
    return NextResponse.json(
      {
        error:
          "Le nombre d'unités par boîte est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    minimumQuantity === null
  ) {
    return NextResponse.json(
      {
        error:
          "Le seuil minimum est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    hasExpiration === null
  ) {
    return NextResponse.json(
      {
        error:
          "La gestion de péremption est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: category,
    error: categoryError,
  } = await supabaseAdmin
    .from("medical_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("is_active", true)
    .maybeSingle();

  if (
    categoryError ||
    !category
  ) {
    return NextResponse.json(
      {
        error:
          "La catégorie sélectionnée est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: updatedArticle,
    error: updateError,
  } = await supabaseAdmin
    .from("medical_items")
    .update({
      name,

      category_id:
        categoryId,

      description:
        normalizeNullableString(
          payload.description
        ),

      packaging_type:
        packagingType,

      units_per_box:
        packagingType === "box"
          ? unitsPerBox
          : null,

      quantity,

      minimum_quantity:
        minimumQuantity,

      location:
        normalizeNullableString(
          payload.location
        ),

      notes:
        normalizeNullableString(
          payload.notes
        ),

      has_expiration:
        hasExpiration,

      is_active:
        requestedIsActive,

      updated_by:
        currentUser.id,
    })
    .eq("id", id)
    .select(`
      id,
      name,
      description,
      packaging_type,
      units_per_box,
      quantity,
      minimum_quantity,
      location,
      notes,
      has_expiration,
      is_active,
      updated_at
    `)
    .single();

  if (
    updateError ||
    !updatedArticle
  ) {
    console.error(
      "Impossible de modifier l'article :",
      updateError
    );

    return NextResponse.json(
      {
        error:
          "L'article n'a pas pu être modifié.",
      },
      {
        status: 500,
      }
    );
  }

  const actorName =
    `${
      permission.profile
        .first_name ?? ""
    } ${
      permission.profile
        .last_name ?? ""
    }`.trim() ||
    currentUser.email ||
    "Utilisateur inconnu";

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
        !existingArticle.is_active &&
        requestedIsActive
          ? "REACTIVATE_MEDICAL_ITEM"
          : "UPDATE_MEDICAL_ITEM",

      target_profile_id:
        null,

      target_name:
        updatedArticle.name,

      target_email:
        null,

      module:
        "secourisme",

      details: {
        article_id: id,

        previous:
          existingArticle,

        new:
          updatedArticle,
      },
    });

  if (auditError) {
    console.error(
      "Article modifié, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json({
    message:
      !existingArticle.is_active &&
      requestedIsActive
        ? "L'article a été réactivé avec succès."
        : "L'article a été modifié avec succès.",

    article:
      updatedArticle,
  });
}

export async function DELETE(
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
    !permission.profile ||
    !permission.canWrite
  ) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à supprimer cet article.",
      },
      {
        status: 403,
      }
    );
  }

  const { id } =
    await context.params;

  const {
    data: article,
    error: articleError,
  } = await supabaseAdmin
    .from("medical_items")
    .select(`
      id,
      name,
      is_active
    `)
    .eq("id", id)
    .single();

  if (
    articleError ||
    !article
  ) {
    return NextResponse.json(
      {
        error:
          "Cet article est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * On désactive l'article au lieu de le supprimer
   * physiquement.
   *
   * Cela protège l'historique du stock et des sacs.
   */

  const {
    data: disabledArticle,
    error: disableError,
  } = await supabaseAdmin
    .from("medical_items")
    .update({
      is_active: false,
      updated_by:
        currentUser.id,
    })
    .eq("id", id)
    .select(`
      id,
      name,
      is_active,
      updated_at
    `)
    .single();

  if (
    disableError ||
    !disabledArticle
  ) {
    console.error(
      "Impossible de désactiver l'article :",
      disableError
    );

    return NextResponse.json(
      {
        error:
          "L'article n'a pas pu être désactivé.",
      },
      {
        status: 500,
      }
    );
  }

  const actorName =
    `${
      permission.profile
        .first_name ?? ""
    } ${
      permission.profile
        .last_name ?? ""
    }`.trim() ||
    currentUser.email ||
    "Utilisateur inconnu";

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
        "DISABLE_MEDICAL_ITEM",

      target_profile_id:
        null,

      target_name:
        article.name,

      target_email:
        null,

      module:
        "secourisme",

      details: {
        article_id:
          article.id,

        previous_is_active:
          article.is_active,

        new_is_active:
          false,
      },
    });

  if (auditError) {
    console.error(
      "Article désactivé, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json({
    message:
      "L'article a été désactivé avec succès.",

    article:
      disabledArticle,
  });
}