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
 *
 * Lecture :
 * - admin
 * - responsable_pharmacie
 * - chef_centre
 * - adjoint_chef_centre
 *
 * Modification :
 * - admin
 * - responsable_pharmacie
 */

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

type CreateSupplierPayload = {
  name?: unknown;
  address?: unknown;
  phone?: unknown;
  email?: unknown;
  website?: unknown;
  contactName?: unknown;
  notes?: unknown;
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
 * TEXTE OPTIONNEL
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
 * EXTRACTION DU CODE DU RÔLE
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
 * PERMISSIONS
 * =========================================================
 */

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
   * Admin = accès total.
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

  /*
   * Rôles métier.
   */

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

  const canRead =
    roleCodes.some(
      (code) =>
        SUPPLIER_READ_ROLES.includes(
          code as
            (typeof SUPPLIER_READ_ROLES)[number]
        )
    );

  const canWrite =
    roleCodes.some(
      (code) =>
        SUPPLIER_WRITE_ROLES.includes(
          code as
            (typeof SUPPLIER_WRITE_ROLES)[number]
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
 * AUTHENTIFICATION
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
    error:
      currentUserError,
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

/*
 * =========================================================
 * GET
 * =========================================================
 *
 * Liste des fournisseurs.
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
          "Vous n'êtes pas autorisé à consulter les fournisseurs.",
      },
      {
        status: 403,
      }
    );
  }

  const {
    data: suppliers,
    error: suppliersError,
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

  if (suppliersError) {
    console.error(
      "Impossible de récupérer les fournisseurs :",
      suppliersError
    );

    return NextResponse.json(
      {
        error:
          "Les fournisseurs n'ont pas pu être récupérés.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * =====================================================
   * NOMBRE DE RÉFÉRENCES PAR FOURNISSEUR
   * =====================================================
   */

  const supplierIds =
    (suppliers ?? []).map(
      (supplier) =>
        supplier.id
    );

  let referenceCounts =
    new Map<string, number>();

  if (
    supplierIds.length > 0
  ) {
    const {
      data: references,
      error: referencesError,
    } = await supabaseAdmin
      .from(
        "medical_item_suppliers"
      )
      .select(
        "supplier_id"
      )
      .in(
        "supplier_id",
        supplierIds
      );

    if (referencesError) {
      console.error(
        "Impossible de compter les références fournisseurs :",
        referencesError
      );
    } else {
      referenceCounts =
        new Map();

      for (
        const reference of
        references ?? []
      ) {
        const supplierId =
          reference.supplier_id;

        referenceCounts.set(
          supplierId,
          (
            referenceCounts.get(
              supplierId
            ) ?? 0
          ) + 1
        );
      }
    }
  }

  const suppliersWithCounts =
    (suppliers ?? []).map(
      (supplier) => ({
        ...supplier,

        reference_count:
          referenceCounts.get(
            supplier.id
          ) ?? 0,
      })
    );

  return NextResponse.json({
    suppliers:
      suppliersWithCounts,

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
 * Création d'un fournisseur.
 *
 * Autorisés :
 *
 * - Admin
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

  if (
    !permission.canWrite
  ) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à créer un fournisseur.",
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
    CreateSupplierPayload;

  try {
    payload =
      (await request.json()) as
        CreateSupplierPayload;
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

  const address =
    normalizeNullableString(
      payload.address
    );

  const phone =
    normalizeNullableString(
      payload.phone
    );

  const email =
    normalizeNullableString(
      payload.email
    )?.toLowerCase() ??
    null;

  const website =
    normalizeNullableString(
      payload.website
    );

  const contactName =
    normalizeNullableString(
      payload.contactName
    );

  const notes =
    normalizeNullableString(
      payload.notes
    );

  /*
   * =====================================================
   * VALIDATION
   * =====================================================
   */

  if (!name) {
    return NextResponse.json(
      {
        error:
          "Le nom du fournisseur est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    name.length > 150
  ) {
    return NextResponse.json(
      {
        error:
          "Le nom du fournisseur est trop long.",
      },
      {
        status: 400,
      }
    );
  }

  if (email) {
    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailPattern.test(
        email
      )
    ) {
      return NextResponse.json(
        {
          error:
            "L'adresse e-mail du fournisseur n'est pas valide.",
        },
        {
          status: 400,
        }
      );
    }
  }

  /*
   * =====================================================
   * DOUBLON
   * =====================================================
   */

  const {
    data: existingSupplier,
    error:
      existingSupplierError,
  } = await supabaseAdmin
    .from(
      "medical_suppliers"
    )
    .select(
      "id, name"
    )
    .ilike(
      "name",
      name
    )
    .maybeSingle();

  if (
    existingSupplierError
  ) {
    console.error(
      "Impossible de vérifier l'existence du fournisseur :",
      existingSupplierError
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

  if (existingSupplier) {
    return NextResponse.json(
      {
        error:
          "Un fournisseur portant ce nom existe déjà.",
      },
      {
        status: 409,
      }
    );
  }

  /*
   * =====================================================
   * CRÉATION
   * =====================================================
   */

  const {
    data: createdSupplier,
    error: creationError,
  } = await supabaseAdmin
    .from(
      "medical_suppliers"
    )
    .insert({
      name,
      address,
      phone,
      email,
      website,

      contact_name:
        contactName,

      notes,

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
      address,
      phone,
      email,
      website,
      contact_name,
      notes,
      is_active,
      created_at,
      updated_at
    `)
    .single();

  if (
    creationError ||
    !createdSupplier
  ) {
    console.error(
      "Impossible de créer le fournisseur :",
      creationError
    );

    return NextResponse.json(
      {
        error:
          "Le fournisseur n'a pas pu être créé.",
      },
      {
        status: 500,
      }
    );
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
        "CREATE_MEDICAL_SUPPLIER",

      target_profile_id:
        null,

      target_name:
        createdSupplier.name,

      target_email:
        createdSupplier.email,

      module:
        "secourisme",

      details: {
        supplier_id:
          createdSupplier.id,

        name:
          createdSupplier.name,

        phone:
          createdSupplier.phone,

        email:
          createdSupplier.email,

        website:
          createdSupplier.website,

        contact_name:
          createdSupplier.contact_name,
      },
    });

  if (auditError) {
    console.error(
      "Fournisseur créé, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json(
    {
      message:
        "Le fournisseur a été créé avec succès.",

      supplier: {
        ...createdSupplier,

        reference_count: 0,
      },
    },
    {
      status: 201,
    }
  );
}