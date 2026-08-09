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

const SUPPLIER_READ_ROLES = [
  "responsable_pharmacie",
  "chef_centre",
  "adjoint_chef_centre",
] as const;

const SUPPLIER_WRITE_ROLES = [
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

type SupplierArticleRow = {
  id: string;
  supplier_reference: string | null;
  packaging_type: string | null;
  units_per_box: number | null;
  is_primary: boolean;
  notes: string | null;

  medical_items:
    | {
        id: string;
        name: string;
        description: string | null;
        quantity: number;
        minimum_quantity: number;
        location: string | null;
        unit: string;
        packaging_type: string;
        units_per_box: number | null;
        is_active: boolean;

        medical_categories:
          | {
              id: number;
              code: string;
              label: string;
            }
          | {
              id: number;
              code: string;
              label: string;
            }[]
          | null;
      }
    | {
        id: string;
        name: string;
        description: string | null;
        quantity: number;
        minimum_quantity: number;
        location: string | null;
        unit: string;
        packaging_type: string;
        units_per_box: number | null;
        is_active: boolean;

        medical_categories:
          | {
              id: number;
              code: string;
              label: string;
            }
          | {
              id: number;
              code: string;
              label: string;
            }[]
          | null;
      }[]
    | null;
};

type CreateSupplierArticlePayload = {
  medicalItemId?: unknown;
  supplierReference?: unknown;
  packagingType?: unknown;
  unitsPerBox?: unknown;
  isPrimary?: unknown;
  notes?: unknown;
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

  const normalized = value.trim();

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

async function getSupplierPermission(
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
      SUPPLIER_READ_ROLES.includes(
        code as
          (typeof SUPPLIER_READ_ROLES)[number]
      )
    );

  const canWrite =
    roleCodes.some((code) =>
      SUPPLIER_WRITE_ROLES.includes(
        code as
          (typeof SUPPLIER_WRITE_ROLES)[number]
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
    await getSupplierPermission(
      requestSupabase,
      currentUser.id
    );

  return {
    error: null,
    currentUser,
    permission,
  };
}

function extractCategory(
  medicalItem:
    | SupplierArticleRow["medical_items"]
) {
  if (
    !medicalItem ||
    Array.isArray(medicalItem)
  ) {
    return null;
  }

  const category =
    medicalItem.medical_categories;

  if (!category) {
    return null;
  }

  if (
    Array.isArray(category)
  ) {
    return (
      category[0] ?? null
    );
  }

  return category;
}

function formatArticle(
  row: SupplierArticleRow
) {
  const medicalItem =
    Array.isArray(
      row.medical_items
    )
      ? row.medical_items[0]
      : row.medical_items;

  if (!medicalItem) {
    return null;
  }

  const category =
    extractCategory(
      medicalItem
    );

  return {
    id: row.id,

    supplier_reference:
      row.supplier_reference,

    packaging_type:
      row.packaging_type,

    units_per_box:
      row.units_per_box,

    is_primary:
      row.is_primary,

    notes:
      row.notes,

    medical_item: {
      id:
        medicalItem.id,

      name:
        medicalItem.name,

      quantity:
        medicalItem.quantity,

      minimum_quantity:
        medicalItem.minimum_quantity,

      packaging_type:
        medicalItem.packaging_type,

      units_per_box:
        medicalItem.units_per_box,

      category:
        category
          ? {
              id:
                String(category.id),

              label:
                category.label,
            }
          : null,
    },
  };
}

/*
 * =========================================================
 * GET
 * =========================================================
 *
 * Liste des articles associés à un fournisseur.
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
          "Vous n'êtes pas autorisé à consulter les articles de ce fournisseur.",
      },
      {
        status: 403,
      }
    );
  }

  const { id: supplierId } =
    await context.params;

  if (!supplierId) {
    return NextResponse.json(
      {
        error:
          "Le fournisseur est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: supplier,
    error: supplierError,
  } = await supabaseAdmin
    .from("medical_suppliers")
    .select(`
      id,
      name,
      address,
      phone,
      email,
      website,
      contact_name,
      notes,
      is_active
    `)
    .eq("id", supplierId)
    .single();

  if (
    supplierError ||
    !supplier
  ) {
    return NextResponse.json(
      {
        error:
          "Fournisseur introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    data: rowsData,
    error: rowsError,
  } = await supabaseAdmin
    .from("medical_item_suppliers")
    .select(`
      id,
      supplier_reference,
      packaging_type,
      units_per_box,
      is_primary,
      notes,

      medical_items!inner (
        id,
        name,
        description,
        quantity,
        minimum_quantity,
        location,
        unit,
        packaging_type,
        units_per_box,
        is_active,

        medical_categories (
          id,
          code,
          label
        )
      )
    `)
    .eq(
      "supplier_id",
      supplierId
    )
    .order(
      "is_primary",
      {
        ascending: false,
      }
    );

  if (rowsError) {
    console.error(
      "Impossible de récupérer les articles du fournisseur :",
      rowsError
    );

    return NextResponse.json(
      {
        error:
          "Les articles de ce fournisseur n'ont pas pu être récupérés.",
      },
      {
        status: 500,
      }
    );
  }

  const rows =
    (rowsData ?? []) as
      SupplierArticleRow[];

  const articles =
    rows
      .map(formatArticle)
      .filter(
        (
          article
        ): article is NonNullable<
          ReturnType<
            typeof formatArticle
          >
        > =>
          Boolean(article)
      )
      .sort((a, b) =>
        a.medical_item.name.localeCompare(
          b.medical_item.name,
          "fr",
          {
            sensitivity: "base",
          }
        )
      );

  return NextResponse.json({
    supplier,
    articles,
    total:
      articles.length,
  });
}

/*
 * =========================================================
 * POST
 * =========================================================
 *
 * Associe un article existant du stock à un fournisseur.
 *
 * Autorisés :
 * - Admin
 * - Responsable pharmacie
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
          "Vous n'êtes pas autorisé à ajouter une référence fournisseur.",
      },
      {
        status: 403,
      }
    );
  }

  const { id: supplierId } =
    await context.params;

  if (!supplierId) {
    return NextResponse.json(
      {
        error:
          "Le fournisseur est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  let payload:
    CreateSupplierArticlePayload;

  try {
    payload =
      (await request.json()) as
        CreateSupplierArticlePayload;
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

  const medicalItemId =
    typeof payload.medicalItemId ===
    "string"
      ? payload.medicalItemId.trim()
      : "";

  const supplierReference =
    normalizeNullableString(
      payload.supplierReference
    );

  const packagingType =
    normalizeNullableString(
      payload.packagingType
    );

  const notes =
    normalizeNullableString(
      payload.notes
    );

  const isPrimary =
    typeof payload.isPrimary ===
    "boolean"
      ? payload.isPrimary
      : false;

  let unitsPerBox:
    number | null = null;

  if (
    payload.unitsPerBox !==
      undefined &&
    payload.unitsPerBox !==
      null &&
    payload.unitsPerBox !== ""
  ) {
    const parsed =
      Number(payload.unitsPerBox);

    if (
      !Number.isInteger(parsed) ||
      parsed <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Le nombre d'unités par boîte doit être un entier supérieur à 0.",
        },
        {
          status: 400,
        }
      );
    }

    unitsPerBox = parsed;
  }

  if (!medicalItemId) {
    return NextResponse.json(
      {
        error:
          "L'article est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: supplier,
    error: supplierError,
  } = await supabaseAdmin
    .from("medical_suppliers")
    .select(
      "id, name, is_active"
    )
    .eq(
      "id",
      supplierId
    )
    .maybeSingle();

  if (supplierError) {
    console.error(
      "Impossible de vérifier le fournisseur :",
      supplierError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier ce fournisseur.",
      },
      {
        status: 500,
      }
    );
  }

  if (!supplier) {
    return NextResponse.json(
      {
        error:
          "Fournisseur introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    data: medicalItem,
    error: medicalItemError,
  } = await supabaseAdmin
    .from("medical_items")
    .select(`
      id,
      name,
      description,
      quantity,
      minimum_quantity,
      location,
      unit,
      packaging_type,
      units_per_box,
      is_active,

      medical_categories (
        id,
        code,
        label
      )
    `)
    .eq(
      "id",
      medicalItemId
    )
    .maybeSingle();

  if (medicalItemError) {
    console.error(
      "Impossible de vérifier l'article :",
      medicalItemError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier cet article.",
      },
      {
        status: 500,
      }
    );
  }

  if (!medicalItem) {
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
    data: existingLink,
    error: existingLinkError,
  } = await supabaseAdmin
    .from("medical_item_suppliers")
    .select("id")
    .eq(
      "medical_item_id",
      medicalItemId
    )
    .eq(
      "supplier_id",
      supplierId
    )
    .maybeSingle();

  if (existingLinkError) {
    console.error(
      "Impossible de vérifier l'association fournisseur/article :",
      existingLinkError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier cette référence fournisseur.",
      },
      {
        status: 500,
      }
    );
  }

  if (existingLink) {
    return NextResponse.json(
      {
        error:
          "Cet article est déjà associé à ce fournisseur.",
      },
      {
        status: 409,
      }
    );
  }

  let previousPrimaryIds:
    string[] = [];

  if (isPrimary) {
    const {
      data: previousPrimaries,
      error: previousPrimariesError,
    } = await supabaseAdmin
      .from("medical_item_suppliers")
      .select("id")
      .eq(
        "medical_item_id",
        medicalItemId
      )
      .eq(
        "is_primary",
        true
      );

    if (previousPrimariesError) {
      console.error(
        "Impossible de vérifier le fournisseur principal actuel :",
        previousPrimariesError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de vérifier le fournisseur principal de cet article.",
        },
        {
          status: 500,
        }
      );
    }

    previousPrimaryIds =
      (previousPrimaries ?? [])
        .map((row) => row.id);

    if (
      previousPrimaryIds.length > 0
    ) {
      const {
        error: clearPrimaryError,
      } = await supabaseAdmin
        .from(
          "medical_item_suppliers"
        )
        .update({
          is_primary: false,
        })
        .in(
          "id",
          previousPrimaryIds
        );

      if (clearPrimaryError) {
        console.error(
          "Impossible de retirer l'ancien fournisseur principal :",
          clearPrimaryError
        );

        return NextResponse.json(
          {
            error:
              "Le fournisseur principal n'a pas pu être mis à jour.",
          },
          {
            status: 500,
          }
        );
      }
    }
  }

  const {
    data: createdLink,
    error: creationError,
  } = await supabaseAdmin
    .from("medical_item_suppliers")
    .insert({
      medical_item_id:
        medicalItemId,

      supplier_id:
        supplierId,

      supplier_reference:
        supplierReference,

      packaging_type:
        packagingType,

      units_per_box:
        unitsPerBox,

      is_primary:
        isPrimary,

      notes,
    })
    .select(`
      id,
      supplier_reference,
      packaging_type,
      units_per_box,
      is_primary,
      notes,

      medical_items!inner (
        id,
        name,
        description,
        quantity,
        minimum_quantity,
        location,
        unit,
        packaging_type,
        units_per_box,
        is_active,

        medical_categories (
          id,
          code,
          label
        )
      )
    `)
    .single();

  if (
    creationError ||
    !createdLink
  ) {
    console.error(
      "Impossible d'ajouter la référence fournisseur :",
      creationError
    );

    if (
      isPrimary &&
      previousPrimaryIds.length > 0
    ) {
      const {
        error: restorePrimaryError,
      } = await supabaseAdmin
        .from(
          "medical_item_suppliers"
        )
        .update({
          is_primary: true,
        })
        .in(
          "id",
          previousPrimaryIds
        );

      if (restorePrimaryError) {
        console.error(
          "Impossible de restaurer l'ancien fournisseur principal :",
          restorePrimaryError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "La référence fournisseur n'a pas pu être ajoutée.",
      },
      {
        status: 500,
      }
    );
  }

  const formattedArticle =
    formatArticle(
      createdLink as
        SupplierArticleRow
    );

  if (!formattedArticle) {
    return NextResponse.json(
      {
        error:
          "La référence a été créée, mais elle n'a pas pu être relue.",
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
        currentUser.email ??
        null,

      action:
        "CREATE_MEDICAL_ITEM_SUPPLIER",

      target_profile_id:
        null,

      target_name:
        medicalItem.name,

      target_email:
        null,

      module:
        "secourisme",

      details: {
        supplier_id:
          supplierId,

        supplier_name:
          supplier.name,

        medical_item_id:
          medicalItemId,

        medical_item_name:
          medicalItem.name,

        supplier_reference:
          supplierReference,

        packaging_type:
          packagingType,

        units_per_box:
          unitsPerBox,

        is_primary:
          isPrimary,
      },
    });

  if (auditError) {
    console.error(
      "Référence fournisseur créée, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json(
    {
      message:
        "La référence fournisseur a été ajoutée avec succès.",

      article:
        formattedArticle,
    },
    {
      status: 201,
    }
  );
}