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

/*
 * Rôles autorisés à consulter les catégories.
 */
const CATEGORY_READ_ROLES = [
  "responsable_pharmacie",
  "chef_centre",
  "adjoint_chef_centre",
] as const;

/*
 * Rôles autorisés à modifier les catégories.
 */
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

type CreateCategoryPayload = {
  label?: unknown;
};

type PermissionResult = {
  authenticated: boolean;
  canRead: boolean;
  canWrite: boolean;
  isAdmin: boolean;
  profile: CurrentProfile | null;
  roleCodes: string[];
};

/*
 * =========================================================
 * TOKEN
 * =========================================================
 */

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

/*
 * =========================================================
 * CLIENT SUPABASE LIÉ À LA REQUÊTE
 * =========================================================
 */

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

/*
 * =========================================================
 * NORMALISATION DU CODE
 * =========================================================
 *
 * Exemple :
 *
 * "Oxygénothérapie" devient "oxygenotherapie"
 * "Pansements et soins" devient "pansements_et_soins"
 */

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

/*
 * =========================================================
 * EXTRACTION D’UN RÔLE MÉTIER
 * =========================================================
 */

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

/*
 * =========================================================
 * CONTRÔLE DES AUTORISATIONS
 * =========================================================
 */

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

  /*
   * Un administrateur possède tous les droits.
   */

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

  /*
   * On passe les codes en minuscules.
   *
   * Cela permet de supporter aussi une ancienne valeur
   * comme "Chef_centre".
   */

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

/*
 * =========================================================
 * AUTHENTIFICATION COMMUNE
 * =========================================================
 */

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

/*
 * =========================================================
 * GET
 * =========================================================
 *
 * Liste des catégories.
 *
 * Autorisés :
 *
 * - Administrateur
 * - Responsable pharmacie
 * - Chef de centre
 * - Adjoint chef de centre
 */

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
          "Vous n'êtes pas autorisé à consulter les catégories du stock pharmacie.",
      },
      {
        status: 403,
      }
    );
  }

  const {
    data: categories,
    error: categoriesError,
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
    .order(
      "display_order",
      {
        ascending: true,
      }
    )
    .order(
      "label",
      {
        ascending: true,
      }
    );

  if (categoriesError) {
    console.error(
      "Impossible de récupérer les catégories :",
      categoriesError
    );

    return NextResponse.json(
      {
        error:
          "Les catégories n'ont pas pu être récupérées.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    categories:
      categories ?? [],

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
 * Création d'une catégorie.
 *
 * Autorisés :
 *
 * - Administrateur
 * - Responsable pharmacie
 */

export async function POST(
  request: Request
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
          "Vous n'êtes pas autorisé à créer une catégorie.",
      },
      {
        status: 403,
      }
    );
  }

  let payload:
    CreateCategoryPayload;

  try {
    payload =
      (await request.json()) as
        CreateCategoryPayload;
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
      : "";

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

  /*
   * Vérification des doublons.
   */

  const {
    data: existingCategory,
    error:
      existingCategoryError,
  } = await supabaseAdmin
    .from("medical_categories")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  if (existingCategoryError) {
    console.error(
      "Impossible de vérifier l'existence de la catégorie :",
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

  if (existingCategory) {
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

  /*
   * Ordre automatique.
   *
   * L'utilisateur n'a pas à gérer cette valeur.
   * On place la nouvelle catégorie 10 positions après la dernière.
   */

  const {
    data: lastCategory,
    error: lastCategoryError,
  } = await supabaseAdmin
    .from("medical_categories")
    .select("display_order")
    .order("display_order", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (lastCategoryError) {
    console.error(
      "Impossible de calculer l'ordre de la nouvelle catégorie :",
      lastCategoryError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de préparer la création de la catégorie.",
      },
      {
        status: 500,
      }
    );
  }

  const displayOrder =
    (lastCategory?.display_order ?? 0) + 10;

  /*
   * Création.
   */

  const {
    data: createdCategory,
    error: creationError,
  } = await supabaseAdmin
    .from("medical_categories")
    .insert({
      code,
      label,
      display_order:
        displayOrder,
      is_active: true,
    })
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
    creationError ||
    !createdCategory
  ) {
    console.error(
      "Impossible de créer la catégorie :",
      creationError
    );

    return NextResponse.json(
      {
        error:
          "La catégorie n'a pas pu être créée.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * Journal d'audit.
   */

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
        "CREATE_MEDICAL_CATEGORY",

      target_profile_id:
        null,

      target_name:
        label,

      target_email:
        null,

      module:
        "secourisme",

      details: {
        category_id:
          createdCategory.id,

        code:
          createdCategory.code,

        label:
          createdCategory.label,

        display_order:
          createdCategory.display_order,
      },
    });

  if (auditError) {
    console.error(
      "Catégorie créée, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json(
    {
      message:
        "La catégorie a été créée avec succès.",

      category:
        createdCategory,
    },
    {
      status: 201,
    }
  );
}

/*
 * =========================================================
 * DELETE
 * =========================================================
 *
 * Suppression sécurisée d'une catégorie.
 *
 * La catégorie ne peut pas être supprimée tant qu'un article
 * du stock lui est encore associé.
 */

export async function DELETE(
  request: Request
) {
  const {
    error,
    currentUser,
    permission,
  } = await authenticateRequest(request);

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
          "Vous n'êtes pas autorisé à supprimer une catégorie.",
      },
      {
        status: 403,
      }
    );
  }

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("id");

  if (!categoryId) {
    return NextResponse.json(
      {
        error:
          "L'identifiant de la catégorie est obligatoire.",
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
    .select(`
      id,
      code,
      label,
      display_order
    `)
    .eq("id", categoryId)
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

  /*
   * On refuse la suppression si des articles utilisent encore
   * cette catégorie. Cela évite de casser le stock existant.
   */
  const {
    count: linkedItemsCount,
    error: linkedItemsError,
  } = await supabaseAdmin
    .from("medical_items")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("category_id", categoryId);

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
    .eq("id", categoryId);

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
    `${
      permission.profile.first_name ?? ""
    } ${
      permission.profile.last_name ?? ""
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