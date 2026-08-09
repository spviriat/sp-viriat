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
 * =========================================================
 * DROITS
 * =========================================================
 */

const ARTICLE_READ_ROLES = [
  "responsable_pharmacie",
  "chef_centre",
  "adjoint_chef_centre",
] as const;

const ARTICLE_WRITE_ROLES = [
  "responsable_pharmacie",
] as const;

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

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

type SupplierPayload = {
  supplierId?: unknown;
  supplierReference?: unknown;
  packagingType?: unknown;
  unitsPerBox?: unknown;
  isPrimary?: unknown;
  notes?: unknown;
};

type CreateArticlePayload = {
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

  suppliers?: unknown;
};

type PermissionResult = {
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
 * CLIENT SUPABASE DE LA REQUÊTE
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
 * NORMALISATION TEXTE
 * =========================================================
 */

function normalizeNullableString(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
}

/*
 * =========================================================
 * EXTRACTION DU CODE RÔLE
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
 * AUTORISATIONS
 * =========================================================
 */

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
      isAdmin: false,
      profile: null,
      roleCodes: [],
    };
  }

  const profile =
    profileData as CurrentProfile;

  /*
   * Administrateur :
   * tous les droits.
   */

  if (
    profile.access_role ===
    "admin"
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
    .from(
      "profile_business_roles"
    )
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
    (assignmentsData ??
      []) as BusinessRoleAssignment[]
  )
    .map(
      getBusinessRoleCode
    )
    .filter(
      (
        code
      ): code is string =>
        Boolean(code)
    )
    .map((code) =>
      code
        .trim()
        .toLowerCase()
    );

  /*
   * La normalisation en minuscules
   * supporte aussi l'ancienne valeur
   * "Chef_centre".
   */

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

/*
 * =========================================================
 * GET
 * =========================================================
 *
 * Liste complète des articles.
 *
 * Lecture :
 *
 * - admin
 * - responsable_pharmacie
 * - chef_centre
 * - adjoint_chef_centre
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
          "Vous n'êtes pas autorisé à consulter le stock pharmacie.",
      },
      {
        status: 403,
      }
    );
  }

  const {
    data: articlesData,
    error: articlesError,
  } = await supabaseAdmin
    .from("medical_items")
    .select(`
      id,
      name,
      description,

      category_id,

      medical_categories (
        id,
        code,
        label,
        display_order
      ),

      packaging_type,
      units_per_box,

      quantity,
      minimum_quantity,

      location,
      notes,

      has_expiration,
      is_active,

      created_at,
      updated_at
    `)
    .order(
      "name",
      {
        ascending: true,
      }
    );

  if (articlesError) {
    console.error(
      "Impossible de récupérer les articles :",
      articlesError
    );

    return NextResponse.json(
      {
        error:
          "Les articles du stock n'ont pas pu être récupérés.",
      },
      {
        status: 500,
      }
    );
  }

  const articles =
    articlesData ?? [];

  /*
   * =====================================================
   * FOURNISSEURS
   * =====================================================
   */

  const articleIds =
    articles.map(
      (article) =>
        article.id
    );

  let supplierAssignments:
    any[] = [];

  if (
    articleIds.length > 0
  ) {
    const {
      data,
      error:
        supplierError,
    } = await supabaseAdmin
      .from(
        "medical_item_suppliers"
      )
      .select(`
        id,
        medical_item_id,
        supplier_id,

        supplier_reference,
        packaging_type,
        units_per_box,

        is_primary,
        notes,

        medical_suppliers (
          id,
          name,
          phone,
          email,
          website,
          is_active
        )
      `)
      .in(
        "medical_item_id",
        articleIds
      )
      .order(
        "is_primary",
        {
          ascending: false,
        }
      );

    if (supplierError) {
      console.error(
        "Impossible de récupérer les fournisseurs des articles :",
        supplierError
      );
    } else {
      supplierAssignments =
        data ?? [];
    }
  }

  /*
   * =====================================================
   * PÉREMPTIONS
   * =====================================================
   */

  let expirations:
    any[] = [];

  if (
    articleIds.length > 0
  ) {
    const {
      data,
      error:
        expirationsError,
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
      .in(
        "medical_item_id",
        articleIds
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
    } else {
      expirations =
        data ?? [];
    }
  }

  /*
   * =====================================================
   * CONSTRUCTION DE LA RÉPONSE
   * =====================================================
   */

  const enrichedArticles =
    articles.map(
      (article) => {
        const suppliers =
          supplierAssignments.filter(
            (assignment) =>
              assignment.medical_item_id ===
              article.id
          );

        const articleExpirations =
          expirations.filter(
            (expiration) =>
              expiration.medical_item_id ===
              article.id
          );

        const isLowStock =
          article.quantity <=
          article.minimum_quantity;

        return {
          ...article,

          suppliers,

          expirations:
            articleExpirations,

          alerts: {
            low_stock:
              isLowStock,
          },
        };
      }
    );

  return NextResponse.json({
    articles:
      enrichedArticles,

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
 * Création d'un article.
 *
 * Écriture :
 *
 * - admin
 * - responsable_pharmacie
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

  if (
    !permission.canWrite
  ) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à ajouter du matériel au stock pharmacie.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * =====================================================
   * PAYLOAD
   * =====================================================
   */

  let payload:
    CreateArticlePayload;

  try {
    payload =
      (await request.json()) as
        CreateArticlePayload;
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

  /*
   * =====================================================
   * DONNÉES PRINCIPALES
   * =====================================================
   */

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

  const description =
    normalizeNullableString(
      payload.description
    );

  const location =
    normalizeNullableString(
      payload.location
    );

  const notes =
    normalizeNullableString(
      payload.notes
    );

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

  const quantity =
    typeof payload.quantity ===
      "number" &&
    Number.isInteger(
      payload.quantity
    ) &&
    payload.quantity >= 0
      ? payload.quantity
      : null;

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
    payload.hasExpiration ===
    true;

  /*
   * =====================================================
   * VALIDATIONS
   * =====================================================
   */

  if (!name) {
    return NextResponse.json(
      {
        error:
          "Le nom du matériel est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    name.length > 200
  ) {
    return NextResponse.json(
      {
        error:
          "Le nom du matériel est trop long.",
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
    packagingType ===
      "box" &&
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
    quantity === null
  ) {
    return NextResponse.json(
      {
        error:
          "La quantité en stock est invalide.",
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

  /*
   * =====================================================
   * CATÉGORIE
   * =====================================================
   */

  const {
    data: categoryData,
    error: categoryError,
  } = await supabaseAdmin
    .from(
      "medical_categories"
    )
    .select(`
      id,
      label,
      is_active
    `)
    .eq(
      "id",
      categoryId
    )
    .single();

  if (
    categoryError ||
    !categoryData
  ) {
    return NextResponse.json(
      {
        error:
          "La catégorie sélectionnée n'existe pas.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !categoryData.is_active
  ) {
    return NextResponse.json(
      {
        error:
          "La catégorie sélectionnée est désactivée.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =====================================================
   * DOUBLON D'ARTICLE
   * =====================================================
   */

  const {
    data: existingArticles,
    error:
      existingArticleError,
  } = await supabaseAdmin
    .from(
      "medical_items"
    )
    .select("id, name")
    .ilike(
      "name",
      name
    )
    .limit(1);

  if (
    existingArticleError
  ) {
    console.error(
      "Impossible de vérifier l'article existant :",
      existingArticleError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier si cet article existe déjà.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    existingArticles &&
    existingArticles.length > 0
  ) {
    return NextResponse.json(
      {
        error:
          "Un article portant ce nom existe déjà.",
      },
      {
        status: 409,
      }
    );
  }

  /*
   * =====================================================
   * FOURNISSEURS DU PAYLOAD
   * =====================================================
   */

  const rawSuppliers =
    Array.isArray(
      payload.suppliers
    )
      ? (payload.suppliers as
          SupplierPayload[])
      : [];

  const normalizedSuppliers =
    rawSuppliers.map(
      (
        supplier
      ) => {
        const supplierId =
          typeof supplier.supplierId ===
          "string"
            ? supplier.supplierId.trim()
            : "";

        const supplierReference =
          normalizeNullableString(
            supplier.supplierReference
          );

        const supplierPackaging =
          supplier.packagingType ===
            "unit" ||
          supplier.packagingType ===
            "box"
            ? supplier.packagingType
            : null;

        const supplierUnitsPerBox =
          typeof supplier.unitsPerBox ===
            "number" &&
          Number.isInteger(
            supplier.unitsPerBox
          ) &&
          supplier.unitsPerBox > 0
            ? supplier.unitsPerBox
            : null;

        const isPrimary =
          supplier.isPrimary ===
          true;

        const supplierNotes =
          normalizeNullableString(
            supplier.notes
          );

        return {
          supplierId,
          supplierReference,
          packagingType:
            supplierPackaging,
          unitsPerBox:
            supplierUnitsPerBox,
          isPrimary,
          notes:
            supplierNotes,
        };
      }
    );

  /*
   * Aucun fournisseur vide.
   */

  if (
    normalizedSuppliers.some(
      (supplier) =>
        !supplier.supplierId
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Un fournisseur sélectionné est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Pas deux fois le même fournisseur.
   */

  const supplierIds =
    normalizedSuppliers.map(
      (supplier) =>
        supplier.supplierId
    );

  if (
    new Set(
      supplierIds
    ).size !==
    supplierIds.length
  ) {
    return NextResponse.json(
      {
        error:
          "Un fournisseur ne peut être ajouté qu'une seule fois au même article.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Maximum un fournisseur principal.
   */

  const primarySuppliers =
    normalizedSuppliers.filter(
      (supplier) =>
        supplier.isPrimary
    );

  if (
    primarySuppliers.length > 1
  ) {
    return NextResponse.json(
      {
        error:
          "Un article ne peut avoir qu'un seul fournisseur principal.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Vérification de l'existence
   * des fournisseurs.
   */

  if (
    supplierIds.length > 0
  ) {
    const {
      data:
        existingSuppliers,
      error:
        suppliersValidationError,
    } = await supabaseAdmin
      .from(
        "medical_suppliers"
      )
      .select(`
        id,
        is_active
      `)
      .in(
        "id",
        supplierIds
      );

    if (
      suppliersValidationError
    ) {
      console.error(
        "Impossible de vérifier les fournisseurs :",
        suppliersValidationError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de vérifier les fournisseurs sélectionnés.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      (existingSuppliers ??
        []).length !==
      supplierIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "Un ou plusieurs fournisseurs n'existent pas.",
        },
        {
          status: 400,
        }
      );
    }

    const hasDisabledSupplier =
      (
        existingSuppliers ??
        []
      ).some(
        (supplier) =>
          !supplier.is_active
      );

    if (
      hasDisabledSupplier
    ) {
      return NextResponse.json(
        {
          error:
            "Un fournisseur sélectionné est désactivé.",
        },
        {
          status: 400,
        }
      );
    }
  }

  /*
   * =====================================================
   * CRÉATION DE L'ARTICLE
   * =====================================================
   */

  const {
    data: createdArticle,
    error: articleCreationError,
  } = await supabaseAdmin
    .from("medical_items")
    .insert({
      name,

      category_id:
        categoryId,

      description,

      packaging_type:
        packagingType,

      units_per_box:
        packagingType ===
        "box"
          ? unitsPerBox
          : null,

      /*
       * quantity est TOUJOURS
       * enregistrée en unités.
       */

      quantity,

      minimum_quantity:
        minimumQuantity,

      location,

      notes,

      has_expiration:
        hasExpiration,

      is_active:
        true,

      created_by:
        currentUser.id,

      updated_by:
        currentUser.id,
    })
    .select(`
      id,
      name,
      description,

      category_id,

      packaging_type,
      units_per_box,

      quantity,
      minimum_quantity,

      location,
      notes,

      has_expiration,
      is_active,

      created_at,
      updated_at
    `)
    .single();

  if (
    articleCreationError ||
    !createdArticle
  ) {
    console.error(
      "Impossible de créer l'article :",
      articleCreationError
    );

    return NextResponse.json(
      {
        error:
          "L'article n'a pas pu être créé.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * =====================================================
   * FOURNISSEURS
   * =====================================================
   */

  if (
    normalizedSuppliers.length >
    0
  ) {
    const {
      error:
        supplierInsertError,
    } = await supabaseAdmin
      .from(
        "medical_item_suppliers"
      )
      .insert(
        normalizedSuppliers.map(
          (supplier) => ({
            medical_item_id:
              createdArticle.id,

            supplier_id:
              supplier.supplierId,

            supplier_reference:
              supplier.supplierReference,

            packaging_type:
              supplier.packagingType,

            units_per_box:
              supplier.packagingType ===
              "box"
                ? supplier.unitsPerBox
                : null,

            is_primary:
              supplier.isPrimary,

            notes:
              supplier.notes,

            created_by:
              currentUser.id,

            updated_by:
              currentUser.id,
          })
        )
      );

    if (
      supplierInsertError
    ) {
      console.error(
        "Article créé mais association fournisseur impossible :",
        supplierInsertError
      );

      /*
       * Rollback de l'article.
       */

      await supabaseAdmin
        .from(
          "medical_items"
        )
        .delete()
        .eq(
          "id",
          createdArticle.id
        );

      return NextResponse.json(
        {
          error:
            "L'article n'a pas pu être associé à ses fournisseurs.",
        },
        {
          status: 500,
        }
      );
    }
  }

  /*
   * =====================================================
   * MOUVEMENT INITIAL DE STOCK
   * =====================================================
   */

  if (
    quantity > 0
  ) {
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
      error:
        movementError,
    } = await supabaseAdmin
      .from(
        "medical_stock_movements"
      )
      .insert({
        medical_item_id:
          createdArticle.id,

        movement_type:
          "initial",

        quantity_change:
          quantity,

        previous_quantity:
          0,

        new_quantity:
          quantity,

        reason:
          "Création de l'article",

        actor_id:
          currentUser.id,

        actor_name:
          actorName,
      });

    if (
      movementError
    ) {
      console.error(
        "Article créé, mais mouvement initial impossible :",
        movementError
      );
    }
  }

  /*
   * =====================================================
   * AUDIT
   * =====================================================
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
        currentUser.email ??
        null,

      action:
        "CREATE_MEDICAL_ITEM",

      target_profile_id:
        null,

      target_name:
        name,

      target_email:
        null,

      module:
        "secourisme",

      details: {
        medical_item_id:
          createdArticle.id,

        category_id:
          categoryId,

        category:
          categoryData.label,

        packaging_type:
          packagingType,

        units_per_box:
          packagingType ===
          "box"
            ? unitsPerBox
            : null,

        initial_quantity:
          quantity,

        minimum_quantity:
          minimumQuantity,

        location,

        has_expiration:
          hasExpiration,

        supplier_ids:
          supplierIds,
      },
    });

  if (auditError) {
    console.error(
      "Article créé, mais audit impossible :",
      auditError
    );
  }

  /*
   * =====================================================
   * RELECTURE DES FOURNISSEURS
   * =====================================================
   */

  const {
    data: savedSuppliers,
    error:
      savedSuppliersError,
  } = await supabaseAdmin
    .from(
      "medical_item_suppliers"
    )
    .select(`
      id,
      supplier_reference,
      packaging_type,
      units_per_box,
      is_primary,
      notes,

      medical_suppliers (
        id,
        name,
        phone,
        email,
        website
      )
    `)
    .eq(
      "medical_item_id",
      createdArticle.id
    )
    .order(
      "is_primary",
      {
        ascending: false,
      }
    );

  if (
    savedSuppliersError
  ) {
    console.error(
      "Impossible de relire les fournisseurs :",
      savedSuppliersError
    );
  }

  /*
   * =====================================================
   * RÉPONSE
   * =====================================================
   */

  return NextResponse.json(
    {
      message:
        "Le matériel a été ajouté au stock pharmacie avec succès.",

      article: {
        ...createdArticle,

        category:
          categoryData,

        suppliers:
          savedSuppliers ??
          [],

        expirations: [],

        alerts: {
          low_stock:
            quantity <=
            minimumQuantity,
        },
      },
    },
    {
      status: 201,
    }
  );
}