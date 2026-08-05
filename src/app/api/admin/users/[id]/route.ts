import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const EMAIL_MANAGEMENT_ROLES = [
  "chef_centre",
  "adjoint_chef_centre",
];

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

type TargetProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

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
        detectSessionInUrl: false,
      },
    }
  );
}

type RequestSupabaseClient = NonNullable<
  ReturnType<typeof createRequestSupabase>
>;

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

async function checkEmailManagementPermission(
  requestSupabase: RequestSupabaseClient,
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
    .single<CurrentProfile>();

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
      profile: null,
      roleCodes: [] as string[],
    };
  }

  if (
    currentProfile.access_role === "admin"
  ) {
    return {
      allowed: true,
      profile: currentProfile,
      roleCodes: [] as string[],
    };
  }

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
      profile: currentProfile,
      roleCodes: [] as string[],
    };
  }

  const roleCodes = (
    (assignments ?? []) as BusinessRoleAssignment[]
  )
    .map(getBusinessRoleCode)
    .filter(
      (code): code is string =>
        Boolean(code)
    );

  const allowed = roleCodes.some((code) =>
    EMAIL_MANAGEMENT_ROLES.includes(code)
  );

  return {
    allowed,
    profile: currentProfile,
    roleCodes,
  };
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
          "Configuration Supabase incomplète.",
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
          "Configuration Supabase incomplète.",
      },
      {
        status: 500,
      }
    );
  }

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
    console.error(
      "Session invalide dans GET /api/admin/users/[id] :",
      currentUserError
    );

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

  const permission =
    await checkEmailManagementPermission(
      requestSupabase,
      currentUser.id
    );

  if (!permission.allowed) {
    return NextResponse.json(
      {
        error: "Accès non autorisé.",
      },
      {
        status: 403,
      }
    );
  }

  const { id: targetUserId } =
    await context.params;

  const {
    data: targetAuthData,
    error: targetAuthError,
  } =
    await supabaseAdmin.auth.admin.getUserById(
      targetUserId
    );

  if (
    targetAuthError ||
    !targetAuthData.user
  ) {
    console.error(
      "Impossible de récupérer l'utilisateur Auth :",
      targetAuthError
    );

    return NextResponse.json(
      {
        error: "Utilisateur introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    user: {
      id: targetAuthData.user.id,
      email:
        targetAuthData.user.email ?? null,
    },
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
          "Configuration Supabase incomplète.",
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
          "Configuration Supabase incomplète.",
      },
      {
        status: 500,
      }
    );
  }

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
    console.error(
      "Session invalide dans PATCH /api/admin/users/[id] :",
      currentUserError
    );

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

  const permission =
    await checkEmailManagementPermission(
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
          "Vous n'avez pas l'autorisation de modifier une adresse e-mail.",
      },
      {
        status: 403,
      }
    );
  }

  const { id: targetUserId } =
    await context.params;

  if (
    targetUserId === currentUser.id
  ) {
    return NextResponse.json(
      {
        error:
          "Vous ne pouvez pas modifier votre propre adresse e-mail depuis l'administration.",
      },
      {
        status: 403,
      }
    );
  }

  let body: {
    email?: unknown;
    password?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Requête invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const newEmail =
    typeof body.email === "string"
      ? body.email
          .trim()
          .toLowerCase()
      : "";

  const confirmationPassword =
    typeof body.password === "string"
      ? body.password
      : "";

  if (!newEmail) {
    return NextResponse.json(
      {
        error:
          "La nouvelle adresse e-mail est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(newEmail)) {
    return NextResponse.json(
      {
        error:
          "L'adresse e-mail n'est pas valide.",
      },
      {
        status: 400,
      }
    );
  }

  if (!confirmationPassword) {
    return NextResponse.json(
      {
        error:
          "Votre mot de passe est obligatoire pour confirmer cette action.",
      },
      {
        status: 400,
      }
    );
  }

  if (!currentUser.email) {
    return NextResponse.json(
      {
        error:
          "Impossible de vérifier l'identité de l'utilisateur connecté.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Vérification isolée du mot de passe
   */

  const passwordVerificationClient =
    createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

  const {
    data: passwordVerificationData,
    error: passwordVerificationError,
  } =
    await passwordVerificationClient.auth.signInWithPassword(
      {
        email: currentUser.email,
        password:
          confirmationPassword,
      }
    );

  if (
    passwordVerificationError ||
    !passwordVerificationData.user ||
    passwordVerificationData.user.id !==
      currentUser.id
  ) {
    console.error(
      "Échec de vérification du mot de passe :",
      passwordVerificationError
    );

    return NextResponse.json(
      {
        error:
          "Votre mot de passe est incorrect.",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * IMPORTANT :
   *
   * Pas de signOut() ici.
   *
   * Le client utilise persistSession: false.
   * La session temporaire n'est donc pas conservée.
   */

  const {
    data: targetProfile,
    error: targetProfileError,
  } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, first_name, last_name"
    )
    .eq("id", targetUserId)
    .single<TargetProfile>();

  if (
    targetProfileError ||
    !targetProfile
  ) {
    console.error(
      "Impossible de récupérer le profil cible :",
      targetProfileError
    );

    return NextResponse.json(
      {
        error:
          "Le profil de l'utilisateur est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    data: targetAuthData,
    error: targetAuthError,
  } =
    await supabaseAdmin.auth.admin.getUserById(
      targetUserId
    );

  if (
    targetAuthError ||
    !targetAuthData.user
  ) {
    console.error(
      "Impossible de récupérer le compte Auth cible :",
      targetAuthError
    );

    return NextResponse.json(
      {
        error:
          "Le compte de connexion de cet utilisateur est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const previousEmail =
    targetAuthData.user.email ?? null;

  if (
    previousEmail?.toLowerCase() ===
    newEmail
  ) {
    return NextResponse.json({
      message:
        "L'adresse e-mail est déjà celle-ci.",

      user: {
        id: targetUserId,
        email: previousEmail,
      },
    });
  }

  const {
    data: updatedAuthData,
    error: updateEmailError,
  } =
    await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      {
        email: newEmail,
        email_confirm: true,
      }
    );

  if (
    updateEmailError ||
    !updatedAuthData.user
  ) {
    console.error(
      "Impossible de modifier l'adresse e-mail :",
      updateEmailError
    );

    const normalizedMessage =
      updateEmailError?.message
        ?.toLowerCase() ?? "";

    if (
      normalizedMessage.includes(
        "already"
      ) ||
      normalizedMessage.includes(
        "registered"
      ) ||
      normalizedMessage.includes(
        "exists"
      ) ||
      normalizedMessage.includes(
        "duplicate"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Cette adresse e-mail est déjà utilisée par un autre compte.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Impossible de modifier l'adresse e-mail.",
      },
      {
        status: 500,
      }
    );
  }

  const actorName =
    `${permission.profile.first_name ?? ""} ${
      permission.profile.last_name ?? ""
    }`.trim() ||
    currentUser.email ||
    "Utilisateur inconnu";

  const targetName =
    `${targetProfile.first_name ?? ""} ${
      targetProfile.last_name ?? ""
    }`.trim() ||
    "Utilisateur inconnu";

  const {
    error: auditError,
  } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      actor_id: currentUser.id,

      actor_name: actorName,

      actor_email:
        currentUser.email ?? null,

      action: "UPDATE_EMAIL",

      target_profile_id:
        targetUserId,

      target_name:
        targetName,

      target_email:
        newEmail,

      module: "users",

      details: {
        previous_email:
          previousEmail,

        new_email:
          newEmail,
      },
    });

  if (auditError) {
    console.error(
      "L'adresse e-mail a été modifiée, mais l'audit UPDATE_EMAIL n'a pas pu être enregistré :",
      auditError
    );
  }

  return NextResponse.json({
    message:
      "L'adresse e-mail a été modifiée avec succès.",

    user: {
      id:
        updatedAuthData.user.id,

      email:
        updatedAuthData.user.email ??
        newEmail,
    },
  });
}