import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const USER_MANAGEMENT_ROLES = [
  "chef_centre",
  "adjoint_chef_centre",
] as const;

type AccessRole = "user" | "admin";

type UpdateUserPayload = {
  userId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  matricule?: unknown;
  grade?: unknown;
  phone?: unknown;
  accessRole?: unknown;
  businessRoleIds?: unknown;
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
  matricule: string | null;
  grade: string | null;
  phone: string | null;
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

type ExistingRoleAssignment = {
  business_role_id: number;
};

/*
 * =========================================================
 * Bearer token
 * =========================================================
 */

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

/*
 * =========================================================
 * Client Supabase associé à la requête
 * =========================================================
 */

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
          Authorization: `Bearer ${accessToken}`,
        },
      },

      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/*
 * =========================================================
 * Extraction du code d'un rôle métier
 * =========================================================
 */

function getBusinessRoleCode(
  assignment: BusinessRoleAssignment
): string | null {
  if (!assignment.business_roles) {
    return null;
  }

  if (Array.isArray(assignment.business_roles)) {
    return (
      assignment.business_roles[0]?.code ??
      null
    );
  }

  return assignment.business_roles.code;
}

/*
 * =========================================================
 * Normalisation d'un champ texte optionnel
 * =========================================================
 */

function normalizeNullableString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

/*
 * =========================================================
 * Vérification des droits
 * =========================================================
 *
 * Autorisés :
 *
 * - admin
 * - chef_centre
 * - adjoint_chef_centre
 */

async function getUserManagementPermission(
  requestSupabase: SupabaseClient<any>,
  currentUserId: string
) {
  const {
    data: currentProfile,
    error: currentProfileError,
  } = await requestSupabase
    .from("profiles")
    .select(
      "id, first_name, last_name, access_role"
    )
    .eq("id", currentUserId)
    .single();

  if (
    currentProfileError ||
    !currentProfile
  ) {
    console.error(
      "Impossible de récupérer le profil de l'ayant droit :",
      currentProfileError
    );

    return {
      allowed: false,
      isAdmin: false,
      profile: null as CurrentProfile | null,
      businessRoleCodes: [] as string[],
    };
  }

  const typedCurrentProfile =
    currentProfile as CurrentProfile;

  /*
   * Un administrateur possède tous les droits
   * de cette route.
   */

  if (
    typedCurrentProfile.access_role ===
    "admin"
  ) {
    return {
      allowed: true,
      isAdmin: true,
      profile: typedCurrentProfile,
      businessRoleCodes: [] as string[],
    };
  }

  /*
   * Sinon, recherche des rôles métier.
   */

  const {
    data: assignments,
    error: assignmentsError,
  } = await requestSupabase
    .from("profile_business_roles")
    .select(`
      business_roles!inner (
        code
      )
    `)
    .eq("profile_id", currentUserId);

  if (assignmentsError) {
    console.error(
      "Impossible de récupérer les rôles métier de l'ayant droit :",
      assignmentsError
    );

    return {
      allowed: false,
      isAdmin: false,
      profile: typedCurrentProfile,
      businessRoleCodes: [] as string[],
    };
  }

  const businessRoleCodes = (
    (assignments ?? []) as BusinessRoleAssignment[]
  )
    .map(getBusinessRoleCode)
    .filter(
      (code): code is string =>
        Boolean(code)
    );

  const allowed =
    businessRoleCodes.some((code) =>
      USER_MANAGEMENT_ROLES.includes(
        code as (typeof USER_MANAGEMENT_ROLES)[number]
      )
    );

  return {
    allowed,
    isAdmin: false,
    profile: typedCurrentProfile,
    businessRoleCodes,
  };
}

/*
 * =========================================================
 * POST
 * =========================================================
 *
 * Modification d'un utilisateur.
 */

export async function POST(
  request: Request
) {
  /*
   * =====================================================
   * 1. Configuration
   * =====================================================
   */

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

  /*
   * =====================================================
   * 2. Token
   * =====================================================
   */

  const accessToken = getBearerToken(
    request.headers.get("authorization")
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
          "La configuration du serveur est incomplète.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * =====================================================
   * 3. Session utilisateur
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
   * 4. Autorisations
   * =====================================================
   */

  const permission =
    await getUserManagementPermission(
      requestSupabase,
      currentUser.id
    );

  if (
    !permission.allowed ||
    !permission.profile
  ) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à modifier un utilisateur.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * =====================================================
   * 5. Lecture du payload
   * =====================================================
   */

  let payload: UpdateUserPayload;

  try {
    payload =
      (await request.json()) as UpdateUserPayload;
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
   * 6. Validation des données
   * =====================================================
   */

  const userId =
    typeof payload.userId === "string"
      ? payload.userId.trim()
      : "";

  const firstName =
    typeof payload.firstName === "string"
      ? payload.firstName.trim()
      : "";

  const lastName =
    typeof payload.lastName === "string"
      ? payload.lastName.trim()
      : "";

  const matricule =
    normalizeNullableString(
      payload.matricule
    );

  const grade =
    normalizeNullableString(
      payload.grade
    );

  const phone =
    normalizeNullableString(
      payload.phone
    );

  const accessRole =
    payload.accessRole === "admin" ||
    payload.accessRole === "user"
      ? (payload.accessRole as AccessRole)
      : null;

  if (!userId) {
    return NextResponse.json(
      {
        error:
          "L'utilisateur à modifier est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  if (!firstName || !lastName) {
    return NextResponse.json(
      {
        error:
          "Le prénom et le nom sont obligatoires.",
      },
      {
        status: 400,
      }
    );
  }

  if (!accessRole) {
    return NextResponse.json(
      {
        error:
          "Le niveau d'accès est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !Array.isArray(
      payload.businessRoleIds
    )
  ) {
    return NextResponse.json(
      {
        error:
          "La liste des rôles métier est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * On n'accepte que des IDs numériques entiers positifs.
   */

  const businessRoleIds =
    payload.businessRoleIds.filter(
      (roleId): roleId is number =>
        typeof roleId === "number" &&
        Number.isInteger(roleId) &&
        roleId > 0
    );

  if (
    businessRoleIds.length !==
    payload.businessRoleIds.length
  ) {
    return NextResponse.json(
      {
        error:
          "Un ou plusieurs rôles métier sont invalides.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Suppression des éventuels doublons.
   */

  const uniqueBusinessRoleIds = [
    ...new Set(businessRoleIds),
  ];

  /*
   * =====================================================
   * 7. Profil cible
   * =====================================================
   */

  const {
    data: targetProfileData,
    error: targetProfileError,
  } = await supabaseAdmin
    .from("profiles")
    .select(`
      id,
      first_name,
      last_name,
      matricule,
      grade,
      phone,
      access_role,
      status
    `)
    .eq("id", userId)
    .single();

  if (
    targetProfileError ||
    !targetProfileData
  ) {
    console.error(
      "Impossible de récupérer le profil cible :",
      targetProfileError
    );

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

  const targetProfile =
    targetProfileData as TargetProfile;

  /*
   * =====================================================
   * 8. Protections des administrateurs
   * =====================================================
   *
   * Un chef de centre ou un adjoint :
   *
   * - ne peut PAS modifier un administrateur
   * - ne peut PAS créer/promouvoir un administrateur
   */

  if (!permission.isAdmin) {
    if (
      targetProfile.access_role ===
      "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "Vous ne pouvez pas modifier un administrateur.",
        },
        {
          status: 403,
        }
      );
    }

    if (accessRole === "admin") {
      return NextResponse.json(
        {
          error:
            "Vous n'êtes pas autorisé à attribuer les droits administrateur.",
        },
        {
          status: 403,
        }
      );
    }
  }

  /*
   * =====================================================
   * 9. Protection de son propre compte
   * =====================================================
   *
   * On évite qu'un administrateur se retire lui-même
   * ses droits depuis cette interface.
   */

  if (
    userId === currentUser.id &&
    targetProfile.access_role === "admin" &&
    accessRole !== "admin"
  ) {
    return NextResponse.json(
      {
        error:
          "Vous ne pouvez pas retirer vos propres droits administrateur.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * =====================================================
   * 10. Validation des IDs de rôles métier
   * =====================================================
   *
   * On vérifie côté serveur que tous les IDs existent
   * réellement dans business_roles.
   */

  if (
    uniqueBusinessRoleIds.length > 0
  ) {
    const {
      data: validRoles,
      error: validRolesError,
    } = await supabaseAdmin
      .from("business_roles")
      .select("id")
      .in(
        "id",
        uniqueBusinessRoleIds
      );

    if (validRolesError) {
      console.error(
        "Impossible de vérifier les rôles métier :",
        validRolesError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de vérifier les rôles métier.",
        },
        {
          status: 500,
        }
      );
    }

    const validRoleIds = new Set(
      (validRoles ?? []).map(
        (role) => role.id
      )
    );

    const allRolesExist =
      uniqueBusinessRoleIds.every(
        (roleId) =>
          validRoleIds.has(roleId)
      );

    if (!allRolesExist) {
      return NextResponse.json(
        {
          error:
            "Un ou plusieurs rôles métier n'existent pas.",
        },
        {
          status: 400,
        }
      );
    }
  }

  /*
   * =====================================================
   * 11. Rôles métier actuels
   * =====================================================
   */

  const {
    data: existingAssignmentsData,
    error: existingAssignmentsError,
  } = await supabaseAdmin
    .from("profile_business_roles")
    .select("business_role_id")
    .eq("profile_id", userId);

  if (existingAssignmentsError) {
    console.error(
      "Impossible de récupérer les rôles actuels :",
      existingAssignmentsError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer les rôles métier actuels.",
      },
      {
        status: 500,
      }
    );
  }

  const existingAssignments =
    (existingAssignmentsData ??
      []) as ExistingRoleAssignment[];

  const previousBusinessRoleIds =
    existingAssignments.map(
      (assignment) =>
        assignment.business_role_id
    );

  /*
   * =====================================================
   * 12. Modification du profil
   * =====================================================
   */

  const {
    data: updatedProfileData,
    error: updateProfileError,
  } = await supabaseAdmin
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      matricule,
      grade,
      phone,
      access_role: accessRole,
    })
    .eq("id", userId)
    .select(`
      id,
      first_name,
      last_name,
      matricule,
      grade,
      phone,
      role,
      access_role,
      status
    `)
    .single();

  if (
    updateProfileError ||
    !updatedProfileData
  ) {
    console.error(
      "Impossible de modifier le profil :",
      updateProfileError
    );

    return NextResponse.json(
      {
        error:
          "Les informations de l'utilisateur n'ont pas pu être modifiées.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * =====================================================
   * 13. Synchronisation des rôles métier
   * =====================================================
   */

  const roleIdsToDelete =
    previousBusinessRoleIds.filter(
      (roleId) =>
        !uniqueBusinessRoleIds.includes(
          roleId
        )
    );

  const roleIdsToAdd =
    uniqueBusinessRoleIds.filter(
      (roleId) =>
        !previousBusinessRoleIds.includes(
          roleId
        )
    );

  /*
   * Suppression des rôles retirés.
   */

  if (roleIdsToDelete.length > 0) {
    const {
      error: deleteRolesError,
    } = await supabaseAdmin
      .from("profile_business_roles")
      .delete()
      .eq("profile_id", userId)
      .in(
        "business_role_id",
        roleIdsToDelete
      );

    if (deleteRolesError) {
      console.error(
        "Impossible de supprimer certains rôles métier :",
        deleteRolesError
      );

      return NextResponse.json(
        {
          error:
            "Le profil a été modifié, mais certains rôles métier n'ont pas pu être retirés.",
        },
        {
          status: 500,
        }
      );
    }
  }

  /*
   * Ajout des nouveaux rôles.
   */

  if (roleIdsToAdd.length > 0) {
    const {
      error: insertRolesError,
    } = await supabaseAdmin
      .from("profile_business_roles")
      .insert(
        roleIdsToAdd.map(
          (businessRoleId) => ({
            profile_id: userId,
            business_role_id:
              businessRoleId,
          })
        )
      );

    if (insertRolesError) {
      console.error(
        "Impossible d'ajouter certains rôles métier :",
        insertRolesError
      );

      return NextResponse.json(
        {
          error:
            "Le profil a été modifié, mais certains rôles métier n'ont pas pu être ajoutés.",
        },
        {
          status: 500,
        }
      );
    }
  }

  /*
   * =====================================================
   * 14. Lecture des rôles enregistrés
   * =====================================================
   */

  const {
    data: savedAssignments,
    error: savedAssignmentsError,
  } = await supabaseAdmin
    .from("profile_business_roles")
    .select(`
      business_roles!inner (
        id,
        code,
        label
      )
    `)
    .eq("profile_id", userId);

  if (savedAssignmentsError) {
    console.error(
      "Impossible de relire les rôles enregistrés :",
      savedAssignmentsError
    );
  }

  /*
   * =====================================================
   * 15. Journal d'audit
   * =====================================================
   */

  const actorName =
    `${permission.profile.first_name ?? ""} ${
      permission.profile.last_name ?? ""
    }`.trim() ||
    currentUser.email ||
    "Utilisateur inconnu";

  const previousTargetName =
    `${targetProfile.first_name ?? ""} ${
      targetProfile.last_name ?? ""
    }`.trim() ||
    "Utilisateur inconnu";

  const newTargetName =
    `${firstName} ${lastName}`.trim();

  /*
   * On récupère l'e-mail uniquement pour le journal.
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
      "Impossible de récupérer l'e-mail cible pour l'audit :",
      targetAuthError
    );
  }

  const targetEmail =
    targetAuthData?.user?.email ?? null;

  const { error: auditError } =
    await supabaseAdmin
      .from("audit_logs")
      .insert({
        actor_id:
          currentUser.id,

        actor_name:
          actorName,

        actor_email:
          currentUser.email ?? null,

        action:
          "UPDATE_USER",

        target_profile_id:
          userId,

        target_name:
          newTargetName,

        target_email:
          targetEmail,

        module:
          "users",

        details: {
          previous: {
            name:
              previousTargetName,

            first_name:
              targetProfile.first_name,

            last_name:
              targetProfile.last_name,

            matricule:
              targetProfile.matricule,

            grade:
              targetProfile.grade,

            phone:
              targetProfile.phone,

            access_role:
              targetProfile.access_role,

            business_role_ids:
              previousBusinessRoleIds,
          },

          new: {
            name:
              newTargetName,

            first_name:
              firstName,

            last_name:
              lastName,

            matricule,

            grade,

            phone,

            access_role:
              accessRole,

            business_role_ids:
              uniqueBusinessRoleIds,
          },
        },
      });

  if (auditError) {
    /*
     * La modification est déjà effectuée.
     * L'échec du journal ne doit donc pas
     * faire croire que la modification a échoué.
     */

    console.error(
      "Utilisateur modifié, mais audit UPDATE_USER impossible :",
      auditError
    );
  }

  /*
   * =====================================================
   * 16. Construction des rôles pour la réponse
   * =====================================================
   */

  const businessRoles =
    (savedAssignments ?? [])
      .flatMap((assignment) => {
        const role =
          assignment.business_roles as
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

        if (!role) {
          return [];
        }

        return Array.isArray(role)
          ? role
          : [role];
      });

  /*
   * =====================================================
   * 17. Réponse
   * =====================================================
   */

  return NextResponse.json({
    message:
      "L'utilisateur a été modifié avec succès.",

    user: {
      ...updatedProfileData,
      business_roles:
        businessRoles,
    },
  });
}