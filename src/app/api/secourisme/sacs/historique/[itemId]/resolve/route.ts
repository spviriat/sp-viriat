import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type BusinessRoleAssignment = {
  business_roles:
    | { code: string }
    | { code: string }[]
    | null;
};

type ResolveBody = {
  comment?: string;
};

function getBearerToken(
  authorizationHeader: string | null
) {
  if (
    !authorizationHeader?.startsWith("Bearer ")
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
  if (!supabaseUrl || !supabaseAnonKey) {
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

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      itemId: string;
    }>;
  }
) {
  const { itemId } =
    await context.params;

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
    createRequestSupabase(accessToken);

  if (!requestSupabase) {
    return NextResponse.json(
      {
        error:
          "Configuration serveur incomplète.",
      },
      {
        status: 500,
      }
    );
  }

  const {
    data: { user },
    error: userError,
  } =
    await requestSupabase.auth.getUser(
      accessToken
    );

  if (userError || !user) {
    return NextResponse.json(
      {
        error:
          "Session invalide ou expirée.",
      },
      {
        status: 401,
      }
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await requestSupabase
    .from("profiles")
    .select(
      "id, first_name, last_name, access_role"
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      {
        error:
          "Profil utilisateur introuvable.",
      },
      {
        status: 403,
      }
    );
  }

  let canResolve =
    profile.access_role === "admin";

  if (!canResolve) {
    const {
      data: assignments,
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
        user.id
      );

    if (assignmentsError) {
      return NextResponse.json(
        {
          error:
            "Impossible de vérifier vos droits.",
        },
        {
          status: 403,
        }
      );
    }

    const roleCodes = (
      (assignments ?? []) as
        BusinessRoleAssignment[]
    )
      .map(getBusinessRoleCode)
      .filter(
        (code): code is string =>
          Boolean(code)
      )
      .map((code) =>
        code
          .trim()
          .toLowerCase()
      );

    canResolve =
      roleCodes.includes(
        "responsable_pharmacie"
      );
  }

  if (!canResolve) {
    return NextResponse.json(
      {
        error:
          "Seul le responsable pharmacie peut clôturer une anomalie.",
      },
      {
        status: 403,
      }
    );
  }

  let body: ResolveBody = {};

  try {
    body =
      (await request.json()) as
        ResolveBody;
  } catch {
    body = {};
  }

  const comment =
    body.comment?.trim() || null;

  const {
    data: currentItem,
    error: currentItemError,
  } = await supabaseAdmin
    .from(
      "rescue_bag_check_items"
    )
    .select(`
      id,
      status,
      anomaly_resolution_status,
      resolved_at,
      resolved_by_name
    `)
    .eq("id", itemId)
    .single();

  if (
    currentItemError ||
    !currentItem
  ) {
    return NextResponse.json(
      {
        error:
          "Anomalie introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    currentItem.status === "ok"
  ) {
    return NextResponse.json(
      {
        error:
          "Cet article ne correspond pas à une anomalie.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    currentItem
      .anomaly_resolution_status !==
    "to_treat"
  ) {
    return NextResponse.json(
      {
        error:
          "Cette anomalie n'est plus à traiter.",
      },
      {
        status: 409,
      }
    );
  }

  const fullName = [
    profile.first_name,
    profile.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const resolvedByName =
    fullName || "Responsable pharmacie";

  const resolvedAt =
    new Date().toISOString();

  const {
    data: updatedItem,
    error: updateError,
  } = await supabaseAdmin
    .from(
      "rescue_bag_check_items"
    )
    .update({
      anomaly_resolution_status:
        "resolved_later",
      resolved_at: resolvedAt,
      resolved_by: user.id,
      resolved_by_name:
        resolvedByName,
      resolution_comment:
        comment,
    })
    .eq("id", itemId)
    .eq(
      "anomaly_resolution_status",
      "to_treat"
    )
    .select(`
      id,
      anomaly_resolution_status,
      resolved_at,
      resolved_by,
      resolved_by_name,
      resolution_comment
    `)
    .single();

  if (
    updateError ||
    !updatedItem
  ) {
    console.error(
      "Erreur résolution anomalie sac :",
      updateError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de clôturer cette anomalie.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    message:
      "Anomalie marquée comme résolue.",
    item: {
      id: updatedItem.id,
      resolutionStatus:
        updatedItem
          .anomaly_resolution_status,
      resolvedAt:
        updatedItem.resolved_at,
      resolvedBy:
        updatedItem.resolved_by,
      resolvedByName:
        updatedItem
          .resolved_by_name,
      resolutionComment:
        updatedItem
          .resolution_comment,
    },
  });
}