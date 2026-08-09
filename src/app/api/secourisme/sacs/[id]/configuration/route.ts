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

type BusinessRoleAssignment = {
  business_roles:
    | { code: string }
    | { code: string }[]
    | null;
};

const ALLOWED_SECTION_TYPES =
  new Set([
    "pochette",
    "poche_exterieure",
    "compartiment",
    "sous_pochette",
    "autre",
  ]);

const ALLOWED_COLORS =
  new Set([
    "blue",
    "green",
    "yellow",
  ]);

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

async function canConfigure(
  requestSupabase:
    SupabaseClient<any>,
  userId: string
) {
  const {
    data: profile,
    error: profileError,
  } = await requestSupabase
    .from("profiles")
    .select("access_role")
    .eq("id", userId)
    .single();

  if (
    profileError ||
    !profile
  ) {
    return false;
  }

  if (
    profile.access_role === "admin"
  ) {
    return true;
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
    .eq("profile_id", userId);

  if (assignmentsError) {
    return false;
  }

  const codes = (
    (assignments ?? []) as
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

  return codes.includes(
    "responsable_pharmacie"
  );
}

async function authenticate(
  request: Request
) {
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
      userId: null,
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
              "Configuration serveur incomplète.",
          },
          {
            status: 500,
          }
        ),
      userId: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } =
    await requestSupabase.auth.getUser(
      accessToken
    );

  if (
    userError ||
    !user
  ) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Session invalide ou expirée.",
          },
          {
            status: 401,
          }
        ),
      userId: null,
    };
  }

  const allowed =
    await canConfigure(
      requestSupabase,
      user.id
    );

  if (!allowed) {
    return {
      error:
        NextResponse.json(
          {
            error:
              "Vous n'êtes pas autorisé à modifier la configuration des sacs.",
          },
          {
            status: 403,
          }
        ),
      userId: null,
    };
  }

  return {
    error: null,
    userId: user.id,
  };
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const BAG_CODE_ALIASES: Record<string, string> = {
  psvpi: "ps_vpi",
  ps_vpi: "ps_vpi",
  oxy: "oxy_vpi",
  oxyvpi: "oxy_vpi",
  oxy_vpi: "oxy_vpi",
  psfpt: "ps_fpt",
  ps_fpt: "ps_fpt",
};

function resolveBagCode(value: string) {
  const normalized = value.trim().toLowerCase();
  return BAG_CODE_ALIASES[normalized] ?? normalized;
}

async function getBag(bagCode: string) {
  return supabaseAdmin
    .from("rescue_bags")
    .select("id, code")
    .eq("code", bagCode)
    .eq("is_active", true)
    .single();
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  const { id } = await context.params;
  const bagCode = resolveBagCode(id);
  const {
    error,
  } = await authenticate(request);

  if (error) {
    return error;
  }

  const {
    data: medicalItems,
    error: medicalItemsError,
  } = await supabaseAdmin
    .from("medical_items")
    .select(`
      id,
      name,
      unit,
      quantity
    `)
    .eq("is_active", true)
    .order("name", {
      ascending: true,
    });

  if (medicalItemsError) {
    console.error(
      "Erreur chargement articles pharmacie :",
      medicalItemsError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de charger les articles de la pharmacie.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    medicalItems:
      medicalItems ?? [],
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  const { id } = await context.params;
  const bagCode = resolveBagCode(id);
  const {
    error,
  } = await authenticate(request);

  if (error) {
    return error;
  }

  let body: any;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "La requête est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    body.action ===
    "update_section"
  ) {
    const sectionId =
      typeof body.sectionId ===
        "string"
        ? body.sectionId
        : "";

    const name =
      typeof body.name ===
        "string"
        ? body.name.trim()
        : "";

    const sectionType =
      typeof body.sectionType ===
        "string"
        ? body.sectionType
        : "";

    const color =
      body.color === null ||
      body.color === ""
        ? null
        : typeof body.color ===
            "string"
          ? body.color
          : null;

    const displayOrder =
      Number(body.displayOrder);

    if (
      !sectionId ||
      !name ||
      !ALLOWED_SECTION_TYPES.has(
        sectionType
      ) ||
      (color !== null &&
        !ALLOWED_COLORS.has(
          color
        )) ||
      !Number.isInteger(
        displayOrder
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Données du compartiment invalides.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: bag,
    } = await getBag(bagCode);

    if (!bag) {
      return NextResponse.json(
        {
          error:
            "Sac PS VPI introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data: section,
      error: sectionError,
    } = await supabaseAdmin
      .from(
        "rescue_bag_sections"
      )
      .select("id")
      .eq("id", sectionId)
      .eq("bag_id", bag.id)
      .eq("is_active", true)
      .single();

    if (
      sectionError ||
      !section
    ) {
      return NextResponse.json(
        {
          error:
            "Compartiment introuvable pour ce sac.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      error: updateError,
    } = await supabaseAdmin
      .from(
        "rescue_bag_sections"
      )
      .update({
        name,
        section_type:
          sectionType,
        color,
        display_order:
          displayOrder,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", sectionId);

    if (updateError) {
      console.error(
        "Erreur modification compartiment :",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de modifier le compartiment.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      message:
        "Compartiment modifié.",
    });
  }

  if (
    body.action ===
    "update_item"
  ) {
    const expectedItemId =
      typeof body.expectedItemId ===
        "string"
        ? body.expectedItemId
        : "";

    const expectedQuantity =
      Number(
        body.expectedQuantity
      );

    const displayOrder =
      Number(body.displayOrder);

    const isRequired =
      body.isRequired === true;

    const notes =
      typeof body.notes ===
        "string" &&
      body.notes.trim()
        ? body.notes.trim()
        : null;

    if (
      !expectedItemId ||
      !Number.isInteger(
        expectedQuantity
      ) ||
      expectedQuantity < 1 ||
      !Number.isInteger(
        displayOrder
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Données de l'article invalides.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: bag,
    } = await getBag(bagCode);

    if (!bag) {
      return NextResponse.json(
        {
          error:
            "Sac PS VPI introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data: expectedItem,
      error: expectedItemError,
    } = await supabaseAdmin
      .from(
        "rescue_bag_expected_items"
      )
      .select(`
        id,
        section_id,
        rescue_bag_sections!inner (
          bag_id
        )
      `)
      .eq(
        "id",
        expectedItemId
      )
      .eq(
        "rescue_bag_sections.bag_id",
        bag.id
      )
      .eq("is_active", true)
      .single();

    if (
      expectedItemError ||
      !expectedItem
    ) {
      return NextResponse.json(
        {
          error:
            "Article attendu introuvable pour ce sac.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      error: updateError,
    } = await supabaseAdmin
      .from(
        "rescue_bag_expected_items"
      )
      .update({
        expected_quantity:
          expectedQuantity,
        is_required:
          isRequired,
        display_order:
          displayOrder,
        notes,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        expectedItemId
      );

    if (updateError) {
      console.error(
        "Erreur modification article attendu :",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de modifier l'article.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      message:
        "Article modifié.",
    });
  }

  return NextResponse.json(
    {
      error:
        "Action de configuration inconnue.",
    },
    {
      status: 400,
    }
  );
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  const { id } = await context.params;
  const bagCode = resolveBagCode(id);
  const {
    error,
  } = await authenticate(request);

  if (error) {
    return error;
  }

  let body: any;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "La requête est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: bag,
  } = await getBag(bagCode);

  if (!bag) {
    return NextResponse.json(
      {
        error:
          "Sac PS VPI introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    body.action ===
    "add_section"
  ) {
    const name =
      typeof body.name ===
        "string"
        ? body.name.trim()
        : "";

    const sectionType =
      typeof body.sectionType ===
        "string"
        ? body.sectionType
        : "";

    const color =
      body.color === null ||
      body.color === ""
        ? null
        : typeof body.color ===
            "string"
          ? body.color
          : null;

    const displayOrder =
      Number(body.displayOrder);

    if (
      !name ||
      !ALLOWED_SECTION_TYPES.has(
        sectionType
      ) ||
      (color !== null &&
        !ALLOWED_COLORS.has(
          color
        )) ||
      !Number.isInteger(
        displayOrder
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Données du compartiment invalides.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      error: insertError,
    } = await supabaseAdmin
      .from(
        "rescue_bag_sections"
      )
      .insert({
        bag_id:
          bag.id,
        parent_section_id:
          null,
        name,
        section_type:
          sectionType,
        color,
        display_order:
          displayOrder,
        is_active:
          true,
      });

    if (insertError) {
      console.error(
        "Erreur ajout compartiment :",
        insertError
      );

      return NextResponse.json(
        {
          error:
            "Impossible d'ajouter le compartiment.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        message:
          "Compartiment ajouté.",
      },
      {
        status: 201,
      }
    );
  }

  if (
    body.action ===
    "add_item"
  ) {
    const sectionId =
      typeof body.sectionId ===
        "string"
        ? body.sectionId
        : "";

    const medicalItemId =
      typeof body.medicalItemId ===
        "string"
        ? body.medicalItemId
        : "";

    const expectedQuantity =
      Number(
        body.expectedQuantity
      );

    const displayOrder =
      Number(body.displayOrder);

    const isRequired =
      body.isRequired === true;

    const notes =
      typeof body.notes ===
        "string" &&
      body.notes.trim()
        ? body.notes.trim()
        : null;

    if (
      !sectionId ||
      !medicalItemId ||
      !Number.isInteger(
        expectedQuantity
      ) ||
      expectedQuantity < 1 ||
      !Number.isInteger(
        displayOrder
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Données de l'article invalides.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: section,
      error: sectionError,
    } = await supabaseAdmin
      .from(
        "rescue_bag_sections"
      )
      .select("id")
      .eq("id", sectionId)
      .eq("bag_id", bag.id)
      .eq("is_active", true)
      .single();

    if (
      sectionError ||
      !section
    ) {
      return NextResponse.json(
        {
          error:
            "Compartiment introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data: medicalItem,
      error: medicalItemError,
    } = await supabaseAdmin
      .from("medical_items")
      .select("id")
      .eq("id", medicalItemId)
      .eq("is_active", true)
      .single();

    if (
      medicalItemError ||
      !medicalItem
    ) {
      return NextResponse.json(
        {
          error:
            "Article pharmacie introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data: existing,
      error: existingError,
    } = await supabaseAdmin
      .from(
        "rescue_bag_expected_items"
      )
      .select(`
        id,
        is_active
      `)
      .eq("section_id", sectionId)
      .eq(
        "medical_item_id",
        medicalItemId
      )
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error:
            "Impossible de vérifier si l'article existe déjà.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      existing &&
      existing.is_active
    ) {
      return NextResponse.json(
        {
          error:
            "Cet article est déjà présent dans ce compartiment.",
        },
        {
          status: 409,
        }
      );
    }

    if (existing) {
      const {
        error:
          reactivateError,
      } = await supabaseAdmin
        .from(
          "rescue_bag_expected_items"
        )
        .update({
          is_active:
            true,
          expected_quantity:
            expectedQuantity,
          is_required:
            isRequired,
          display_order:
            displayOrder,
          notes,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (reactivateError) {
        return NextResponse.json(
          {
            error:
              "Impossible de réactiver cet article.",
          },
          {
            status: 500,
          }
        );
      }
    } else {
      const {
        error: insertError,
      } = await supabaseAdmin
        .from(
          "rescue_bag_expected_items"
        )
        .insert({
          section_id:
            sectionId,
          medical_item_id:
            medicalItemId,
          expected_quantity:
            expectedQuantity,
          is_required:
            isRequired,
          display_order:
            displayOrder,
          notes,
          is_active:
            true,
        });

      if (insertError) {
        console.error(
          "Erreur ajout article :",
          insertError
        );

        return NextResponse.json(
          {
            error:
              "Impossible d'ajouter l'article.",
          },
          {
            status: 500,
          }
        );
      }
    }

    return NextResponse.json(
      {
        message:
          "Article ajouté au compartiment.",
      },
      {
        status: 201,
      }
    );
  }

  return NextResponse.json(
    {
      error:
        "Action de configuration inconnue.",
    },
    {
      status: 400,
    }
  );
}

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  const { id } = await context.params;
  const bagCode = resolveBagCode(id);
  const {
    error,
  } = await authenticate(request);

  if (error) {
    return error;
  }

  let body: any;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "La requête est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: bag,
  } = await getBag(bagCode);

  if (!bag) {
    return NextResponse.json(
      {
        error:
          "Sac PS VPI introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    body.action ===
    "disable_section"
  ) {
    const sectionId =
      typeof body.sectionId ===
        "string"
        ? body.sectionId
        : "";

    if (!sectionId) {
      return NextResponse.json(
        {
          error:
            "Compartiment invalide.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      error: updateError,
    } = await supabaseAdmin
      .from(
        "rescue_bag_sections"
      )
      .update({
        is_active:
          false,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", sectionId)
      .eq("bag_id", bag.id);

    if (updateError) {
      console.error(
        "Erreur désactivation compartiment :",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de retirer le compartiment.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      message:
        "Compartiment retiré.",
    });
  }

  if (
    body.action ===
    "remove_item"
  ) {
    const expectedItemId =
      typeof body.expectedItemId ===
        "string"
        ? body.expectedItemId
        : "";

    if (!expectedItemId) {
      return NextResponse.json(
        {
          error:
            "Article invalide.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: expectedItem,
      error: expectedItemError,
    } = await supabaseAdmin
      .from(
        "rescue_bag_expected_items"
      )
      .select(`
        id,
        section_id,
        rescue_bag_sections!inner (
          bag_id
        )
      `)
      .eq("id", expectedItemId)
      .eq(
        "rescue_bag_sections.bag_id",
        bag.id
      )
      .eq("is_active", true)
      .single();

    if (
      expectedItemError ||
      !expectedItem
    ) {
      return NextResponse.json(
        {
          error:
            "Article attendu introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      error: updateError,
    } = await supabaseAdmin
      .from(
        "rescue_bag_expected_items"
      )
      .update({
        is_active:
          false,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", expectedItemId);

    if (updateError) {
      console.error(
        "Erreur retrait article :",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Impossible de retirer l'article.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      message:
        "Article retiré du compartiment.",
    });
  }

  return NextResponse.json(
    {
      error:
        "Action de configuration inconnue.",
    },
    {
      status: 400,
    }
  );
}