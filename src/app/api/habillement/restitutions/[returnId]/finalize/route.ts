import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";

type ClothingReturnRow = {
  id: string;
  profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
  grade: string | null;
  status: "a_restituer" | "en_cours" | "terminee" | "pret_suppression";
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      returnId: string;
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
        detectSessionInUrl: false,
      },
    }
  );

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

  const { data: canManage, error: permissionError } =
    await requestSupabase.rpc("can_manage_clothing");

  if (permissionError || !canManage) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à finaliser une restitution habillement.",
      },
      { status: 403 }
    );
  }

  const { returnId } = await context.params;

  if (!returnId) {
    return NextResponse.json(
      { error: "Le dossier de restitution est invalide." },
      { status: 400 }
    );
  }

  const { data: clothingReturn, error: returnError } =
    await supabaseAdmin
      .from("clothing_returns")
      .select(
        "id, profile_id, first_name, last_name, grade, status"
      )
      .eq("id", returnId)
      .single<ClothingReturnRow>();

  if (returnError || !clothingReturn) {
    return NextResponse.json(
      { error: "Ce dossier de restitution est introuvable." },
      { status: 404 }
    );
  }

  if (clothingReturn.status === "terminee") {
    return NextResponse.json({
      message: "Cette restitution est déjà terminée.",
    });
  }

  if (clothingReturn.status !== "pret_suppression") {
    return NextResponse.json(
      {
        error:
          "La restitution doit être entièrement traitée avant de supprimer le compte.",
      },
      { status: 409 }
    );
  }

  const {
    count: pendingItemCount,
    error: pendingItemsError,
  } = await supabaseAdmin
    .from("clothing_return_items")
    .select("id", { count: "exact", head: true })
    .eq("return_id", returnId)
    .eq("status", "a_restituer");

  if (pendingItemsError) {
    console.error(
      "Vérification des éléments de restitution :",
      pendingItemsError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier que tous les vêtements ont été traités.",
      },
      { status: 500 }
    );
  }

  if ((pendingItemCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Certains vêtements sont encore en attente de restitution.",
      },
      { status: 409 }
    );
  }

  const profileId = clothingReturn.profile_id;

  if (profileId) {
    const {
      count: assignmentCount,
      error: assignmentsError,
    } = await supabaseAdmin
      .from("clothing_assignments")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId);

    if (assignmentsError) {
      console.error(
        "Vérification de la dotation restante :",
        assignmentsError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de vérifier la dotation restante de cet utilisateur.",
        },
        { status: 500 }
      );
    }

    if ((assignmentCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Le compte ne peut pas être supprimé : une dotation habillement est encore enregistrée.",
        },
        { status: 409 }
      );
    }
  }

  const targetName =
    `${clothingReturn.first_name ?? ""} ${
      clothingReturn.last_name ?? ""
    }`.trim() || "Ancien utilisateur";

  /*
   * On supprime d'abord le compte Auth.
   * Si une précédente tentative l'a déjà supprimé, getUserById peut
   * simplement ne plus retrouver l'utilisateur : on poursuit alors
   * la finalisation du profil.
   */
  if (profileId) {
    const {
      data: authUserData,
      error: authLookupError,
    } = await supabaseAdmin.auth.admin.getUserById(profileId);

    if (authLookupError) {
      console.error(
        "Lecture du compte Auth avant suppression :",
        authLookupError
      );
    }

    if (authUserData?.user) {
      const { error: authDeleteError } =
        await supabaseAdmin.auth.admin.deleteUser(profileId);

      if (authDeleteError) {
        console.error(
          "Suppression définitive du compte Auth :",
          authDeleteError
        );

        return NextResponse.json(
          {
            error:
              "Le compte d'authentification n'a pas pu être supprimé.",
          },
          { status: 500 }
        );
      }
    }
  }

  const now = new Date().toISOString();

  const { error: completeReturnError } =
    await supabaseAdmin
      .from("clothing_returns")
      .update({
        status: "terminee",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", returnId);

  if (completeReturnError) {
    console.error(
      "Clôture du dossier de restitution :",
      completeReturnError
    );

    return NextResponse.json(
      {
        error:
          "Le compte Auth a été supprimé, mais le dossier de restitution n'a pas pu être clôturé.",
      },
      { status: 500 }
    );
  }

  if (profileId) {
    const { error: profileDeleteError } =
      await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", profileId);

    if (profileDeleteError) {
      console.error(
        "Suppression définitive du profil après restitution :",
        profileDeleteError
      );

      return NextResponse.json(
        {
          error:
            "Le compte Auth a été supprimé, mais le profil n'a pas pu être supprimé. Le dossier reste conservé pour permettre une nouvelle tentative.",
        },
        { status: 500 }
      );
    }
  }

  const {
    data: actorProfile,
  } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", currentUser.id)
    .maybeSingle();

  const actorName =
    `${actorProfile?.first_name ?? ""} ${
      actorProfile?.last_name ?? ""
    }`.trim() ||
    currentUser.email ||
    "Utilisateur";

  const { error: auditError } =
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: currentUser.id,
      actor_name: actorName,
      actor_email: currentUser.email ?? null,
      action: "FINALIZE_CLOTHING_RETURN_DELETE_USER",
      target_profile_id: null,
      target_name: targetName,
      target_email: null,
      module: "habillement",
      details: {
        clothing_return_id: returnId,
        deleted_profile_id: profileId,
        completed_at: now,
      },
    });

  if (auditError) {
    console.error(
      "Compte supprimé, mais écriture de l'audit impossible :",
      auditError
    );
  }

  return NextResponse.json({
    message:
      "Restitution terminée et compte supprimé définitivement.",
  });
}