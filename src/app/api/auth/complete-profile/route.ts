import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type CompleteProfilePayload = {
  phone?: unknown;
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

export async function POST(
  request: Request
) {
  /*
   * =====================================================
   * 1. CONFIGURATION
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
   * 2. TOKEN
   * =====================================================
   */

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

  /*
   * =====================================================
   * 3. CLIENT SUPABASE DE LA REQUÊTE
   * =====================================================
   */

  const requestSupabase =
    createClient(
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

  /*
   * =====================================================
   * 4. VALIDATION DE LA SESSION
   * =====================================================
   */

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

  /*
   * =====================================================
   * 5. LECTURE DU PAYLOAD
   * =====================================================
   */

  let payload:
    CompleteProfilePayload;

  try {
    payload =
      (await request.json()) as CompleteProfilePayload;
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

  const phone =
    typeof payload.phone ===
    "string"
      ? payload.phone.trim()
      : "";

  /*
   * =====================================================
   * 6. PROFIL ACTUEL
   * =====================================================
   */

  const {
    data: profile,
    error: profileError,
  } = await supabaseAdmin
    .from("profiles")
    .select(`
      id,
      first_name,
      last_name,
      status
    `)
    .eq(
      "id",
      currentUser.id
    )
    .single();

  if (
    profileError ||
    !profile
  ) {
    console.error(
      "Impossible de récupérer le profil pendant l'activation :",
      profileError
    );

    return NextResponse.json(
      {
        error:
          "Votre profil utilisateur est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * =====================================================
   * 7. ACTIVATION
   * =====================================================
   *
   * IMPORTANT :
   *
   * L'identifiant vient exclusivement
   * du token authentifié.
   *
   * Le navigateur ne peut donc pas
   * choisir le profil à modifier.
   */

  const {
    data: updatedProfile,
    error: updateError,
  } = await supabaseAdmin
    .from("profiles")
    .update({
      phone:
        phone || null,

      status:
        "active",
    })
    .eq(
      "id",
      currentUser.id
    )
    .select(`
      id,
      first_name,
      last_name,
      phone,
      access_role,
      status
    `)
    .single();

  if (
    updateError ||
    !updatedProfile
  ) {
    console.error(
      "Impossible de finaliser le profil :",
      updateError
    );

    return NextResponse.json(
      {
        error:
          "Votre profil n'a pas pu être finalisé.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * =====================================================
   * 8. AUDIT
   * =====================================================
   */

  const fullName =
    `${profile.first_name ?? ""} ${
      profile.last_name ?? ""
    }`.trim() ||
    currentUser.email ||
    "Utilisateur";

  const {
    error: auditError,
  } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      actor_id:
        currentUser.id,

      actor_name:
        fullName,

      actor_email:
        currentUser.email ?? null,

      action:
        "ACTIVATE_ACCOUNT",

      target_profile_id:
        currentUser.id,

      target_name:
        fullName,

      target_email:
        currentUser.email ?? null,

      module:
        "auth",

      details: {
        previous_status:
          profile.status,

        new_status:
          "active",

        phone_completed:
          Boolean(phone),
      },
    });

  if (auditError) {
    /*
     * L'activation est déjà faite.
     * On ne renvoie donc pas une erreur.
     */

    console.error(
      "Compte activé, mais audit ACTIVATE_ACCOUNT impossible :",
      auditError
    );
  }

  /*
   * =====================================================
   * 9. RÉPONSE
   * =====================================================
   */

  return NextResponse.json({
    message:
      "Votre compte a été activé avec succès.",

    profile:
      updatedProfile,
  });
}