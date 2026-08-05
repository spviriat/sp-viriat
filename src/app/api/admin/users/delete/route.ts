import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";

type DeleteUserPayload = {
  userId?: string;
};

type CurrentProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  access_role: string | null;
};

type TargetProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  access_role: string | null;
  status: string | null;
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const DELETE_USER_ROLES = [
  "chef_centre",
  "adjoint_chef_centre",
];

function getBearerToken(
  authorizationHeader: string | null
) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader
    .slice("Bearer ".length)
    .trim();
}

function getBusinessRoleCode(
  assignment: BusinessRoleAssignment
): string | null {
  if (!assignment.business_roles) {
    return null;
  }

  if (Array.isArray(assignment.business_roles)) {
    return assignment.business_roles[0]?.code ?? null;
  }

  return assignment.business_roles.code;
}

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
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

  const accessToken = getBearerToken(
    request.headers.get("authorization")
  );

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Vous devez être connecté.",
      },
      {
        status: 401,
      }
    );
  }

  const requestSupabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  /*
   * =====================================================
   * 1. Vérification de l'utilisateur connecté
   * =====================================================
   */

  const {
    data: { user: currentUser },
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

  /*
   * =====================================================
   * 2. Récupération du profil de l'ayant droit
   * =====================================================
   */

  const {
    data: currentProfile,
    error: currentProfileError,
  } = await requestSupabase
    .from("profiles")
    .select(
      "id, first_name, last_name, access_role"
    )
    .eq("id", currentUser.id)
    .single<CurrentProfile>();

  if (
    currentProfileError ||
    !currentProfile
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

  /*
   * =====================================================
   * 3. Vérification des droits
   * =====================================================
   *
   * Autorisés :
   * - admin
   * - chef_centre
   * - adjoint_chef_centre
   */

  const isAdmin =
    currentProfile.access_role === "admin";

  let hasAllowedBusinessRole = false;

  if (!isAdmin) {
    const {
      data: currentBusinessRoles,
      error: currentBusinessRolesError,
    } = await requestSupabase
      .from("profile_business_roles")
      .select(`
        business_roles!inner (
          code
        )
      `)
      .eq("profile_id", currentUser.id);

    if (currentBusinessRolesError) {
      console.error(
        "Impossible de récupérer les rôles métier de l'ayant droit :",
        currentBusinessRolesError
      );

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
      (currentBusinessRoles ?? []) as BusinessRoleAssignment[]
    )
      .map(getBusinessRoleCode)
      .filter(
        (code): code is string =>
          Boolean(code)
      );

    hasAllowedBusinessRole =
      roleCodes.some((code) =>
        DELETE_USER_ROLES.includes(code)
      );
  }

  if (!isAdmin && !hasAllowedBusinessRole) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à supprimer un utilisateur.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * =====================================================
   * 4. Lecture de la requête
   * =====================================================
   */

  let payload: DeleteUserPayload;

  try {
    payload =
      (await request.json()) as DeleteUserPayload;
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

  const userId =
    payload.userId?.trim();

  if (!userId) {
    return NextResponse.json(
      {
        error:
          "L'utilisateur à supprimer est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =====================================================
   * 5. Interdiction de supprimer son propre compte
   * =====================================================
   */

  if (userId === currentUser.id) {
    return NextResponse.json(
      {
        error:
          "Vous ne pouvez pas supprimer votre propre compte.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =====================================================
   * 6. Récupération du profil cible
   * =====================================================
   */

  const {
    data: targetProfile,
    error: targetProfileError,
  } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, first_name, last_name, access_role, status"
    )
    .eq("id", userId)
    .single<TargetProfile>();

  if (
    targetProfileError ||
    !targetProfile
  ) {
    return NextResponse.json(
      {
        error:
          "Cet utilisateur est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * =====================================================
   * 7. Protection des administrateurs
   * =====================================================
   *
   * Un chef de centre ou adjoint ne peut jamais
   * supprimer un administrateur.
   */

  if (
    !isAdmin &&
    targetProfile.access_role === "admin"
  ) {
    return NextResponse.json(
      {
        error:
          "Seul un administrateur peut supprimer un autre administrateur.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * =====================================================
   * 8. Récupération de l'adresse e-mail Auth
   * =====================================================
   */

  const {
    data: targetAuthData,
    error: targetAuthError,
  } =
    await supabaseAdmin.auth.admin.getUserById(
      userId
    );

  if (targetAuthError) {
    console.error(
      "Impossible de récupérer le compte Auth cible :",
      targetAuthError
    );
  }

  const targetEmail =
    targetAuthData?.user?.email ?? null;

  /*
   * =====================================================
   * 9. Récupération des rôles pour l'audit
   * =====================================================
   */

  const {
    data: roleAssignments,
    error: roleAssignmentsReadError,
  } = await supabaseAdmin
    .from("profile_business_roles")
    .select("business_role_id")
    .eq("profile_id", userId);

  if (roleAssignmentsReadError) {
    console.error(
      "Impossible de lire les rôles de l'utilisateur :",
      roleAssignmentsReadError
    );
  }

  const businessRoleIds =
    roleAssignments?.map(
      (assignment) =>
        assignment.business_role_id
    ) ?? [];

  const targetName =
    `${targetProfile.first_name ?? ""} ${
      targetProfile.last_name ?? ""
    }`.trim() ||
    "Utilisateur inconnu";

  const actorName =
    `${currentProfile.first_name ?? ""} ${
      currentProfile.last_name ?? ""
    }`.trim() ||
    currentUser.email ||
    "Utilisateur";

  /*
   * =====================================================
   * 10. Suppression du compte Auth
   * =====================================================
   */

  const { error: authDeleteError } =
    await supabaseAdmin.auth.admin.deleteUser(
      userId
    );

  if (authDeleteError) {
    console.error(
      "Erreur suppression Auth :",
      authDeleteError
    );

    return NextResponse.json(
      {
        error:
          "Le compte d'authentification n'a pas pu être supprimé.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * =====================================================
   * 11. Suppression du profil
   * =====================================================
   *
   * profile_business_roles possède ON DELETE CASCADE.
   */

  const {
    error: profileDeleteError,
  } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileDeleteError) {
    console.error(
      "Erreur suppression profil :",
      profileDeleteError
    );

    return NextResponse.json(
      {
        error:
          "Le compte Auth a été supprimé, mais le profil n'a pas pu être supprimé.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * =====================================================
   * 12. Journal d'audit
   * =====================================================
   */

  const { error: auditError } =
    await supabaseAdmin
      .from("audit_logs")
      .insert({
        actor_id: currentUser.id,
        actor_name: actorName,
        actor_email:
          currentUser.email ?? null,

        action: "DELETE_USER",

        target_profile_id:
          userId,

        target_name:
          targetName,

        target_email:
          targetEmail,

        module: "users",

        details: {
          previous_access_role:
            targetProfile.access_role,

          previous_status:
            targetProfile.status,

          business_role_ids:
            businessRoleIds,

          actor_access_role:
            currentProfile.access_role,

          actor_is_admin:
            isAdmin,
        },
      });

  if (auditError) {
    console.error(
      "Utilisateur supprimé, mais audit impossible :",
      auditError
    );
  }

  /*
   * =====================================================
   * 13. Réponse
   * =====================================================
   */

  return NextResponse.json({
    message:
      "Utilisateur supprimé définitivement.",

    deletedUserId:
      userId,
  });
}