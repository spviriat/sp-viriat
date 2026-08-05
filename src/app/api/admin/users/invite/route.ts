import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";

type CreateUserPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  businessRoleIds?: number[];
};

type CurrentProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  access_role: string | null;
};

type CurrentBusinessRoleAssignment = {
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

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getBusinessRoleCode(
  assignment: CurrentBusinessRoleAssignment
): string | null {
  if (!assignment.business_roles) {
    return null;
  }

  if (Array.isArray(assignment.business_roles)) {
    return assignment.business_roles[0]?.code ?? null;
  }

  return assignment.business_roles.code;
}

/**
 * Génère un mot de passe provisoire fort.
 *
 * Exemple :
 * Vr8!Kp4@Qx7#Lm2
 *
 * Le mot de passe n'est jamais enregistré dans profiles
 * ni dans audit_logs.
 */
function generateTemporaryPassword() {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const specials = "!@#$%";
  const allCharacters = uppercase + lowercase + numbers + specials;

  const randomIndex = (max: number) => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);

    return values[0] % max;
  };

  const passwordCharacters = [
    uppercase[randomIndex(uppercase.length)],
    lowercase[randomIndex(lowercase.length)],
    numbers[randomIndex(numbers.length)],
    specials[randomIndex(specials.length)],
  ];

  while (passwordCharacters.length < 16) {
    passwordCharacters.push(
      allCharacters[randomIndex(allCharacters.length)]
    );
  }

  /*
   * Mélange les caractères.
   */
  for (let index = passwordCharacters.length - 1; index > 0; index--) {
    const randomPosition = randomIndex(index + 1);

    [
      passwordCharacters[index],
      passwordCharacters[randomPosition],
    ] = [
      passwordCharacters[randomPosition],
      passwordCharacters[index],
    ];
  }

  return passwordCharacters.join("");
}

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Configuration Supabase publique manquante.");

    return NextResponse.json(
      {
        error: "La configuration du serveur est incomplète.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * =====================================================
   * 1. Vérification de la session
   * =====================================================
   */

  const accessToken = getBearerToken(
    request.headers.get("authorization")
  );

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Vous devez être connecté pour effectuer cette action.",
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

  const {
    data: { user: currentUser },
    error: currentUserError,
  } = await requestSupabase.auth.getUser(accessToken);

  if (currentUserError || !currentUser) {
    return NextResponse.json(
      {
        error: "Votre session est invalide ou a expiré.",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * =====================================================
   * 2. Vérification des autorisations
   * =====================================================
   */

  const {
    data: currentProfile,
    error: currentProfileError,
  } = await requestSupabase
    .from("profiles")
    .select("id, first_name, last_name, access_role")
    .eq("id", currentUser.id)
    .single<CurrentProfile>();

  if (currentProfileError || !currentProfile) {
    console.error(
      "Impossible de récupérer le profil de l'utilisateur connecté :",
      currentProfileError
    );

    return NextResponse.json(
      {
        error: "Impossible de vérifier vos autorisations.",
      },
      {
        status: 403,
      }
    );
  }

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
      "Impossible de récupérer les rôles métier de l'utilisateur connecté :",
      currentBusinessRolesError
    );

    return NextResponse.json(
      {
        error: "Impossible de vérifier vos autorisations.",
      },
      {
        status: 403,
      }
    );
  }

  const currentRoleCodes = (
    (currentBusinessRoles ?? []) as CurrentBusinessRoleAssignment[]
  )
    .map(getBusinessRoleCode)
    .filter((code): code is string => Boolean(code));

  const canCreateUser =
    currentProfile.access_role === "admin" ||
    currentRoleCodes.includes("chef_centre") ||
    currentRoleCodes.includes("adjoint_chef_centre");

  if (!canCreateUser) {
    return NextResponse.json(
      {
        error: "Vous n'êtes pas autorisé à créer un utilisateur.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * =====================================================
   * 3. Lecture et validation des données
   * =====================================================
   */

  let payload: CreateUserPayload;

  try {
    payload = (await request.json()) as CreateUserPayload;
  } catch {
    return NextResponse.json(
      {
        error: "La requête envoyée est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const firstName = payload.firstName?.trim() ?? "";
  const lastName = payload.lastName?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";

  const businessRoleIds = Array.from(
    new Set(
      (payload.businessRoleIds ?? []).filter(
        (roleId): roleId is number =>
          Number.isInteger(roleId) && roleId > 0
      )
    )
  );

  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      {
        error:
          "Le prénom, le nom et l'adresse e-mail sont obligatoires.",
      },
      {
        status: 400,
      }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      {
        error: "L'adresse e-mail n'est pas valide.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =====================================================
   * 4. Vérification des rôles métier
   * =====================================================
   */

  if (businessRoleIds.length > 0) {
    const {
      data: validRoles,
      error: validRolesError,
    } = await supabaseAdmin
      .from("business_roles")
      .select("id")
      .in("id", businessRoleIds);

    if (validRolesError) {
      console.error(
        "Impossible de vérifier les rôles métier sélectionnés :",
        validRolesError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de vérifier les rôles métier sélectionnés.",
        },
        {
          status: 500,
        }
      );
    }

    if ((validRoles ?? []).length !== businessRoleIds.length) {
      return NextResponse.json(
        {
          error: "Un ou plusieurs rôles métier sont invalides.",
        },
        {
          status: 400,
        }
      );
    }
  }

  /*
   * =====================================================
   * 5. Génération du mot de passe provisoire
   * =====================================================
   */

  const temporaryPassword = generateTemporaryPassword();

  /*
   * =====================================================
   * 6. Création du compte Supabase Auth
   * =====================================================
   *
   * email_confirm = true :
   * l'utilisateur peut se connecter immédiatement sans
   * avoir besoin d'un e-mail de confirmation.
   */

  const {
    data: createdAuthUser,
    error: authCreationError,
  } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,

    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (authCreationError || !createdAuthUser.user) {
    console.error(
      "Erreur lors de la création du compte Supabase :",
      authCreationError
    );

    const normalizedMessage =
      authCreationError?.message.toLowerCase() ?? "";

    if (
      normalizedMessage.includes("already") ||
      normalizedMessage.includes("registered") ||
      normalizedMessage.includes("exists")
    ) {
      return NextResponse.json(
        {
          error: "Cette adresse e-mail est déjà utilisée.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Le compte utilisateur n'a pas pu être créé.",
      },
      {
        status: 500,
      }
    );
  }

  const createdUserId = createdAuthUser.user.id;

  /*
   * Fonction de nettoyage si une étape suivante échoue.
   */

  async function rollbackCreatedUser() {
    const { error } =
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);

    if (error) {
      console.error(
        "Impossible d'annuler la création du compte Auth :",
        error
      );
    }
  }

  /*
   * =====================================================
   * 7. Création du profil
   * =====================================================
   *
   * temporary_password :
   * indique à l'application que l'utilisateur doit
   * obligatoirement personnaliser son mot de passe.
   */

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: createdUserId,
        first_name: firstName,
        last_name: lastName,
        access_role: "user",
        status: "temporary_password",
      },
      {
        onConflict: "id",
      }
    );

  if (profileError) {
    console.error(
      "Erreur lors de la création du profil utilisateur :",
      profileError
    );

    await rollbackCreatedUser();

    return NextResponse.json(
      {
        error:
          "Le compte a été créé, mais le profil utilisateur n'a pas pu être enregistré.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * =====================================================
   * 8. Attribution des rôles métier
   * =====================================================
   */

  if (businessRoleIds.length > 0) {
    const roleAssignments = businessRoleIds.map(
      (businessRoleId) => ({
        profile_id: createdUserId,
        business_role_id: businessRoleId,
      })
    );

    const {
      error: roleAssignmentsError,
    } = await supabaseAdmin
      .from("profile_business_roles")
      .insert(roleAssignments);

    if (roleAssignmentsError) {
      console.error(
        "Erreur lors de l'attribution des rôles métier :",
        roleAssignmentsError
      );

      await supabaseAdmin
        .from("profile_business_roles")
        .delete()
        .eq("profile_id", createdUserId);

      await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", createdUserId);

      await rollbackCreatedUser();

      return NextResponse.json(
        {
          error:
            "Le compte a été créé, mais les rôles métier n'ont pas pu être enregistrés.",
        },
        {
          status: 500,
        }
      );
    }
  }

  /*
   * =====================================================
   * 9. Journal d'audit
   * =====================================================
   */

  const actorName =
    `${currentProfile.first_name ?? ""} ${
      currentProfile.last_name ?? ""
    }`.trim() ||
    currentUser.email ||
    "Utilisateur inconnu";

  const targetName = `${firstName} ${lastName}`.trim();

  const { error: auditError } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      actor_id: currentUser.id,
      actor_name: actorName,
      actor_email: currentUser.email ?? null,

      action: "CREATE_USER",

      target_profile_id: createdUserId,
      target_name: targetName,
      target_email: email,

      module: "users",

      /*
       * IMPORTANT :
       * le mot de passe provisoire n'est JAMAIS enregistré
       * dans le journal d'audit.
       */
      details: {
        access_role: "user",
        status: "temporary_password",
        business_role_ids: businessRoleIds,
        creation_mode: "temporary_password",
      },
    });

  if (auditError) {
    /*
     * On ne supprime pas l'utilisateur si seul
     * l'enregistrement de l'audit échoue.
     */
    console.error(
      "L'utilisateur a été créé, mais l'audit n'a pas pu être enregistré :",
      auditError
    );
  }

  /*
   * =====================================================
   * 10. Réponse
   * =====================================================
   *
   * Le mot de passe provisoire est retourné uniquement ici.
   * Il n'est conservé ni dans profiles ni dans audit_logs.
   */

  return NextResponse.json(
    {
      message: "Utilisateur créé avec succès.",

      user: {
        id: createdUserId,
        first_name: firstName,
        last_name: lastName,
        email,
        access_role: "user",
        status: "temporary_password",
        business_role_ids: businessRoleIds,
      },

      temporaryPassword,
    },
    {
      status: 201,
    }
  );
}