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
    | { code: string }
    | { code: string }[]
    | null;
};

type PermissionResult = {
  canWrite: boolean;
  profile: CurrentProfile | null;
};

type UpdateSupplierLinkPayload = {
  supplierId?: unknown;
  supplierReference?: unknown;
  packagingType?: unknown;
  unitsPerBox?: unknown;
  isPrimary?: unknown;
  notes?: unknown;
};

type DeleteSupplierLinkPayload = {
  supplierId?: unknown;
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
      SUPPLIER_WRITE_ROLES.includes(
        code as
          (typeof SUPPLIER_WRITE_ROLES)[number]
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
    `${profile.first_name ?? ""} ${
      profile.last_name ?? ""
    }`.trim() ||
    email ||
    "Utilisateur inconnu"
  );
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
          "Vous n'êtes pas autorisé à modifier une référence fournisseur.",
      },
      {
        status: 403,
      }
    );
  }

  const { id: medicalItemId } =
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
    UpdateSupplierLinkPayload;

  try {
    payload =
      (await request.json()) as
        UpdateSupplierLinkPayload;
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

  const supplierId =
    typeof payload.supplierId ===
    "string"
      ? payload.supplierId.trim()
      : "";

  if (!supplierId) {
    return NextResponse.json(
      {
        error:
          "Le fournisseur est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  const supplierReference =
    normalizeNullableString(
      payload.supplierReference
    );

  const packagingType =
    payload.packagingType ===
      "unit" ||
    payload.packagingType ===
      "box"
      ? payload.packagingType
      : null;

  const isPrimary =
    payload.isPrimary === true;

  const notes =
    normalizeNullableString(
      payload.notes
    );

  let unitsPerBox:
    number | null = null;

  if (packagingType === "box") {
    const parsed =
      Number(
        payload.unitsPerBox
      );

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

  const {
    data: existingLink,
    error: existingLinkError,
  } = await supabaseAdmin
    .from("medical_item_suppliers")
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
        name
      ),

      medical_items (
        id,
        name
      )
    `)
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
      "Impossible de récupérer la référence fournisseur :",
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

  if (!existingLink) {
    return NextResponse.json(
      {
        error:
          "Cette référence fournisseur n'existe pas.",
      },
      {
        status: 404,
      }
    );
  }

  if (isPrimary) {
    const {
      error: clearPrimaryError,
    } = await supabaseAdmin
      .from("medical_item_suppliers")
      .update({
        is_primary: false,
        updated_by:
          currentUser.id,
      })
      .eq(
        "medical_item_id",
        medicalItemId
      )
      .neq(
        "id",
        existingLink.id
      )
      .eq(
        "is_primary",
        true
      );

    if (clearPrimaryError) {
      console.error(
        "Impossible de modifier le fournisseur principal :",
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

  const {
    data: updatedLink,
    error: updateError,
  } = await supabaseAdmin
    .from("medical_item_suppliers")
    .update({
      supplier_reference:
        supplierReference,

      packaging_type:
        packagingType,

      units_per_box:
        packagingType ===
        "box"
          ? unitsPerBox
          : null,

      is_primary:
        isPrimary,

      notes,

      updated_by:
        currentUser.id,
    })
    .eq(
      "id",
      existingLink.id
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
        name
      )
    `)
    .single();

  if (
    updateError ||
    !updatedLink
  ) {
    console.error(
      "Impossible de modifier la référence fournisseur :",
      updateError
    );

    return NextResponse.json(
      {
        error:
          "La référence fournisseur n'a pas pu être modifiée.",
      },
      {
        status: 500,
      }
    );
  }

  const supplierData =
    Array.isArray(
      existingLink.medical_suppliers
    )
      ? existingLink
          .medical_suppliers[0]
      : existingLink
          .medical_suppliers;

  const itemData =
    Array.isArray(
      existingLink.medical_items
    )
      ? existingLink
          .medical_items[0]
      : existingLink
          .medical_items;

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
        "UPDATE_MEDICAL_ITEM_SUPPLIER",

      target_profile_id:
        null,

      target_name:
        itemData?.name ??
        "Article",

      target_email:
        null,

      module:
        "secourisme",

      details: {
        medical_item_id:
          medicalItemId,

        medical_item_name:
          itemData?.name ??
          null,

        supplier_id:
          supplierId,

        supplier_name:
          supplierData?.name ??
          null,

        previous_supplier_reference:
          existingLink
            .supplier_reference,

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
      "Référence modifiée, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json({
    message:
      "La référence fournisseur a été modifiée avec succès.",

    supplier:
      updatedLink,
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
          "Vous n'êtes pas autorisé à supprimer une référence fournisseur.",
      },
      {
        status: 403,
      }
    );
  }

  const { id: medicalItemId } =
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
    DeleteSupplierLinkPayload;

  try {
    payload =
      (await request.json()) as
        DeleteSupplierLinkPayload;
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

  const supplierId =
    typeof payload.supplierId ===
    "string"
      ? payload.supplierId.trim()
      : "";

  if (!supplierId) {
    return NextResponse.json(
      {
        error:
          "Le fournisseur est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: existingLink,
    error: existingLinkError,
  } = await supabaseAdmin
    .from("medical_item_suppliers")
    .select(`
      id,
      supplier_reference,
      is_primary,

      medical_suppliers (
        id,
        name
      ),

      medical_items (
        id,
        name
      )
    `)
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
      "Impossible de récupérer la référence fournisseur :",
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

  if (!existingLink) {
    return NextResponse.json(
      {
        error:
          "Cette référence fournisseur n'existe pas.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    error: deleteError,
  } = await supabaseAdmin
    .from("medical_item_suppliers")
    .delete()
    .eq(
      "id",
      existingLink.id
    );

  if (deleteError) {
    console.error(
      "Impossible de supprimer la référence fournisseur :",
      deleteError
    );

    return NextResponse.json(
      {
        error:
          "La référence fournisseur n'a pas pu être supprimée.",
      },
      {
        status: 500,
      }
    );
  }

  const supplierData =
    Array.isArray(
      existingLink.medical_suppliers
    )
      ? existingLink
          .medical_suppliers[0]
      : existingLink
          .medical_suppliers;

  const itemData =
    Array.isArray(
      existingLink.medical_items
    )
      ? existingLink
          .medical_items[0]
      : existingLink
          .medical_items;

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
        "DELETE_MEDICAL_ITEM_SUPPLIER",

      target_profile_id:
        null,

      target_name:
        itemData?.name ??
        "Article",

      target_email:
        null,

      module:
        "secourisme",

      details: {
        medical_item_id:
          medicalItemId,

        medical_item_name:
          itemData?.name ??
          null,

        supplier_id:
          supplierId,

        supplier_name:
          supplierData?.name ??
          null,

        supplier_reference:
          existingLink
            .supplier_reference,

        was_primary:
          existingLink.is_primary,
      },
    });

  if (auditError) {
    console.error(
      "Référence supprimée, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json({
    message:
      "La référence fournisseur a été supprimée avec succès.",
  });
}