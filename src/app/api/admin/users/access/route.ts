import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY!;

type AccessStatus = "active" | "suspended" | "archived";

const COMMAND_BUSINESS_ROLES = [
  "chef_centre",
  "adjoint_chef_centre",
];

export async function POST(request: NextRequest) {
  try {
    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Session manquante." },
        { status: 401 }
      );
    }

    if (!supabaseSecretKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SECRET_KEY n'est pas configurée.",
        },
        { status: 500 }
      );
    }

    const token = authorization.slice(7);

    // Client utilisant la session de l'utilisateur connecté
    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user: currentUser },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: "Session invalide ou expirée." },
        { status: 401 }
      );
    }

    // Client serveur privilégié
    const adminClient = createClient(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // --------------------------------------------------
    // 1. Profil de l'utilisateur connecté
    // --------------------------------------------------

    const {
      data: currentProfile,
      error: profileError,
    } = await adminClient
      .from("profiles")
      .select("id, access_role, access_status")
      .eq("id", currentUser.id)
      .single();

    if (profileError || !currentProfile) {
      return NextResponse.json(
        { error: "Profil utilisateur introuvable." },
        { status: 403 }
      );
    }

    if (currentProfile.access_status !== "active") {
      return NextResponse.json(
        { error: "Votre compte n'est pas actif." },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 2. Rôles métier de l'utilisateur connecté
    // --------------------------------------------------

    const {
      data: currentBusinessRoles,
      error: rolesError,
    } = await adminClient
      .from("profile_business_roles")
      .select(`
        business_roles (
          code
        )
      `)
      .eq("profile_id", currentUser.id);

    if (rolesError) {
      console.error(
        "Erreur récupération rôles métier :",
        rolesError
      );

      return NextResponse.json(
        {
          error: "Impossible de vérifier vos droits.",
        },
        { status: 500 }
      );
    }

    const businessRoleCodes =
      currentBusinessRoles
        ?.map((item: any) => item.business_roles?.code)
        .filter(Boolean) ?? [];

    const isAdmin =
      currentProfile.access_role === "admin";

    const isCommandement =
      businessRoleCodes.some((code: string) =>
        COMMAND_BUSINESS_ROLES.includes(code)
      );

    // Admin + Chef de centre + Adjoint chef de centre
    if (!isAdmin && !isCommandement) {
      return NextResponse.json(
        {
          error:
            "Action réservée aux administrateurs et au commandement.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 3. Lecture de la demande
    // --------------------------------------------------

    const body = (await request.json()) as {
      userId?: string;
      accessStatus?: AccessStatus;
    };

    if (!body.userId) {
      return NextResponse.json(
        { error: "Utilisateur manquant." },
        { status: 400 }
      );
    }

    if (
      body.accessStatus !== "active" &&
      body.accessStatus !== "suspended" &&
      body.accessStatus !== "archived"
    ) {
      return NextResponse.json(
        { error: "Statut d'accès invalide." },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 4. Impossible de modifier son propre accès
    // --------------------------------------------------

    if (body.userId === currentUser.id) {
      return NextResponse.json(
        {
          error:
            "Vous ne pouvez pas modifier l'accès de votre propre compte.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 5. Profil ciblé
    // --------------------------------------------------

    const {
      data: targetProfile,
      error: targetError,
    } = await adminClient
      .from("profiles")
      .select(
        "id, access_role, access_status, archived_at"
      )
      .eq("id", body.userId)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { error: "Utilisateur introuvable." },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // 6. Protection des comptes administrateurs
    // --------------------------------------------------

    if (
      targetProfile.access_role === "admin" &&
      (
        body.accessStatus === "suspended" ||
        body.accessStatus === "archived"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Un compte administrateur ne peut pas être suspendu ou archivé.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 7. Modification du statut
    // --------------------------------------------------

    const {
      data: updatedProfile,
      error: updateError,
    } = await adminClient
      .from("profiles")
      .update({
        access_status: body.accessStatus,
        archived_at:
          body.accessStatus === "archived"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", body.userId)
      .select("id, access_status, archived_at")
      .single();

    if (updateError || !updatedProfile) {
      console.error(
        "Erreur modification access_status :",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Impossible d'enregistrer le nouveau statut.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 8. Réponse
    // --------------------------------------------------

    let message = "Utilisateur réactivé.";

    if (body.accessStatus === "suspended") {
      message = "Accès suspendu.";
    }

    if (body.accessStatus === "archived") {
      message = "Utilisateur archivé.";
    }

    return NextResponse.json({
      message,
      accessStatus: updatedProfile.access_status,
      archivedAt: updatedProfile.archived_at,
    });
  } catch (error) {
    console.error(
      "Erreur API accès utilisateur :",
      error
    );

    return NextResponse.json(
      {
        error: "Une erreur serveur est survenue.",
      },
      { status: 500 }
    );
  }
}