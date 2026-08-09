import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const CONTROL_TIME_ZONE =
  "Europe/Paris";

type BusinessRoleAssignment = {
  business_roles:
    | { code: string }
    | { code: string }[]
    | null;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UnlockReasonCode =
  | "formation"
  | "verification_error"
  | "incomplete_verification"
  | "other";

type UnlockPayload = {
  reasonCode?: UnlockReasonCode;
  reasonDetail?: string;
};

const BAG_CODE_ALIASES: Record<string, string> = {
  psvpi: "ps_vpi",
  ps_vpi: "ps_vpi",

  oxygenotherapie:
    "oxygenotherapie_vpi",
  oxygenotherapie_vpi:
    "oxygenotherapie_vpi",
  oxy:
    "oxygenotherapie_vpi",
  oxyvpi:
    "oxygenotherapie_vpi",
  oxy_vpi:
    "oxygenotherapie_vpi",

  psfpt: "ps_fpt",
  ps_fpt: "ps_fpt",
};

function resolveBagCode(value: string) {
  const normalized =
    value.trim().toLowerCase();

  return (
    BAG_CODE_ALIASES[normalized] ??
    normalized
  );
}

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
  if (!supabaseUrl || !supabaseAnonKey) {
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

function getTimeZoneParts(
  date: Date,
  timeZone: string
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        weekday: "short",
      }
    );

  const parts =
    formatter.formatToParts(date);

  const get = (type: string) =>
    parts.find(
      (part) => part.type === type
    )?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"),
  };
}

function getTimeZoneOffsetMs(
  date: Date,
  timeZone: string
) {
  const parts =
    getTimeZoneParts(
      date,
      timeZone
    );

  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return asUtc - date.getTime();
}

function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
) {
  const initial = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      0
    )
  );

  const firstOffset =
    getTimeZoneOffsetMs(
      initial,
      timeZone
    );

  let result = new Date(
    initial.getTime() -
      firstOffset
  );

  const correctedOffset =
    getTimeZoneOffsetMs(
      result,
      timeZone
    );

  if (
    correctedOffset !== firstOffset
  ) {
    result = new Date(
      initial.getTime() -
        correctedOffset
    );
  }

  return result;
}

function getCurrentCycleStart(
  now = new Date()
) {
  const parts =
    getTimeZoneParts(
      now,
      CONTROL_TIME_ZONE
    );

  const weekdayIndex:
    Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

  const currentWeekday =
    weekdayIndex[
      parts.weekday
    ] ?? 1;

  const daysSinceMonday =
    (currentWeekday + 6) % 7;

  const localMonday =
    new Date(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day
      )
    );

  localMonday.setUTCDate(
    localMonday.getUTCDate() -
      daysSinceMonday
  );

  let cycleStart =
    zonedLocalToUtc(
      localMonday.getUTCFullYear(),
      localMonday.getUTCMonth() + 1,
      localMonday.getUTCDate(),
      12,
      0,
      CONTROL_TIME_ZONE
    );

  if (now < cycleStart) {
    localMonday.setUTCDate(
      localMonday.getUTCDate() - 7
    );

    cycleStart =
      zonedLocalToUtc(
        localMonday.getUTCFullYear(),
        localMonday.getUTCMonth() + 1,
        localMonday.getUTCDate(),
        12,
        0,
        CONTROL_TIME_ZONE
      );
  }

  return cycleStart.toISOString();
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  const { id } =
    await context.params;

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

  const requestSupabase =
    createRequestSupabase(accessToken);

  if (!requestSupabase) {
    return NextResponse.json(
      {
        error:
          "Configuration serveur incomplète.",
      },
      {
        status: 500,
      }
    );
  }

  const {
    data: { user },
    error: userError,
  } =
    await requestSupabase.auth.getUser(
      accessToken
    );

  if (userError || !user) {
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

  const {
    data: profile,
    error: profileError,
  } = await requestSupabase
    .from("profiles")
    .select(
      "id, first_name, last_name, access_role"
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      {
        error:
          "Profil utilisateur introuvable.",
      },
      {
        status: 403,
      }
    );
  }

  let canUnlock =
    profile.access_role === "admin";

  if (!canUnlock) {
    const {
      data: assignments,
      error: assignmentsError,
    } = await requestSupabase
      .from(
        "profile_business_roles"
      )
      .select(`
        business_roles!inner (
          code
        )
      `)
      .eq(
        "profile_id",
        user.id
      );

    if (assignmentsError) {
      return NextResponse.json(
        {
          error:
            "Impossible de vérifier vos droits.",
        },
        {
          status: 403,
        }
      );
    }

    const roleCodes = (
      (assignments ?? []) as
        BusinessRoleAssignment[]
    )
      .map(getBusinessRoleCode)
      .filter(
        (code): code is string =>
          Boolean(code)
      )
      .map((code) =>
        code
          .trim()
          .toLowerCase()
      );

    canUnlock =
      roleCodes.includes(
        "responsable_pharmacie"
      );
  }

  if (!canUnlock) {
    return NextResponse.json(
      {
        error:
          "Seul le responsable pharmacie peut déverrouiller un contrôle.",
      },
      {
        status: 403,
      }
    );
  }

  let payload: UnlockPayload = {};

  try {
    payload =
      (await request.json()) as
        UnlockPayload;
  } catch {
    payload = {};
  }

  const allowedReasonCodes:
    UnlockReasonCode[] = [
      "formation",
      "verification_error",
      "incomplete_verification",
      "other",
    ];

  const reasonCode =
    typeof payload.reasonCode === "string" &&
    allowedReasonCodes.includes(
      payload.reasonCode as UnlockReasonCode
    )
      ? (payload.reasonCode as UnlockReasonCode)
      : null;

  const reasonDetail =
    typeof payload.reasonDetail === "string"
      ? payload.reasonDetail.trim()
      : "";

  if (!reasonCode) {
    return NextResponse.json(
      {
        error:
          "Le motif du déverrouillage est obligatoire.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    reasonCode === "other" &&
    !reasonDetail
  ) {
    return NextResponse.json(
      {
        error:
          "Merci de préciser le motif du déverrouillage.",
      },
      {
        status: 400,
      }
    );
  }

  const reasonLabels:
    Record<UnlockReasonCode, string> = {
      formation: "Formation",
      verification_error:
        "Erreur de vérification",
      incomplete_verification:
        "Vérification incomplète",
      other: "Autre",
    };

  const reason =
    reasonCode === "other"
      ? `${reasonLabels[reasonCode]} : ${reasonDetail}`
      : reasonLabels[reasonCode];

  const bagCode =
    resolveBagCode(id);

  const {
    data: bag,
    error: bagError,
  } = await supabaseAdmin
    .from("rescue_bags")
    .select("id, code, name")
    .eq("code", bagCode)
    .eq("is_active", true)
    .single();

  if (bagError || !bag) {
    return NextResponse.json(
      {
        error:
          "Le sac demandé est introuvable.",
      },
      {
        status: 404,
      }
    );
  }

  const cycleStartsAt =
    getCurrentCycleStart();

  const {
    data: latestCheck,
    error: latestCheckError,
  } = await supabaseAdmin
    .from("rescue_bag_checks")
    .select(`
      id,
      checked_at,
      checked_by_name
    `)
    .eq("bag_id", bag.id)
    .gte(
      "checked_at",
      cycleStartsAt
    )
    .order("checked_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (latestCheckError) {
    console.error(
      "Erreur recherche dernier contrôle :",
      latestCheckError
    );

    return NextResponse.json(
      {
        error:
          "Impossible de vérifier le dernier contrôle.",
      },
      {
        status: 500,
      }
    );
  }

  if (!latestCheck) {
    return NextResponse.json(
      {
        error:
          "Ce sac n'a pas encore été contrôlé sur le cycle en cours.",
      },
      {
        status: 409,
      }
    );
  }

  const fullName = [
    profile.first_name,
    profile.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const unlockedByName =
    fullName ||
    user.email ||
    "Responsable pharmacie";

  const unlockedAt =
    new Date().toISOString();

  const {
    data: unlock,
    error: unlockError,
  } = await supabaseAdmin
    .from(
      "rescue_bag_control_unlocks"
    )
    .upsert(
      {
        bag_id: bag.id,
        cycle_starts_at:
          cycleStartsAt,
        unlocked_at:
          unlockedAt,
        unlocked_by:
          user.id,
        unlocked_by_name:
          unlockedByName,
        reason,
        reason_code:
          reasonCode,
        reason_detail:
          reasonDetail || null,
      },
      {
        onConflict:
          "bag_id,cycle_starts_at",
      }
    )
    .select(`
      id,
      bag_id,
      cycle_starts_at,
      unlocked_at,
      unlocked_by,
      unlocked_by_name,
      reason,
      reason_code,
      reason_detail
    `)
    .single();

  if (unlockError || !unlock) {
    console.error(
      "Erreur déverrouillage contrôle sac :",
      unlockError
    );

    return NextResponse.json(
      {
        error:
          "Le contrôle n'a pas pu être déverrouillé.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    message:
      "Contrôle déverrouillé. Une nouvelle vérification peut être réalisée.",
    bag: {
      id: bag.id,
      code: bag.code,
      name: bag.name,
    },
    unlock,
  });
}