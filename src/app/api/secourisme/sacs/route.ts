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

const PARIS_TIME_ZONE = "Europe/Paris";

const RESCUE_BAG_READ_ROLES = [
  "sapeur_pompier",
  "responsable_pharmacie",
  "chef_centre",
  "adjoint_chef_centre",
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

type RescueBagRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
};

type RescueBagCheckRow = {
  id: string;
  bag_id: string;
  checked_by: string | null;
  checked_by_name: string | null;
  status: string;
  notes: string | null;
  checked_at: string;
};

type PermissionResult = {
  canRead: boolean;
  isAdmin: boolean;
  profile: CurrentProfile | null;
  roleCodes: string[];
};

type BagDisplayStatus =
  | "to_check"
  | "checked"
  | "checked_with_issue";

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

async function getRescueBagPermission(
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
    .eq("id", currentUserId)
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
      isAdmin: false,
      profile: null,
      roleCodes: [],
    };
  }

  const profile =
    profileData as CurrentProfile;

  if (
    profile.access_role === "admin"
  ) {
    return {
      canRead: true,
      isAdmin: true,
      profile,
      roleCodes: [],
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
      isAdmin: false,
      profile,
      roleCodes: [],
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
      RESCUE_BAG_READ_ROLES.includes(
        code as
          (typeof RESCUE_BAG_READ_ROLES)[number]
      )
    );

  return {
    canRead,
    isAdmin: false,
    profile,
    roleCodes,
  };
}

function getParisParts(date: Date) {
  const formatter =
    new Intl.DateTimeFormat(
      "fr-FR",
      {
        timeZone: PARIS_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }
    );

  const parts =
    formatter.formatToParts(date);

  const map =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !== "literal"
        )
        .map((part) => [
          part.type,
          part.value,
        ])
    );

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function getTimeZoneOffsetMs(
  date: Date,
  timeZone: string
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }
    );

  const parts =
    formatter.formatToParts(date);

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !== "literal"
        )
        .map((part) => [
          part.type,
          part.value,
        ])
    );

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return asUtc - date.getTime();
}

function parisLocalDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0
) {
  const utcGuess = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  let candidate =
    new Date(utcGuess);

  let offset =
    getTimeZoneOffsetMs(
      candidate,
      PARIS_TIME_ZONE
    );

  candidate =
    new Date(
      utcGuess - offset
    );

  offset =
    getTimeZoneOffsetMs(
      candidate,
      PARIS_TIME_ZONE
    );

  return new Date(
    utcGuess - offset
  );
}

function addUtcDays(
  year: number,
  month: number,
  day: number,
  days: number
) {
  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day + days
    )
  );

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getWeeklyCycle(
  now = new Date()
) {
  const parisNow =
    getParisParts(now);

  const localCalendarDate =
    new Date(
      Date.UTC(
        parisNow.year,
        parisNow.month - 1,
        parisNow.day
      )
    );

  const jsDay =
    localCalendarDate.getUTCDay();

  let daysSinceMonday =
    (jsDay + 6) % 7;

  const isMondayBeforeNoon =
    daysSinceMonday === 0 &&
    parisNow.hour < 12;

  if (isMondayBeforeNoon) {
    daysSinceMonday = 7;
  }

  const monday =
    addUtcDays(
      parisNow.year,
      parisNow.month,
      parisNow.day,
      -daysSinceMonday
    );

  const start =
    parisLocalDateTimeToUtc(
      monday.year,
      monday.month,
      monday.day,
      12,
      0,
      0
    );

  const nextMonday =
    addUtcDays(
      monday.year,
      monday.month,
      monday.day,
      7
    );

  const end =
    parisLocalDateTimeToUtc(
      nextMonday.year,
      nextMonday.month,
      nextMonday.day,
      12,
      0,
      0
    );

  return {
    start,
    end,
  };
}

function getBagDisplayStatus(
  check: RescueBagCheckRow | null
): BagDisplayStatus {
  if (!check) {
    return "to_check";
  }

  const raw =
    check.status
      .trim()
      .toLowerCase();

  // Statuts réellement autorisés dans rescue_bag_checks :
  // operational = contrôle conforme
  // incomplete  = contrôle terminé avec au moins une anomalie
  if (raw === "incomplete") {
    return "checked_with_issue";
  }

  if (raw === "operational") {
    return "checked";
  }

  // Sécurité pour d'éventuels anciens statuts/libellés.
  const hasIssue =
    raw.includes("anomal") ||
    raw.includes("issue") ||
    raw.includes("problem") ||
    raw.includes("non_conforme") ||
    raw.includes("non-conforme");

  return hasIssue
    ? "checked_with_issue"
    : "checked";
}

export async function GET(
  request: Request
) {
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
    createRequestSupabase(
      accessToken
    );

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

  const permission =
    await getRescueBagPermission(
      requestSupabase,
      currentUser.id
    );

  if (
    !permission.canRead
  ) {
    return NextResponse.json(
      {
        error:
          "Vous n'êtes pas autorisé à consulter le suivi des sacs de secours.",
      },
      {
        status: 403,
      }
    );
  }

  const {
    data: bagsData,
    error: bagsError,
  } = await supabaseAdmin
    .from("rescue_bags")
    .select(`
      id,
      code,
      name,
      description,
      is_active,
      display_order
    `)
    .eq("is_active", true)
    .order(
      "display_order",
      {
        ascending: true,
      }
    )
    .order(
      "name",
      {
        ascending: true,
      }
    );

  if (bagsError) {
    console.error(
      "Impossible de récupérer les sacs de secours :",
      bagsError
    );

    return NextResponse.json(
      {
        error:
          "Les sacs de secours n'ont pas pu être récupérés.",
      },
      {
        status: 500,
      }
    );
  }

  const bags =
    (bagsData ?? []) as
      RescueBagRow[];

  const cycle =
    getWeeklyCycle();

  if (bags.length === 0) {
    return NextResponse.json({
      cycle: {
        timeZone:
          PARIS_TIME_ZONE,
        startsAt:
          cycle.start.toISOString(),
        endsAt:
          cycle.end.toISOString(),
        resetRule:
          "Chaque lundi à 12h00",
      },
      bags: [],
      permissions: {
        canRead: true,
        isAdmin:
          permission.isAdmin,
        roleCodes:
          permission.roleCodes,
      },
    });
  }

  const bagIds =
    bags.map((bag) => bag.id);

  const {
    data: checksData,
    error: checksError,
  } = await supabaseAdmin
    .from("rescue_bag_checks")
    .select(`
      id,
      bag_id,
      checked_by,
      checked_by_name,
      status,
      notes,
      checked_at
    `)
    .in("bag_id", bagIds)
    .gte(
      "checked_at",
      cycle.start.toISOString()
    )
    .lt(
      "checked_at",
      cycle.end.toISOString()
    )
    .order(
      "checked_at",
      {
        ascending: false,
      }
    );

  if (checksError) {
    console.error(
      "Impossible de récupérer les contrôles des sacs :",
      checksError
    );

    return NextResponse.json(
      {
        error:
          "Les contrôles des sacs n'ont pas pu être récupérés.",
      },
      {
        status: 500,
      }
    );
  }

  const checks =
    (checksData ?? []) as
      RescueBagCheckRow[];

  const latestCheckByBag =
    new Map<
      string,
      RescueBagCheckRow
    >();

  for (const check of checks) {
    if (
      !latestCheckByBag.has(
        check.bag_id
      )
    ) {
      latestCheckByBag.set(
        check.bag_id,
        check
      );
    }
  }

  const responseBags =
    bags.map((bag) => {
      const latestCheck =
        latestCheckByBag.get(
          bag.id
        ) ?? null;

      return {
        id:
          bag.id,

        code:
          bag.code,

        name:
          bag.name,

        description:
          bag.description,

        displayOrder:
          bag.display_order,

        status:
          getBagDisplayStatus(
            latestCheck
          ),

        checked:
          Boolean(latestCheck),

        latestCheck:
          latestCheck
            ? {
                id:
                  latestCheck.id,

                rawStatus:
                  latestCheck.status,

                checkedAt:
                  latestCheck.checked_at,

                checkedBy:
                  latestCheck.checked_by,

                checkedByName:
                  latestCheck.checked_by_name,

                notes:
                  latestCheck.notes,
              }
            : null,
      };
    });

  const checkedCount =
    responseBags.filter(
      (bag) =>
        bag.status === "checked"
    ).length;

  const checkedWithIssueCount =
    responseBags.filter(
      (bag) =>
        bag.status ===
        "checked_with_issue"
    ).length;

  const toCheckCount =
    responseBags.filter(
      (bag) =>
        bag.status === "to_check"
    ).length;

  return NextResponse.json({
    cycle: {
      timeZone:
        PARIS_TIME_ZONE,

      startsAt:
        cycle.start.toISOString(),

      endsAt:
        cycle.end.toISOString(),

      resetRule:
        "Chaque lundi à 12h00",
    },

    summary: {
      total:
        responseBags.length,

      checked:
        checkedCount,

      checkedWithIssue:
        checkedWithIssueCount,

      toCheck:
        toCheckCount,
    },

    bags:
      responseBags,

    permissions: {
      canRead: true,

      isAdmin:
        permission.isAdmin,

      roleCodes:
        permission.roleCodes,
    },
  });
}