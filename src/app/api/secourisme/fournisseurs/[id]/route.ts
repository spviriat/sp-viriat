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

type UpdateSupplierPayload = {
  name?: unknown;
  address?: unknown;
  phone?: unknown;
  email?: unknown;
  website?: unknown;
  contactName?: unknown;
  notes?: unknown;
  isActive?: unknown;
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

async function getSupplierReadPermission(
  requestSupabase: SupabaseClient<any>,
  currentUserId: string
) {
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
      allowed: false,
      profile:
        null as CurrentProfile | null,
    };
  }

  const profile =
    profileData as CurrentProfile;

  if (
    profile.access_role === "admin"
  ) {
    return {
      allowed: true,
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
      allowed: false,
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

  const allowed =
    roleCodes.some((code) =>
      SUPPLIER_READ_ROLES.includes(
        code as
          (typeof SUPPLIER_READ_ROLES)[number]
      )
    );

  return {
    allowed,
    profile,
  };
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

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    return NextResponse.json(
      {
        error:
          "La configuration du serveur est incomplète.",
      },
      {
        status: 500,
      }
    );
  }

  const accessToken =
    getBearerToken(
      request.headers.get(
        "authorization"
      )
    );

  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "Vous devez être connecté.",
      },
      {
        status: 401,
      }
    );
  }

  const requestSupabase =
    createRequestSupabase(
      accessToken
    );

  if (!requestSupabase) {
    return NextResponse.json(
      {
        error:
          "La configuration du serveur est incomplète.",
      },
      {
        status: 500,
      }
    );
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
    return NextResponse.json(
      {
        error:
          "Votre session est invalide ou a expiré.",
      },
      {
        status: 401,
      }
    );
  }

  const permission =
    await getSupplierReadPermission(
      requestSupabase,
      currentUser.id
    );

  if (!permission.allowed) {
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
    rows.flatMap((row) => {
      const medicalItem =
        Array.isArray(
          row.medical_items
        )
          ? row.medical_items[0]
          : row.medical_items;

      if (!medicalItem) {
        return [];
      }

      const category =
        extractCategory(
          medicalItem
        );

      return [
        {
          link_id: row.id,

          supplier_reference:
            row.supplier_reference,

          supplier_packaging_type:
            row.packaging_type,

          supplier_units_per_box:
            row.units_per_box,

          is_primary:
            row.is_primary,

          supplier_notes:
            row.notes,

          id:
            medicalItem.id,

          name:
            medicalItem.name,

          description:
            medicalItem.description,

          quantity:
            medicalItem.quantity,

          minimum_quantity:
            medicalItem.minimum_quantity,

          location:
            medicalItem.location,

          unit:
            medicalItem.unit,

          packaging_type:
            medicalItem.packaging_type,

          units_per_box:
            medicalItem.units_per_box,

          is_active:
            medicalItem.is_active,

          category,
        },
      ];
    });

  articles.sort((a, b) =>
    a.name.localeCompare(
      b.name,
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

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    return NextResponse.json(
      {
        error:
          "La configuration du serveur est incomplète.",
      },
      {
        status: 500,
      }
    );
  }

  const accessToken =
    getBearerToken(
      request.headers.get(
        "authorization"
      )
    );

  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "Vous devez être connecté.",
      },
      {
        status: 401,
      }
    );
  }

  const requestSupabase =
    createRequestSupabase(
      accessToken
    );

  if (!requestSupabase) {
    return NextResponse.json(
      {
        error:
          "La configuration du serveur est incomplète.",
      },
      {
        status: 500,
      }
    );
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
    return NextResponse.json(
      {
        error:
          "Votre session est invalide ou a expiré.",
      },
      {
        status: 401,
      }
    );
  }

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
    .eq("id", currentUser.id)
    .single();

  if (
    profileError ||
    !profileData
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

  const profile =
    profileData as CurrentProfile;

  let canWrite =
    profile.access_role === "admin";

  if (!canWrite) {
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
        currentUser.id
      );

    if (assignmentsError) {
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

    canWrite =
      roleCodes.some((code) =>
        SUPPLIER_WRITE_ROLES.includes(
          code as
            (typeof SUPPLIER_WRITE_ROLES)[number]
        )
      );
  }

  if (!canWrite) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à modifier un fournisseur.",
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
    UpdateSupplierPayload;

  try {
    payload =
      (await request.json()) as
        UpdateSupplierPayload;
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
    typeof payload.name === "string"
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
    )?.toLowerCase() ?? null;

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

  const isActive =
    typeof payload.isActive ===
    "boolean"
      ? payload.isActive
      : true;

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

  if (name.length > 150) {
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
      /^[^\s@]+@[^\s@]+.[^\s@]+$/;

    if (!emailPattern.test(email)) {
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

  const {
    data: existingSupplier,
    error: existingSupplierError,
  } = await supabaseAdmin
    .from("medical_suppliers")
    .select("id, name")
    .eq("id", supplierId)
    .maybeSingle();

  if (existingSupplierError) {
    console.error(
      "Impossible de vérifier le fournisseur :",
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

  if (!existingSupplier) {
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
    data: duplicateSupplier,
    error: duplicateError,
  } = await supabaseAdmin
    .from("medical_suppliers")
    .select("id")
    .ilike("name", name)
    .neq("id", supplierId)
    .maybeSingle();

  if (duplicateError) {
    console.error(
      "Impossible de vérifier les doublons :",
      duplicateError
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

  if (duplicateSupplier) {
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

  const {
    data: updatedSupplier,
    error: updateError,
  } = await supabaseAdmin
    .from("medical_suppliers")
    .update({
      name,
      address,
      phone,
      email,
      website,
      contact_name:
        contactName,
      notes,
      is_active:
        isActive,
      updated_by:
        currentUser.id,
    })
    .eq("id", supplierId)
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
    updateError ||
    !updatedSupplier
  ) {
    console.error(
      "Impossible de modifier le fournisseur :",
      updateError
    );

    return NextResponse.json(
      {
        error:
          "Le fournisseur n'a pas pu être modifié.",
      },
      {
        status: 500,
      }
    );
  }

  const actorName =
    `${
      profile.first_name ?? ""
    } ${
      profile.last_name ?? ""
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
        "UPDATE_MEDICAL_SUPPLIER",
      target_profile_id:
        null,
      target_name:
        updatedSupplier.name,
      target_email:
        updatedSupplier.email,
      module:
        "secourisme",
      details: {
        supplier_id:
          updatedSupplier.id,
        previous_name:
          existingSupplier.name,
        name:
          updatedSupplier.name,
        phone:
          updatedSupplier.phone,
        email:
          updatedSupplier.email,
        website:
          updatedSupplier.website,
        contact_name:
          updatedSupplier.contact_name,
        is_active:
          updatedSupplier.is_active,
      },
    });

  if (auditError) {
    console.error(
      "Fournisseur modifié, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json({
    message:
      "Le fournisseur a été modifié avec succès.",
    supplier:
      updatedSupplier,
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
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "La configuration du serveur est incomplète." },
      { status: 500 }
    );
  }

  const accessToken = getBearerToken(
    request.headers.get("authorization")
  );

  if (!accessToken) {
    return NextResponse.json(
      { error: "Vous devez être connecté." },
      { status: 401 }
    );
  }

  const requestSupabase = createRequestSupabase(accessToken);

  if (!requestSupabase) {
    return NextResponse.json(
      { error: "La configuration du serveur est incomplète." },
      { status: 500 }
    );
  }

  const {
    data: { user: currentUser },
    error: currentUserError,
  } = await requestSupabase.auth.getUser(accessToken);

  if (currentUserError || !currentUser) {
    return NextResponse.json(
      { error: "Votre session est invalide ou a expiré." },
      { status: 401 }
    );
  }

  const { data: profileData, error: profileError } =
    await requestSupabase
      .from("profiles")
      .select(`
        id,
        first_name,
        last_name,
        access_role
      `)
      .eq("id", currentUser.id)
      .single();

  if (profileError || !profileData) {
    return NextResponse.json(
      { error: "Impossible de vérifier vos autorisations." },
      { status: 403 }
    );
  }

  const profile = profileData as CurrentProfile;
  let canWrite = profile.access_role === "admin";

  if (!canWrite) {
    const { data: assignmentsData, error: assignmentsError } =
      await requestSupabase
        .from("profile_business_roles")
        .select(`
          business_roles!inner (
            code
          )
        `)
        .eq("profile_id", currentUser.id);

    if (assignmentsError) {
      return NextResponse.json(
        { error: "Impossible de vérifier vos autorisations." },
        { status: 403 }
      );
    }

    const roleCodes = (
      (assignmentsData ?? []) as BusinessRoleAssignment[]
    )
      .map(getBusinessRoleCode)
      .filter((code): code is string => Boolean(code))
      .map((code) => code.trim().toLowerCase());

    canWrite = roleCodes.some((code) =>
      SUPPLIER_WRITE_ROLES.includes(
        code as (typeof SUPPLIER_WRITE_ROLES)[number]
      )
    );
  }

  if (!canWrite) {
    return NextResponse.json(
      { error: "Vous n'êtes pas autorisé à supprimer un fournisseur." },
      { status: 403 }
    );
  }

  const { id: supplierId } = await context.params;

  if (!supplierId) {
    return NextResponse.json(
      { error: "Le fournisseur est invalide." },
      { status: 400 }
    );
  }

  const { data: supplier, error: supplierError } =
    await supabaseAdmin
      .from("medical_suppliers")
      .select("id, name, email")
      .eq("id", supplierId)
      .maybeSingle();

  if (supplierError) {
    console.error(
      "Impossible de vérifier le fournisseur avant suppression :",
      supplierError
    );

    return NextResponse.json(
      { error: "Impossible de vérifier ce fournisseur." },
      { status: 500 }
    );
  }

  if (!supplier) {
    return NextResponse.json(
      { error: "Fournisseur introuvable." },
      { status: 404 }
    );
  }

  const { count: referenceCount, error: referencesError } =
    await supabaseAdmin
      .from("medical_item_suppliers")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId);

  if (referencesError) {
    console.error(
      "Impossible de vérifier les références du fournisseur :",
      referencesError
    );

    return NextResponse.json(
      { error: "Impossible de vérifier les références de ce fournisseur." },
      { status: 500 }
    );
  }

  if ((referenceCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          `Impossible de supprimer ce fournisseur : ${referenceCount} ` +
          `${referenceCount === 1 ? "référence lui est encore associée" : "références lui sont encore associées"}. ` +
          "Supprimez d'abord ses références ou désactivez le fournisseur.",
      },
      { status: 409 }
    );
  }

  const actorName =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    currentUser.email ||
    "Utilisateur inconnu";

  // On écrit la trace avant la suppression afin de conserver l'identité
  // du fournisseur même après sa disparition de medical_suppliers.
  const { error: auditError } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      actor_id: currentUser.id,
      actor_name: actorName,
      actor_email: currentUser.email ?? null,
      action: "DELETE_MEDICAL_SUPPLIER",
      target_profile_id: null,
      target_name: supplier.name,
      target_email: supplier.email,
      module: "secourisme",
      details: {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        reference_count: referenceCount ?? 0,
      },
    });

  if (auditError) {
    console.error(
      "Suppression fournisseur annulée : audit impossible :",
      auditError
    );

    return NextResponse.json(
      {
        error:
          "La suppression a été annulée car la trace d'audit n'a pas pu être enregistrée.",
      },
      { status: 500 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("medical_suppliers")
    .delete()
    .eq("id", supplierId);

  if (deleteError) {
    console.error(
      "Impossible de supprimer le fournisseur :",
      deleteError
    );

    return NextResponse.json(
      { error: "Le fournisseur n'a pas pu être supprimé." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    deleted: true,
    message: "Le fournisseur a été supprimé avec succès.",
  });
}
