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
   * 10. Vérification de la dotation habillement
   * =====================================================
   *
   * Si l'utilisateur possède encore des vêtements :
   * - on bloque immédiatement son accès ;
   * - on crée son dossier de restitution ;
   * - on conserve son profil et son compte Auth ;
   * - la suppression définitive sera déclenchée après
   *   validation de la dernière restitution.
   */

  const {
    count: clothingAssignmentCount,
    error: clothingAssignmentError,
  } = await supabaseAdmin
    .from("clothing_assignments")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("profile_id", userId)
    .gt("quantity", 0);

  if (clothingAssignmentError) {
    console.error(
      "Impossible de vérifier la dotation habillement :",
      clothingAssignmentError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier la dotation habillement de l'utilisateur.",
      },
      {
        status: 500,
      }
    );
  }

  const hasClothing =
    (clothingAssignmentCount ?? 0) > 0;

  /*
   * =====================================================
   * 11. Départ avec restitution habillement
   * =====================================================
   */

  if (hasClothing) {
    /*
     * On archive d'abord le profil.
     * Le DashboardShell / les contrôles d'accès existants
     * doivent refuser l'accès aux profils archivés.
     */

    const {
      error: archiveError,
    } = await supabaseAdmin
      .from("profiles")
      .update({
        status: "archived",
      })
      .eq("id", userId);

    if (archiveError) {
      console.error(
        "Impossible d'archiver le profil :",
        archiveError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de bloquer l'accès de l'utilisateur.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Blocage Auth supplémentaire.
     *
     * ban_duration = "876000h" correspond à une durée
     * volontairement très longue. Le compte n'est pas
     * supprimé : il reste disponible jusqu'à la fin de
     * la restitution.
     */

    const {
      error: authBlockError,
    } =
      await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          ban_duration: "876000h",
        }
      );

    if (authBlockError) {
      console.error(
        "Impossible de bloquer le compte Auth :",
        authBlockError
      );

      /*
       * On tente de revenir à l'état précédent afin de ne
       * pas laisser un profil archivé avec un compte Auth
       * encore utilisable.
       */
      await supabaseAdmin
        .from("profiles")
        .update({
          status:
            targetProfile.status ?? "active",
        })
        .eq("id", userId);

      return NextResponse.json(
        {
          error:
            "Le départ n'a pas pu être lancé car le compte d'authentification n'a pas pu être bloqué.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Création du dossier + copie de la dotation actuelle.
     * La fonction SQL est idempotente : si un dossier
     * existe déjà, elle renvoie simplement son identifiant.
     */

    const {
      data: returnId,
      error: returnError,
    } = await supabaseAdmin.rpc(
      "create_clothing_return",
      {
        target_profile_id: userId,
      }
    );

    if (returnError) {
      console.error(
        "Impossible de créer la restitution habillement :",
        returnError
      );

      /*
       * On débloque le compte et on restaure le statut
       * puisqu'on n'a pas réussi à créer le dossier.
       */
      await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          ban_duration: "none",
        }
      );

      await supabaseAdmin
        .from("profiles")
        .update({
          status:
            targetProfile.status ?? "active",
        })
        .eq("id", userId);

      return NextResponse.json(
        {
          error:
            "Impossible de créer le dossier de restitution habillement.",
          supabaseError: {
            message: returnError.message ?? null,
            details: returnError.details ?? null,
            hint: returnError.hint ?? null,
            code: returnError.code ?? null,
          },
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Journal d'audit du départ.
     */

    const { error: auditError } =
      await supabaseAdmin
        .from("audit_logs")
        .insert({
          actor_id: currentUser.id,
          actor_name: actorName,
          actor_email:
            currentUser.email ?? null,

          action:
            "START_USER_DEPARTURE",

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

            clothing_assignment_count:
              clothingAssignmentCount ?? 0,

            clothing_return_id:
              returnId,
          },
        });

    if (auditError) {
      console.error(
        "Départ lancé, mais audit impossible :",
        auditError
      );
    }

    return NextResponse.json({
      message:
        "Accès utilisateur bloqué. La suppression définitive sera effectuée automatiquement après validation de la restitution habillement.",

      departurePending: true,

      clothingReturnId:
        returnId,

      clothingAssignmentCount:
        clothingAssignmentCount ?? 0,

      userId,
    });
  }

  /*
   * =====================================================
   * 12. Aucun vêtement : suppression immédiate
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
   * Selon la configuration Supabase, la suppression Auth
   * peut déjà avoir supprimé le profil via cascade.
   * On tente donc uniquement de supprimer un profil encore
   * présent.
   */

  const {
    data: remainingProfile,
    error: remainingProfileReadError,
  } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (remainingProfileReadError) {
    console.error(
      "Impossible de vérifier le profil après suppression Auth :",
      remainingProfileReadError
    );
  }

  if (remainingProfile) {
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
  }

  /*
   * =====================================================
   * 13. Journal d'audit
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

          clothing_assignment_count: 0,
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
   * 14. Réponse
   * =====================================================
   */

  return NextResponse.json({
    message:
      "Utilisateur supprimé définitivement.",

    departurePending: false,

    deletedUserId:
      userId,
  });
}