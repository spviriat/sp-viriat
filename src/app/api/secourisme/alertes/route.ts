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

const ALERT_READ_ROLES = [
  "responsable_pharmacie",
  "chef_centre",
  "adjoint_chef_centre",
] as const;

const ALERT_WRITE_ROLES = [
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

type AlertStatus =
  | "new"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "ignored";

type AlertSeverity =
  | "critical"
  | "high"
  | "medium"
  | "info";

type AlertType =
  | "stock_out"
  | "low_stock"
  | "expired_lot"
  | "expiration_30"
  | "expiration_90";

type UpdateAlertPayload = {
  id?: unknown;
  status?: unknown;
  ignoredReason?: unknown;
};

type MedicalItemRow = {
  id: string;
  name: string;
  quantity: number;
  minimum_quantity: number;
  location: string | null;
  is_active: boolean;
};

type ExpirationRow = {
  id: string;
  medical_item_id: string;
  quantity: number;
  expiration_date: string;
  notes: string | null;
};

type GeneratedAlert = {
  alert_key: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  medical_item_id: string;
  expiration_id: string | null;
  title: string;
  message: string;
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

async function getAlertPermission(
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
      ALERT_READ_ROLES.includes(
        code as
          (typeof ALERT_READ_ROLES)[number]
      )
    );

  const canWrite =
    roleCodes.some((code) =>
      ALERT_WRITE_ROLES.includes(
        code as
          (typeof ALERT_WRITE_ROLES)[number]
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
    await getAlertPermission(
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

function normalizeIgnoredReason(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
}

function isAlertStatus(
  value: unknown
): value is AlertStatus {
  return (
    value === "new" ||
    value === "acknowledged" ||
    value === "in_progress" ||
    value === "resolved" ||
    value === "ignored"
  );
}

function startOfToday() {
  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  return today;
}

function getDaysRemaining(
  expirationDate: string
) {
  const today =
    startOfToday();

  const expiration =
    new Date(
      `${expirationDate}T00:00:00`
    );

  return Math.floor(
    (
      expiration.getTime() -
      today.getTime()
    ) /
      86_400_000
  );
}

async function generateCurrentAlerts() {
  const [
    {
      data: itemsData,
      error: itemsError,
    },
    {
      data: expirationsData,
      error: expirationsError,
    },
  ] =
    await Promise.all([
      supabaseAdmin
        .from("medical_items")
        .select(`
          id,
          name,
          quantity,
          minimum_quantity,
          location,
          is_active
        `)
        .eq(
          "is_active",
          true
        ),

      supabaseAdmin
        .from(
          "medical_item_expirations"
        )
        .select(`
          id,
          medical_item_id,
          quantity,
          expiration_date,
          notes
        `)
        .gt(
          "quantity",
          0
        ),
    ]);

  if (itemsError) {
    throw itemsError;
  }

  if (expirationsError) {
    throw expirationsError;
  }

  const items =
    (itemsData ??
      []) as MedicalItemRow[];

  const expirations =
    (expirationsData ??
      []) as ExpirationRow[];

  const itemById =
    new Map(
      items.map(
        (item) => [
          item.id,
          item,
        ]
      )
    );

  const alerts:
    GeneratedAlert[] = [];

  for (const item of items) {
    if (item.quantity <= 0) {
      alerts.push({
        alert_key:
          `stock_out:${item.id}`,

        alert_type:
          "stock_out",

        severity:
          "critical",

        medical_item_id:
          item.id,

        expiration_id:
          null,

        title:
          `Rupture de stock — ${item.name}`,

        message:
          `Le stock de ${item.name} est à 0${
            item.location
              ? ` (${item.location})`
              : ""
          }.`,
      });

      continue;
    }

    if (
      item.quantity <=
      item.minimum_quantity
    ) {
      alerts.push({
        alert_key:
          `low_stock:${item.id}`,

        alert_type:
          "low_stock",

        severity:
          "high",

        medical_item_id:
          item.id,

        expiration_id:
          null,

        title:
          `Stock faible — ${item.name}`,

        message:
          `${item.quantity} unité(s) disponible(s), seuil minimum : ${item.minimum_quantity}.`,
      });
    }
  }

  for (
    const expiration of
      expirations
  ) {
    const item =
      itemById.get(
        expiration.medical_item_id
      );

    if (!item) {
      continue;
    }

    const daysRemaining =
      getDaysRemaining(
        expiration.expiration_date
      );

    if (daysRemaining < 0) {
      alerts.push({
        alert_key:
          `expired:${expiration.id}`,

        alert_type:
          "expired_lot",

        severity:
          "critical",

        medical_item_id:
          item.id,

        expiration_id:
          expiration.id,

        title:
          `Lot expiré — ${item.name}`,

        message:
          `${expiration.quantity} unité(s) expirée(s) depuis le ${expiration.expiration_date}.`,
      });

      continue;
    }

    if (daysRemaining <= 30) {
      alerts.push({
        alert_key:
          `expiration_30:${expiration.id}`,

        alert_type:
          "expiration_30",

        severity:
          "high",

        medical_item_id:
          item.id,

        expiration_id:
          expiration.id,

        title:
          `Péremption proche — ${item.name}`,

        message:
          `${expiration.quantity} unité(s) expire(nt) dans ${daysRemaining} jour(s), le ${expiration.expiration_date}.`,
      });

      continue;
    }

    if (daysRemaining <= 90) {
      alerts.push({
        alert_key:
          `expiration_90:${expiration.id}`,

        alert_type:
          "expiration_90",

        severity:
          "medium",

        medical_item_id:
          item.id,

        expiration_id:
          expiration.id,

        title:
          `Péremption à surveiller — ${item.name}`,

        message:
          `${expiration.quantity} unité(s) expire(nt) dans ${daysRemaining} jour(s), le ${expiration.expiration_date}.`,
      });
    }
  }

  return {
    alerts,
    items,
    expirations,
  };
}

async function syncAlerts() {
  const {
    alerts,
    items,
    expirations,
  } =
    await generateCurrentAlerts();

  const activeKeys =
    new Set(
      alerts.map(
        (alert) =>
          alert.alert_key
      )
    );

  const {
    data: existingData,
    error: existingError,
  } = await supabaseAdmin
    .from("medical_alerts")
    .select(`
      id,
      alert_key,
      alert_type,
      severity,
      medical_item_id,
      expiration_id,
      title,
      message,
      status,
      ignored_reason,
      assigned_to,
      acknowledged_by,
      acknowledged_at,
      resolved_by,
      resolved_at,
      created_at,
      updated_at
    `)
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (existingError) {
    throw existingError;
  }

  const existingAlerts =
    existingData ?? [];

  const existingByKey =
    new Map(
      existingAlerts.map(
        (alert) => [
          alert.alert_key,
          alert,
        ]
      )
    );

  for (
    const generated of alerts
  ) {
    const existing =
      existingByKey.get(
        generated.alert_key
      );

    if (!existing) {
      const {
        error: insertError,
      } = await supabaseAdmin
        .from("medical_alerts")
        .upsert(
          {
            ...generated,
            status: "new",
          },
          {
            onConflict:
              "alert_key",

            ignoreDuplicates:
              true,
          }
        );

      if (insertError) {
        throw insertError;
      }

      continue;
    }

    const shouldReopen =
      existing.status ===
        "resolved";

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("medical_alerts")
      .update({
        alert_type:
          generated.alert_type,

        severity:
          generated.severity,

        medical_item_id:
          generated.medical_item_id,

        expiration_id:
          generated.expiration_id,

        title:
          generated.title,

        message:
          generated.message,

        ...(shouldReopen
          ? {
              status: "new",
              resolved_by: null,
              resolved_at: null,
            }
          : {}),

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        existing.id
      );

    if (updateError) {
      throw updateError;
    }
  }

  for (
    const existing of
      existingAlerts
  ) {
    if (
      activeKeys.has(
        existing.alert_key
      )
    ) {
      continue;
    }

    if (
      existing.status ===
        "resolved" ||
      existing.status ===
        "ignored"
    ) {
      continue;
    }

    const {
      error: resolveError,
    } = await supabaseAdmin
      .from("medical_alerts")
      .update({
        status:
          "resolved",

        resolved_by:
          null,

        resolved_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        existing.id
      );

    if (resolveError) {
      throw resolveError;
    }
  }

  const {
    data: syncedAlerts,
    error: syncedError,
  } = await supabaseAdmin
    .from("medical_alerts")
    .select(`
      id,
      alert_key,
      alert_type,
      severity,
      medical_item_id,
      expiration_id,
      title,
      message,
      status,
      ignored_reason,
      assigned_to,
      acknowledged_by,
      acknowledged_at,
      resolved_by,
      resolved_at,
      created_at,
      updated_at
    `)
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(500);

  if (syncedError) {
    throw syncedError;
  }

  const itemById =
    new Map(
      items.map(
        (item) => [
          item.id,
          item,
        ]
      )
    );

  const expirationById =
    new Map(
      expirations.map(
        (expiration) => [
          expiration.id,
          expiration,
        ]
      )
    );

  return (
    syncedAlerts ?? []
  ).map(
    (alert) => ({
      ...alert,

      is_active_condition:
        activeKeys.has(
          alert.alert_key
        ),

      article:
        alert.medical_item_id
          ? itemById.get(
              alert.medical_item_id
            ) ?? null
          : null,

      expiration:
        alert.expiration_id
          ? expirationById.get(
              alert.expiration_id
            ) ?? null
          : null,
    })
  );
}

export async function GET(
  request: Request
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
          "Vous n'êtes pas autorisé à consulter les alertes pharmacie.",
      },
      {
        status: 403,
      }
    );
  }

  try {
    const alerts =
      await syncAlerts();

    return NextResponse.json({
      alerts,

      permissions: {
        canRead:
          permission.canRead,

        canWrite:
          permission.canWrite,
      },
    });
  } catch (syncError) {
    console.error(
      "Impossible de synchroniser les alertes :",
      syncError
    );

    return NextResponse.json(
      {
        error:
          "Les alertes pharmacie n'ont pas pu être chargées.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(
  request: Request
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
    !permission.profile ||
    !permission.canWrite
  ) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à modifier les alertes pharmacie.",
      },
      {
        status: 403,
      }
    );
  }

  let payload:
    UpdateAlertPayload;

  try {
    payload =
      (await request.json()) as
        UpdateAlertPayload;
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

  const alertId =
    typeof payload.id ===
      "string"
      ? payload.id.trim()
      : "";

  if (!alertId) {
    return NextResponse.json(
      {
        error:
          "L'alerte est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !isAlertStatus(
      payload.status
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Le statut sélectionné est invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const ignoredReason =
    normalizeIgnoredReason(
      payload.ignoredReason
    );

  if (
    payload.status ===
      "ignored" &&
    !ignoredReason
  ) {
    return NextResponse.json(
      {
        error:
          "Un motif est obligatoire pour ignorer une alerte.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: existingAlert,
    error: existingError,
  } = await supabaseAdmin
    .from("medical_alerts")
    .select(`
      id,
      alert_key,
      alert_type,
      severity,
      medical_item_id,
      expiration_id,
      title,
      message,
      status,
      ignored_reason,
      acknowledged_by,
      acknowledged_at,
      resolved_by,
      resolved_at
    `)
    .eq(
      "id",
      alertId
    )
    .maybeSingle();

  if (
    existingError ||
    !existingAlert
  ) {
    return NextResponse.json(
      {
        error:
          "Cette alerte est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const now =
    new Date().toISOString();

  const nextStatus =
    payload.status;

  const updatePayload: {
    status: AlertStatus;
    ignored_reason: string | null;
    acknowledged_by?: string | null;
    acknowledged_at?: string | null;
    resolved_by?: string | null;
    resolved_at?: string | null;
    updated_at: string;
  } = {
    status:
      nextStatus,

    ignored_reason:
      nextStatus ===
        "ignored"
        ? ignoredReason
        : null,

    updated_at:
      now,
  };

  if (
    nextStatus ===
      "acknowledged" ||
    nextStatus ===
      "in_progress"
  ) {
    updatePayload.acknowledged_by =
      existingAlert.acknowledged_by ??
      currentUser.id;

    updatePayload.acknowledged_at =
      existingAlert.acknowledged_at ??
      now;

    updatePayload.resolved_by =
      null;

    updatePayload.resolved_at =
      null;
  }

  if (
    nextStatus === "new"
  ) {
    updatePayload.acknowledged_by =
      null;

    updatePayload.acknowledged_at =
      null;

    updatePayload.resolved_by =
      null;

    updatePayload.resolved_at =
      null;
  }

  if (
    nextStatus === "resolved"
  ) {
    updatePayload.resolved_by =
      currentUser.id;

    updatePayload.resolved_at =
      now;
  }

  if (
    nextStatus === "ignored"
  ) {
    updatePayload.resolved_by =
      null;

    updatePayload.resolved_at =
      null;
  }

  const {
    data: updatedAlert,
    error: updateError,
  } = await supabaseAdmin
    .from("medical_alerts")
    .update(
      updatePayload
    )
    .eq(
      "id",
      alertId
    )
    .select(`
      id,
      alert_key,
      alert_type,
      severity,
      medical_item_id,
      expiration_id,
      title,
      message,
      status,
      ignored_reason,
      assigned_to,
      acknowledged_by,
      acknowledged_at,
      resolved_by,
      resolved_at,
      created_at,
      updated_at
    `)
    .single();

  if (
    updateError ||
    !updatedAlert
  ) {
    console.error(
      "Impossible de modifier le statut de l'alerte :",
      updateError
    );

    return NextResponse.json(
      {
        error:
          "Le statut de l'alerte n'a pas pu être modifié.",
      },
      {
        status: 500,
      }
    );
  }

  const actorName =
    getActorName(
      permission.profile,
      currentUser.email
    );

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
        "UPDATE_MEDICAL_ALERT_STATUS",

      target_profile_id:
        null,

      target_name:
        existingAlert.title,

      target_email:
        null,

      module:
        "secourisme",

      details: {
        alert_id:
          existingAlert.id,

        alert_key:
          existingAlert.alert_key,

        previous_status:
          existingAlert.status,

        new_status:
          nextStatus,

        ignored_reason:
          ignoredReason,
      },
    });

  if (auditError) {
    console.error(
      "Statut d'alerte modifié, mais audit impossible :",
      auditError
    );
  }

  return NextResponse.json({
    message:
      "Le statut de l'alerte a été mis à jour.",

    alert:
      updatedAlert,
  });
}