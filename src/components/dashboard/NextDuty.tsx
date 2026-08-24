"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Loader2, ShieldCheck, UserRound } from "lucide-react";

import { supabase } from "@/lib/supabase";

type GuardType =
  | "first_departure"
  | "second_departure"
  | "observer";

type GuardAvailability = {
  availability_id: string;
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  guard_date: string;
  guard_type: GuardType;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function formatLongDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  const formatted = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day));

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function displayName(person: GuardAvailability) {
  const firstName = person.first_name?.trim() ?? "";
  const lastName = person.last_name?.trim().toUpperCase() ?? "";

  return `${firstName} ${lastName}`.trim() || "Sapeur-pompier";
}

function guardLabel(type: GuardType) {
  if (type === "first_departure") return "1er départ";
  if (type === "second_departure") return "2e départ";
  return "Observateur";
}

export default function NextDuty() {
  const [userId, setUserId] = useState<string | null>(null);
  const [availabilities, setAvailabilities] = useState<GuardAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadNextDuty() {
      setIsLoading(true);
      setHasError(false);

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          throw new Error("Session indisponible.");
        }

        const today = new Date();
        const end = new Date(today);
        end.setDate(end.getDate() + 120);

        const { data, error } = await supabase.rpc("get_guard_calendar", {
          p_start_date: dateKey(today),
          p_end_date: dateKey(end),
        });

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setUserId(session.user.id);
          setAvailabilities((data ?? []) as GuardAvailability[]);
        }
      } catch (error) {
        console.error("Erreur prochaine garde :", error);

        if (!cancelled) {
          setHasError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadNextDuty();

    return () => {
      cancelled = true;
    };
  }, []);

  const nextDuty = useMemo(() => {
    if (!userId) return null;

    return (
      availabilities
        .filter((item) => item.profile_id === userId)
        .sort((a, b) => a.guard_date.localeCompare(b.guard_date))[0] ?? null
    );
  }, [availabilities, userId]);

  const colleagues = useMemo(() => {
    if (!nextDuty || nextDuty.guard_type !== "first_departure") {
      return [];
    }

    return availabilities.filter(
      (item) =>
        item.guard_date === nextDuty.guard_date &&
        item.guard_type === "first_departure" &&
        item.profile_id !== userId
    );
  }, [availabilities, nextDuty, userId]);

  // Rouge uniquement lorsque la prochaine garde est celle de ce soir.
  // Une garde future reste verte.
  const isTonight = nextDuty?.guard_date === dateKey(new Date());

  const cardClass = isTonight
    ? "from-red-600 to-red-700"
    : "from-emerald-600 to-emerald-700";

  const softTextClass = isTonight
    ? "text-red-100"
    : "text-emerald-100";

  const buttonTextClass = isTonight
    ? "text-red-600 hover:bg-red-50"
    : "text-emerald-700 hover:bg-emerald-50";

  if (isLoading) {
    return (
      <section className="rounded-3xl bg-gradient-to-br from-slate-700 to-slate-800 p-6 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-200">
          Ma prochaine garde
        </p>

        <div className="flex min-h-[170px] items-center justify-center">
          <Loader2 className="animate-spin" size={28} />
        </div>
      </section>
    );
  }

  if (hasError) {
    return (
      <section className="rounded-3xl bg-gradient-to-br from-slate-700 to-slate-800 p-6 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-200">
          Ma prochaine garde
        </p>

        <h2 className="mt-3 text-2xl font-black">
          Planning indisponible
        </h2>

        <p className="mt-2 text-sm text-slate-200">
          Impossible de récupérer les gardes pour le moment.
        </p>

        <Link
          href="/dashboard/disponibilites"
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Voir mes disponibilités
        </Link>
      </section>
    );
  }

  if (!nextDuty) {
    return (
      <section className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">
          Ma prochaine garde
        </p>

        <h2 className="mt-3 text-2xl font-black">
          Aucune garde prévue
        </h2>

        <p className="mt-2 text-sm text-emerald-100">
          Vous n&apos;avez aucune garde enregistrée dans les 120 prochains jours.
        </p>

        <Link
          href="/dashboard/disponibilites"
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 font-bold text-emerald-700 transition hover:bg-emerald-50"
        >
          Ajouter une disponibilité
        </Link>
      </section>
    );
  }

  return (
    <section
      className={`rounded-3xl bg-gradient-to-br ${cardClass} p-6 text-white shadow-xl`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-widest ${softTextClass}`}
          >
            Ma prochaine garde
          </p>

          <h2 className="mt-2 text-3xl font-black">
            {formatLongDate(nextDuty.guard_date)}
          </h2>
        </div>

        {isTonight && (
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide">
            Ce soir
          </span>
        )}
      </div>

      <div className={`mt-3 flex items-center gap-2 ${softTextClass}`}>
        <Clock3 size={17} />
        <span className="font-bold">19:00 – 07:00</span>
      </div>

      <div className="mt-6 rounded-2xl bg-white/10 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} />
          <p className="text-sm font-black">
            {guardLabel(nextDuty.guard_type)}
          </p>
        </div>

        {nextDuty.guard_type === "first_departure" && (
          <div className={`mt-3 flex items-start gap-2 text-sm ${softTextClass}`}>
            <UserRound className="mt-0.5 shrink-0" size={16} />

            {colleagues.length > 0 ? (
              <p>
                <span className="font-semibold">Avec : </span>
                {colleagues.map(displayName).join(", ")}
              </p>
            ) : (
              <p className="font-semibold">
                Binôme à compléter
              </p>
            )}
          </div>
        )}
      </div>

      <Link
        href="/dashboard/disponibilites"
        className={`mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 font-bold transition ${buttonTextClass}`}
      >
        Voir mes disponibilités
      </Link>
    </section>
  );
}