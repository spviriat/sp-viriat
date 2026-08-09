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

const STOCK_READ_ROLES = [
  "responsable_pharmacie",
  "chef_centre",
  "adjoint_chef_centre",
] as const;

const STOCK_WRITE_ROLES = [
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

type PermissionResult = {
  canRead: boolean;
  canWrite: boolean;
  profile: CurrentProfile | null;
};

type CreateMovementPayload = {
  type?: unknown;
  quantity?: unknown;
  reason?: unknown;
};

type ExpirationLotRow = {
  id: string;
  quantity: number;
  expiration_date: string;
};

type FefoLotChange = {
  id: string;
  previousQuantity: number;
  newQuantity: number;
  consumedQuantity: number;
  expirationDate: string;
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

function normalizeNullableString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
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

async function getStockPermission(
  requestSupabase: SupabaseClient<any>,
  currentUserId: string
): Promise<PermissionResult> {
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
    .eq(
      "id",
      currentUserId
    )
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
      canRead: false,
      canWrite: false,
      profile: null,
    };
  }

  const profile =
    profileData as CurrentProfile;

  if (
    profile.access_role === "admin"
  ) {
    return {
      canRead: true,
      canWrite: true,
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
      canRead: false,
      canWrite: false,
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

  const canRead =
    roleCodes.some((code) =>
      STOCK_READ_ROLES.includes(
        code as
          (typeof STOCK_READ_ROLES)[number]
      )
    );

  const canWrite =
    roleCodes.some((code) =>
      STOCK_WRITE_ROLES.includes(
        code as
          (typeof STOCK_WRITE_ROLES)[number]
      )
    );

  return {
    canRead,
    canWrite,
    profile,
  };
}

async function authenticateRequest(
  request: Request
) {
  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "La configuration du serveur est incomplète.",
          },
          {
            status: 500,
          }
        ),
      currentUser: null,
      permission: null,
    };
  }

  const accessToken =
    getBearerToken(
      request.headers.get(
        "authorization"
      )
    );

  if (!accessToken) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Vous devez être connecté.",
          },
          {
            status: 401,
          }
        ),
      currentUser: null,
      permission: null,
    };
  }

  const requestSupabase =
    createRequestSupabase(
      accessToken
    );

  if (!requestSupabase) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "La configuration du serveur est incomplète.",
          },
          {
            status: 500,
          }
        ),
      currentUser: null,
      permission: null,
    };
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
    return {
      error:
        NextResponse.json(
          {
            error:
              "Votre session est invalide ou a expiré.",
          },
          {
            status: 401,
          }
        ),
      currentUser: null,
      permission: null,
    };
  }

  const permission =
    await getStockPermission(
      requestSupabase,
      currentUser.id
    );

  return {
    error: null,
    currentUser,
    permission,
  };
}

function getActorName(
  profile: CurrentProfile,
  email: string | undefined
) {
  return (
    `${
      profile.first_name ?? ""
    } ${
      profile.last_name ?? ""
    }`.trim() ||
    email ||
    "Utilisateur inconnu"
  );
}

/*
 * =========================================================
 * GET
 * =========================================================
 *
 * Historique des mouvements d'un article.
 */

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const {
    error,
    permission,
  } =
    await authenticateRequest(
      request
    );

  if (error) {
    return error;
  }

  if (
    !permission ||
    !permission.canRead
  ) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à consulter les mouvements de stock.",
      },
      {
        status: 403,
      }
    );
  }

  const {
    id: medicalItemId,
  } =
    await context.params;

  if (!medicalItemId) {
    return NextResponse.json(
      {
        error:
          "L'article est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: article,
    error: articleError,
  } = await supabaseAdmin
    .from("medical_items")
    .select(`
      id,
      name,
      quantity,
      minimum_quantity,
      has_expiration,
      is_active
    `)
    .eq(
      "id",
      medicalItemId
    )
    .maybeSingle();

  if (articleError) {
    console.error(
      "Impossible de récupérer l'article :",
      articleError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer cet article.",
      },
      {
        status: 500,
      }
    );
  }

  if (!article) {
    return NextResponse.json(
      {
        error:
          "Article introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const {
    data: movements,
    error: movementsError,
  } = await supabaseAdmin
    .from(
      "medical_stock_movements"
    )
    .select(`
      id,
      medical_item_id,
      movement_type,
      quantity_change,
      previous_quantity,
      new_quantity,
      reason,
      actor_id,
      actor_name,
      created_at
    `)
    .eq(
      "medical_item_id",
      medicalItemId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (movementsError) {
    console.error(
      "Impossible de récupérer les mouvements de stock :",
      movementsError
    );

    return NextResponse.json(
      {
        error:
          "L'historique des mouvements n'a pas pu être récupéré.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    article,
    movements:
      movements ?? [],

    permissions: {
      canRead:
        permission.canRead,

      canWrite:
        permission.canWrite,
    },
  });
}

/*
 * =========================================================
 * POST
 * =========================================================
 *
 * Crée une entrée ou une sortie de stock.
 *
 * Payload :
 * {
 *   type: "entry" | "exit",
 *   quantity: 5,
 *   reason: "Réassort"
 * }
 *
 * Valeurs enregistrées en base :
 * - entry  -> addition
 * - exit   -> withdrawal
 */

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const {
    error,
    currentUser,
    permission,
  } =
    await authenticateRequest(
      request
    );

  if (error) {
    return error;
  }

  if (
    !currentUser ||
    !permission ||
    !permission.profile
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

  if (!permission.canWrite) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à modifier le stock pharmacie.",
      },
      {
        status: 403,
      }
    );
  }

  const {
    id: medicalItemId,
  } =
    await context.params;

  if (!medicalItemId) {
    return NextResponse.json(
      {
        error:
          "L'article est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  let payload:
    CreateMovementPayload;

  try {
    payload =
      (await request.json()) as
        CreateMovementPayload;
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

  const requestedType =
    payload.type === "entry"
      ? "entry"
      : payload.type === "exit"
        ? "exit"
        : null;

  const movementType =
    requestedType === "entry"
      ? "addition"
      : requestedType === "exit"
        ? "withdrawal"
        : null;

  const quantity =
    typeof payload.quantity ===
      "number"
      ? payload.quantity
      : Number(
          payload.quantity
        );

  const reason =
    normalizeNullableString(
      payload.reason
    );

  if (!movementType) {
    return NextResponse.json(
      {
        error:
          "Le type de mouvement est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "La quantité doit être un entier supérieur à 0.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: article,
    error: articleError,
  } = await supabaseAdmin
    .from("medical_items")
    .select(`
      id,
      name,
      quantity,
      minimum_quantity,
      has_expiration,
      is_active
    `)
    .eq(
      "id",
      medicalItemId
    )
    .maybeSingle();

  if (articleError) {
    console.error(
      "Impossible de récupérer l'article :",
      articleError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer cet article.",
      },
      {
        status: 500,
      }
    );
  }

  if (!article) {
    return NextResponse.json(
      {
        error:
          "Article introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const previousQuantity =
    article.quantity;

  const quantityChange =
    movementType === "addition"
      ? quantity
      : -quantity;

  const newQuantity =
    previousQuantity +
    quantityChange;

  if (newQuantity < 0) {
    return NextResponse.json(
      {
        error:
          `Stock insuffisant. Quantité disponible : ${previousQuantity}.`,
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =====================================================
   * PLAN FEFO
   * =====================================================
   *
   * Pour une sortie d'un article suivi en péremption,
   * on consomme uniquement les lots NON expirés par date
   * de péremption croissante.
   *
   * Les lots expirés sont exclus des sorties normales et
   * doivent être retirés via une destruction dédiée.
   *
   * La partie du stock qui n'est pas affectée à un lot
   * est consommée après les lots valides enregistrés.
   */

  let fefoChanges:
    FefoLotChange[] = [];

  let unassignedQuantityBefore =
    previousQuantity;

  let unassignedQuantityConsumed = 0;

  if (
    movementType === "withdrawal" &&
    article.has_expiration
  ) {
    const {
      data: expirationLotsData,
      error: expirationLotsError,
    } = await supabaseAdmin
      .from(
        "medical_item_expirations"
      )
      .select(`
        id,
        quantity,
        expiration_date
      `)
      .eq(
        "medical_item_id",
        medicalItemId
      )
      .gt(
        "quantity",
        0
      )
      .order(
        "expiration_date",
        {
          ascending: true,
        }
      );

    if (expirationLotsError) {
      console.error(
        "Impossible de récupérer les lots pour le FEFO :",
        expirationLotsError
      );

      return NextResponse.json(
        {
          error:
            "Les lots de péremption n'ont pas pu être récupérés.",
        },
        {
          status: 500,
        }
      );
    }

    const allExpirationLots =
      (expirationLotsData ??
        []) as ExpirationLotRow[];

    /*
     * Un lot expiré ne doit jamais être utilisé pour une
     * sortie normale. Il reste en stock jusqu'à une opération
     * dédiée de destruction des périmés.
     */

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const validExpirationLots =
      allExpirationLots.filter(
        (lot) => {
          const expirationDate =
            new Date(
              `${lot.expiration_date}T00:00:00`
            );

          return (
            expirationDate.getTime() >=
            today.getTime()
          );
        }
      );

    const expiredQuantity =
      allExpirationLots
        .filter(
          (lot) => {
            const expirationDate =
              new Date(
                `${lot.expiration_date}T00:00:00`
              );

            return (
              expirationDate.getTime() <
              today.getTime()
            );
          }
        )
        .reduce(
          (
            total,
            lot
          ) =>
            total +
            Number(
              lot.quantity ?? 0
            ),
          0
        );

    const assignedQuantity =
      allExpirationLots.reduce(
        (
          total,
          lot
        ) =>
          total +
          Number(
            lot.quantity ?? 0
          ),
        0
      );

    unassignedQuantityBefore =
      Math.max(
        previousQuantity -
          assignedQuantity,
        0
      );

    const usableQuantity =
      previousQuantity -
      expiredQuantity;

    if (
      quantity >
      usableQuantity
    ) {
      return NextResponse.json(
        {
          error:
            `Stock utilisable insuffisant. ${usableQuantity} unité(s) utilisable(s) disponible(s) et ${expiredQuantity} unité(s) expirée(s) à détruire.`,
        },
        {
          status: 400,
        }
      );
    }

    let remainingToConsume =
      quantity;

    /*
     * FEFO uniquement sur les lots NON expirés :
     * date de péremption la plus proche en premier.
     */

    for (
      const lot of
        validExpirationLots
    ) {
      if (
        remainingToConsume <= 0
      ) {
        break;
      }

      const lotQuantity =
        Number(
          lot.quantity ?? 0
        );

      if (lotQuantity <= 0) {
        continue;
      }

      const consumedQuantity =
        Math.min(
          lotQuantity,
          remainingToConsume
        );

      fefoChanges.push({
        id: lot.id,

        previousQuantity:
          lotQuantity,

        newQuantity:
          lotQuantity -
          consumedQuantity,

        consumedQuantity,

        expirationDate:
          lot.expiration_date,
      });

      remainingToConsume -=
        consumedQuantity;
    }

    /*
     * Si les lots valides ne couvrent pas toute la sortie,
     * le reliquat est pris sur le stock non affecté.
     * Les lots expirés ne sont jamais consommés ici.
     */

    if (
      remainingToConsume > 0
    ) {
      if (
        remainingToConsume >
        unassignedQuantityBefore
      ) {
        return NextResponse.json(
          {
            error:
              `Stock utilisable incohérent : ${remainingToConsume} unité(s) restent à sortir mais seulement ${unassignedQuantityBefore} unité(s) non affectée(s) sont disponibles.`,
          },
          {
            status: 409,
          }
        );
      }

      unassignedQuantityConsumed =
        remainingToConsume;
    }
  }

  const {
    data: updatedArticle,
    error: updateError,
  } = await supabaseAdmin
    .from("medical_items")
    .update({
      quantity:
        newQuantity,

      updated_by:
        currentUser.id,
    })
    .eq(
      "id",
      medicalItemId
    )
    .select(`
      id,
      name,
      quantity,
      minimum_quantity,
      is_active,
      updated_at
    `)
    .single();

  if (
    updateError ||
    !updatedArticle
  ) {
    console.error(
      "Impossible de mettre à jour le stock :",
      updateError
    );

    return NextResponse.json(
      {
        error:
          "Le stock n'a pas pu être mis à jour.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * =====================================================
   * APPLICATION DU FEFO
   * =====================================================
   */

  const appliedFefoChanges:
    FefoLotChange[] = [];

  if (
    movementType === "withdrawal" &&
    article.has_expiration &&
    fefoChanges.length > 0
  ) {
    for (
      const change of
        fefoChanges
    ) {
      const {
        error:
          updateExpirationError,
      } = await supabaseAdmin
        .from(
          "medical_item_expirations"
        )
        .update({
          quantity:
            change.newQuantity,
        })
        .eq(
          "id",
          change.id
        );

      if (
        updateExpirationError
      ) {
        console.error(
          "Impossible de mettre à jour un lot FEFO :",
          updateExpirationError
        );

        /*
         * Rollback des lots déjà modifiés.
         */

        for (
          const appliedChange of
            [...appliedFefoChanges]
              .reverse()
        ) {
          const {
            error:
              rollbackLotError,
          } =
            await supabaseAdmin
              .from(
                "medical_item_expirations"
              )
              .update({
                quantity:
                  appliedChange
                    .previousQuantity,
              })
              .eq(
                "id",
                appliedChange.id
              );

          if (
            rollbackLotError
          ) {
            console.error(
              "Impossible de restaurer un lot FEFO :",
              rollbackLotError
            );
          }
        }

        /*
         * Rollback du stock global.
         */

        const {
          error:
            rollbackStockError,
        } = await supabaseAdmin
          .from("medical_items")
          .update({
            quantity:
              previousQuantity,

            updated_by:
              currentUser.id,
          })
          .eq(
            "id",
            medicalItemId
          );

        if (
          rollbackStockError
        ) {
          console.error(
            "Impossible de restaurer le stock après erreur FEFO :",
            rollbackStockError
          );
        }

        return NextResponse.json(
          {
            error:
              "La sortie n'a pas pu être appliquée aux lots de péremption.",
          },
          {
            status: 500,
          }
        );
      }

      appliedFefoChanges.push(
        change
      );
    }
  }

  const actorName =
    getActorName(
      permission.profile,
      currentUser.email
    );

  const {
    data: movement,
    error: movementError,
  } = await supabaseAdmin
    .from(
      "medical_stock_movements"
    )
    .insert({
      medical_item_id:
        medicalItemId,

      movement_type:
        movementType,

      quantity_change:
        quantityChange,

      previous_quantity:
        previousQuantity,

      new_quantity:
        newQuantity,

      reason,

      actor_id:
        currentUser.id,

      actor_name:
        actorName,
    })
    .select(`
      id,
      medical_item_id,
      movement_type,
      quantity_change,
      previous_quantity,
      new_quantity,
      reason,
      actor_id,
      actor_name,
      created_at
    `)
    .single();

  if (
    movementError ||
    !movement
  ) {
    console.error(
      "Le stock a été modifié mais le mouvement n'a pas pu être enregistré :",
      movementError
    );

    /*
     * Rollback des lots FEFO si
     * l'historique ne peut pas être créé.
     */

    for (
      const appliedChange of
        [...appliedFefoChanges]
          .reverse()
    ) {
      const {
        error:
          rollbackLotError,
      } = await supabaseAdmin
        .from(
          "medical_item_expirations"
        )
        .update({
          quantity:
            appliedChange
              .previousQuantity,
        })
        .eq(
          "id",
          appliedChange.id
        );

      if (
        rollbackLotError
      ) {
        console.error(
          "Impossible de restaurer un lot après erreur d'historique :",
          rollbackLotError
        );
      }
    }

    /*
     * Rollback du stock global.
     */

    const {
      error: rollbackError,
    } = await supabaseAdmin
      .from("medical_items")
      .update({
        quantity:
          previousQuantity,

        updated_by:
          currentUser.id,
      })
      .eq(
        "id",
        medicalItemId
      );

    if (rollbackError) {
      console.error(
        "Impossible de restaurer le stock après erreur d'historique :",
        rollbackError
      );
    }

    return NextResponse.json(
      {
        error:
          "Le mouvement de stock n'a pas pu être enregistré.",
      },
      {
        status: 500,
      }
    );
  }

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
        currentUser.email ??
        null,

      action:
        movementType === "addition"
          ? "CREATE_MEDICAL_STOCK_ENTRY"
          : "CREATE_MEDICAL_STOCK_EXIT",

      target_profile_id:
        null,

      target_name:
        article.name,

      target_email:
        null,

      module:
        "secourisme",

      details: {
        medical_item_id:
          medicalItemId,

        medical_item_name:
          article.name,

        movement_type:
          movementType,

        quantity:
          quantity,

        quantity_change:
          quantityChange,

        previous_quantity:
          previousQuantity,

        new_quantity:
          newQuantity,

        reason,

        fefo:
          movementType ===
            "withdrawal" &&
          article.has_expiration
            ? {
                lots: fefoChanges.map(
                  (change) => ({
                    expiration_id:
                      change.id,

                    expiration_date:
                      change
                        .expirationDate,

                    previous_quantity:
                      change
                        .previousQuantity,

                    consumed_quantity:
                      change
                        .consumedQuantity,

                    new_quantity:
                      change
                        .newQuantity,
                  })
                ),

                unassigned_quantity_before:
                  unassignedQuantityBefore,

                unassigned_quantity_consumed:
                  unassignedQuantityConsumed,
              }
            : null,
      },
    });

  if (auditError) {
    console.error(
      "Mouvement créé, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json(
    {
      message:
        movementType === "addition"
          ? "L'entrée de stock a été enregistrée avec succès."
          : "La sortie de stock a été enregistrée avec succès.",

      article:
        updatedArticle,

      movement,

      fefo:
        movementType ===
          "withdrawal" &&
        article.has_expiration
          ? {
              lots:
                fefoChanges,

              unassignedQuantityBefore,

              unassignedQuantityConsumed,
            }
          : null,
    },
    {
      status: 201,
    }
  );
}