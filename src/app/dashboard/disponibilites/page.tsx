"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

/* =========================================================
   TYPES
========================================================= */

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

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type DayData = {
  first: GuardAvailability[];
  second: GuardAvailability[];
  observers: GuardAvailability[];
};

const EMPTY_DAY: DayData = {
  first: [],
  second: [],
  observers: [],
};

const WEEK_DAYS = [
  "Lun",
  "Mar",
  "Mer",
  "Jeu",
  "Ven",
  "Sam",
  "Dim",
];

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/* =========================================================
   DATE HELPERS
========================================================= */

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(
  year: number,
  month: number,
  day: number
) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function todayKey() {
  const today = new Date();

  return dateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
}

function formatLongDate(value: string) {
  const [year, month, day] = value
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function getInitials(
  firstName: string | null,
  lastName: string | null
) {
  return `${firstName?.[0] ?? ""}${
    lastName?.[0] ?? ""
  }`.toUpperCase();
}

function getDisplayName(
  person: GuardAvailability
) {
  const lastName =
    person.last_name?.trim().toUpperCase() ?? "";

  const firstName =
    person.first_name?.trim() ?? "";

  return (
    `${lastName} ${firstName}`.trim() ||
    "Sapeur-pompier"
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function DisponibilitesPage() {
  const router = useRouter();

  const now = new Date();

  const [currentYear, setCurrentYear] =
    useState(now.getFullYear());

  const [currentMonth, setCurrentMonth] =
    useState(now.getMonth());

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [availabilities, setAvailabilities] =
    useState<GuardAvailability[]>([]);

  const [selectedDate, setSelectedDate] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [actionError, setActionError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  /* =======================================================
     CHARGEMENT
  ======================================================= */

  const loadCalendar = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace("/");
        return;
      }

      const startDate = dateKey(
        currentYear,
        currentMonth,
        1
      );

      const lastDay = new Date(
        currentYear,
        currentMonth + 1,
        0
      ).getDate();

      const endDate = dateKey(
        currentYear,
        currentMonth,
        lastDay
      );

      const [
        profileResult,
        calendarResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, first_name, last_name"
          )
          .eq("id", session.user.id)
          .single(),

        supabase.rpc(
          "get_guard_calendar",
          {
            p_start_date: startDate,
            p_end_date: endDate,
          }
        ),
      ]);

      if (
        profileResult.error ||
        !profileResult.data
      ) {
        throw new Error(
          "Impossible de récupérer votre profil."
        );
      }

      if (calendarResult.error) {
        throw new Error(
          calendarResult.error.message ||
            "Impossible de charger les gardes."
        );
      }

      setProfile(
        profileResult.data as Profile
      );

      setAvailabilities(
        (calendarResult.data ??
          []) as GuardAvailability[]
      );
    } catch (error) {
      console.error(
        "Erreur calendrier gardes :",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    currentMonth,
    currentYear,
    router,
  ]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  /* =======================================================
     DONNÉES PAR JOUR
  ======================================================= */

  const guardsByDate = useMemo(() => {
    const result = new Map<
      string,
      DayData
    >();

    for (const availability of availabilities) {
      const existing =
        result.get(
          availability.guard_date
        ) ?? {
          first: [],
          second: [],
          observers: [],
        };

      if (
        availability.guard_type ===
        "first_departure"
      ) {
        existing.first.push(
          availability
        );
      }

      if (
        availability.guard_type ===
        "second_departure"
      ) {
        existing.second.push(
          availability
        );
      }

      if (
        availability.guard_type ===
        "observer"
      ) {
        existing.observers.push(
          availability
        );
      }

      result.set(
        availability.guard_date,
        existing
      );
    }

    return result;
  }, [availabilities]);

  /* =======================================================
     CALENDRIER
  ======================================================= */

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      currentYear,
      currentMonth,
      1
    );

    const daysInMonth = new Date(
      currentYear,
      currentMonth + 1,
      0
    ).getDate();

    // JS : dimanche = 0
    // Nous voulons lundi = 0
    const offset =
      (firstDay.getDay() + 6) % 7;

    const cells: Array<
      | {
          day: number;
          key: string;
        }
      | null
    > = [];

    for (let i = 0; i < offset; i++) {
      cells.push(null);
    }

    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      cells.push({
        day,
        key: dateKey(
          currentYear,
          currentMonth,
          day
        ),
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [currentMonth, currentYear]);

  /* =======================================================
     NAVIGATION MOIS
  ======================================================= */

  const previousMonth = () => {
    setSelectedDate(null);

    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(
        (current) => current - 1
      );
      return;
    }

    setCurrentMonth(
      (current) => current - 1
    );
  };

  const nextMonth = () => {
    setSelectedDate(null);

    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(
        (current) => current + 1
      );
      return;
    }

    setCurrentMonth(
      (current) => current + 1
    );
  };

  const goToday = () => {
    const today = new Date();

    setCurrentYear(
      today.getFullYear()
    );

    setCurrentMonth(
      today.getMonth()
    );

    setSelectedDate(
      todayKey()
    );
  };

  /* =======================================================
     JOUR SÉLECTIONNÉ
  ======================================================= */

  const selectedDayData =
    selectedDate
      ? guardsByDate.get(
          selectedDate
        ) ?? EMPTY_DAY
      : EMPTY_DAY;

  const myAvailability =
    selectedDate && profile
      ? availabilities.find(
          (availability) =>
            availability.guard_date ===
              selectedDate &&
            availability.profile_id ===
              profile.id
        ) ?? null
      : null;

  const selectedDateIsPast =
    selectedDate
      ? selectedDate < todayKey()
      : false;

  /* =======================================================
     INSCRIPTION
  ======================================================= */

  const chooseGuard = async (
    guardType: GuardType
  ) => {
    if (
      !selectedDate ||
      selectedDateIsPast
    ) {
      return;
    }

    setIsSaving(true);
    setActionError("");
    setSuccessMessage("");

    try {
      const { error } =
        await supabase.rpc(
          "set_guard_availability",
          {
            p_guard_date:
              selectedDate,
            p_guard_type:
              guardType,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      setSuccessMessage(
        "Votre disponibilité a été enregistrée."
      );

      await loadCalendar();
    } catch (error) {
      console.error(
        "Erreur inscription garde :",
        error
      );

      setActionError(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer votre disponibilité."
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* =======================================================
     RETRAIT
  ======================================================= */

  const removeAvailability =
    async () => {
      if (
        !selectedDate ||
        selectedDateIsPast
      ) {
        return;
      }

      setIsSaving(true);
      setActionError("");
      setSuccessMessage("");

      try {
        const { error } =
          await supabase.rpc(
            "remove_guard_availability",
            {
              p_guard_date:
                selectedDate,
            }
          );

        if (error) {
          throw new Error(
            error.message
          );
        }

        setSuccessMessage(
          "Votre disponibilité a été retirée."
        );

        await loadCalendar();
      } catch (error) {
        console.error(
          "Erreur retrait garde :",
          error
        );

        setActionError(
          error instanceof Error
            ? error.message
            : "Impossible de retirer votre disponibilité."
        );
      } finally {
        setIsSaving(false);
      }
    };

  /* =======================================================
     CHARGEMENT
  ======================================================= */

  if (isLoading && !profile) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-red-600" />

          <p className="mt-4 text-sm text-muted-foreground">
            Chargement des
            disponibilités...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     ERREUR
  ======================================================= */

  if (errorMessage && !profile) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border border-red-400 bg-red-100 p-6 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-black">
            Impossible d&apos;ouvrir les
            disponibilités
          </p>

          <p className="mt-2 text-sm">
            {errorMessage}
          </p>

          <Link
            href="/dashboard"
            className="app-button-secondary mt-5 inline-flex rounded-xl px-4 py-3 text-sm font-black"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  /* =======================================================
     AFFICHAGE
  ======================================================= */

  return (
    <div className="app-page min-h-screen">
      <main className="mx-auto w-full max-w-7xl p-4 pb-24 sm:p-6 lg:p-8">
        {/* HEADER */}

        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-red-500">
              Gardes
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Mes disponibilités
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Choisissez vos disponibilités
              pour les gardes de 19h00 à
              07h00. Cliquez sur une journée
              pour consulter la composition
              de la garde.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="app-button-secondary inline-flex w-fit items-center rounded-xl px-4 py-3 text-sm font-black"
          >
            Retour au tableau de bord
          </Link>
        </header>

        {/* LÉGENDE */}

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <LegendCard
            icon={ShieldCheck}
            title="1er départ"
            description="2 sapeurs-pompiers maximum"
            value="2"
            tone="red"
          />

          <LegendCard
            icon={Users}
            title="2e départ"
            description="4 sapeurs-pompiers maximum"
            value="4"
            tone="blue"
          />

          <LegendCard
            icon={Eye}
            title="Observateur"
            description="1 place maximum"
            value="1"
            tone="purple"
          />
        </section>

        {/* RÉSUMÉ PERSONNEL */}

        {profile && (() => {
          const myMonthAvailabilities = availabilities.filter(
            (availability) => availability.profile_id === profile.id
          );

          const myFirst = myMonthAvailabilities.filter(
            (availability) => availability.guard_type === "first_departure"
          ).length;

          const mySecond = myMonthAvailabilities.filter(
            (availability) => availability.guard_type === "second_departure"
          ).length;

          const myObserver = myMonthAvailabilities.filter(
            (availability) => availability.guard_type === "observer"
          ).length;

          return (
            <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                    Mon mois
                  </p>
                  <h2 className="mt-1 text-xl font-black">Mes gardes</h2>
                </div>
                <div className="text-3xl font-black">
                  {myMonthAvailabilities.length}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <PersonalStat label="1er départ" value={myFirst} />
                <PersonalStat label="2e départ" value={mySecond} />
                <PersonalStat label="Observateur" value={myObserver} />
              </div>
            </section>
          );
        })()}

        {/* CALENDRIER */}

        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {/* NAVIGATION */}

          <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                Calendrier des gardes
              </p>

              <h2 className="mt-1 text-2xl font-black capitalize">
                {MONTHS[currentMonth]}{" "}
                {currentYear}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={previousMonth}
                className="app-button-secondary flex h-11 w-11 items-center justify-center rounded-xl"
                aria-label="Mois précédent"
              >
                <ChevronLeft
                  size={20}
                />
              </button>

              <button
                type="button"
                onClick={goToday}
                className="app-button-secondary min-h-11 rounded-xl px-4 text-sm font-black"
              >
                Aujourd&apos;hui
              </button>

              <button
                type="button"
                onClick={nextMonth}
                className="app-button-secondary flex h-11 w-11 items-center justify-center rounded-xl"
                aria-label="Mois suivant"
              >
                <ChevronRight
                  size={20}
                />
              </button>
            </div>
          </div>

          {/* INFO */}

          <div className="flex items-start gap-3 border-b border-border bg-surface-strong px-4 py-3 text-xs text-muted-foreground sm:px-5">
            <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-red-500" />

            <p>
              Une journée rouge signifie que
              le premier départ n&apos;est
              pas encore assuré par deux
              sapeurs-pompiers.
            </p>
          </div>

          {/* JOURS SEMAINE */}

          <div className="grid grid-cols-7 border-b border-border bg-surface-strong">
            {WEEK_DAYS.map(
              (day) => (
                <div
                  key={day}
                  className="px-1 py-3 text-center text-[10px] font-black uppercase tracking-wide text-muted-foreground sm:text-xs"
                >
                  {day}
                </div>
              )
            )}
          </div>

          {/* CASES */}

          <div className="grid grid-cols-7">
            {calendarDays.map(
              (cell, index) => {
                if (!cell) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="min-h-[82px] border-b border-r border-border bg-surface-strong/40 sm:min-h-[125px]"
                    />
                  );
                }

                const data =
                  guardsByDate.get(
                    cell.key
                  ) ?? EMPTY_DAY;

                const firstCount =
                  data.first.length;

                const secondCount =
                  data.second.length;

                const observerCount =
                  data.observers.length;

                const firstMissing =
                  firstCount < 2;

                const isToday =
                  cell.key ===
                  todayKey();

                const isPast =
                  cell.key <
                  todayKey();

                const mine =
                  profile
                    ? availabilities.find(
                        (
                          availability
                        ) =>
                          availability.guard_date ===
                            cell.key &&
                          availability.profile_id ===
                            profile.id
                      )
                    : undefined;

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => {
                      setSelectedDate(
                        cell.key
                      );
                      setActionError("");
                      setSuccessMessage("");
                    }}
                    className={`relative min-h-[82px] border-b border-r border-border p-1.5 text-left transition hover:z-10 hover:bg-surface-strong sm:min-h-[125px] sm:p-3 ${
                     firstMissing
  ? "bg-card before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-red-500"
  : "bg-card"
                    } ${
                      isPast
                        ? "opacity-65"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-1 text-xs font-black sm:text-sm ${
                          isToday
                            ? "bg-red-600 text-white"
                            : "text-foreground"
                        }`}
                      >
                        {cell.day}
                      </span>

                      {mine && (
                        <span className="hidden rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 sm:block">
                          Ma garde
                        </span>
                      )}
                    </div>

                    {/* MOBILE */}

                    <div className="mt-2 space-y-1 sm:hidden">
                      <MiniCounter
                        value={`${firstCount}/2`}
                        danger={
                          firstMissing
                        }
                      />

                      <MiniCounter
                        value={`${secondCount}/4`}
                      />
                    </div>

                    {/* DESKTOP */}

                    <div className="mt-3 hidden space-y-1.5 sm:block">
                      <CalendarStatus
                        label="1er"
                        value={`${firstCount}/2`}
                        danger={
                          firstMissing
                        }
                        success={firstCount >= 2}
                      />

                      <CalendarStatus
                        label="2e"
                        value={`${secondCount}/4`}
                      />

                      <CalendarStatus
                        label="Obs."
                        value={`${observerCount}/1`}
                      />
                    </div>

                    {mine && (
                      <div className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 sm:hidden" />
                    )}
                  </button>
                );
              }
            )}
          </div>
        </section>
      </main>

      {/* MODALE JOUR */}

      {selectedDate && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Composition de la garde"
        >
          <button
            type="button"
            onClick={() =>
              setSelectedDate(null)
            }
            className="absolute inset-0"
            aria-label="Fermer"
          />

          <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card shadow-2xl sm:max-w-2xl sm:rounded-3xl">
            {/* MODAL HEADER */}

            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card p-5 sm:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                  Garde
                </p>

                <h2 className="mt-1 text-xl font-black capitalize sm:text-2xl">
                  {formatLongDate(
                    selectedDate
                  )}
                </h2>

                <div className="mt-2 flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Clock3 size={16} />
                  19h00 → 07h00
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedDate(null)
                }
                className="app-button-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {/* 1ER DÉPART */}

              <GuardSection
                title="1er départ"
                count={
                  selectedDayData.first
                    .length
                }
                max={2}
                people={
                  selectedDayData.first
                }
                danger={
                  selectedDayData.first
                    .length < 2
                }
              />

              {/* 2EME DÉPART */}

              <GuardSection
                title="2e départ"
                count={
                  selectedDayData.second
                    .length
                }
                max={4}
                people={
                  selectedDayData.second
                }
              />

              {/* OBSERVATEUR */}

              <GuardSection
                title="Observateur"
                count={
                  selectedDayData
                    .observers.length
                }
                max={1}
                people={
                  selectedDayData.observers
                }
              />

              {/* MA DISPONIBILITÉ */}

              <div className="border-t border-border pt-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-strong">
                    <UserRound
                      size={19}
                    />
                  </div>

                  <div>
                    <h3 className="font-black">
                      Ma disponibilité
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedDateIsPast
                        ? "Cette garde est passée. Elle est disponible en consultation uniquement."
                        : myAvailability
                          ? "Vous pouvez modifier votre position ou retirer votre disponibilité."
                          : "Choisissez votre position pour cette garde."}
                    </p>
                  </div>
                </div>

                {myAvailability && (
                  <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Vous êtes inscrit :{" "}
                    {myAvailability.guard_type ===
                    "first_departure"
                      ? "1er départ"
                      : myAvailability.guard_type ===
                          "second_departure"
                        ? "2e départ"
                        : "Observateur"}
                  </div>
                )}

                {!selectedDateIsPast && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <GuardChoiceButton
                      label="1er départ"
                      count={
                        selectedDayData
                          .first.length
                      }
                      max={2}
                      selected={
                        myAvailability?.guard_type ===
                        "first_departure"
                      }
                      disabled={
                        isSaving ||
                        (selectedDayData
                          .first
                          .length >= 2 &&
                          myAvailability?.guard_type !==
                            "first_departure")
                      }
                      onClick={() =>
                        void chooseGuard(
                          "first_departure"
                        )
                      }
                    />

                    <GuardChoiceButton
                      label="2e départ"
                      count={
                        selectedDayData
                          .second.length
                      }
                      max={4}
                      selected={
                        myAvailability?.guard_type ===
                        "second_departure"
                      }
                      disabled={
                        isSaving ||
                        (selectedDayData
                          .second
                          .length >= 4 &&
                          myAvailability?.guard_type !==
                            "second_departure")
                      }
                      onClick={() =>
                        void chooseGuard(
                          "second_departure"
                        )
                      }
                    />

                    <GuardChoiceButton
                      label="Observateur"
                      count={
                        selectedDayData
                          .observers.length
                      }
                      max={1}
                      selected={
                        myAvailability?.guard_type ===
                        "observer"
                      }
                      disabled={
                        isSaving ||
                        (selectedDayData
                          .observers
                          .length >= 1 &&
                          myAvailability?.guard_type !==
                            "observer")
                      }
                      onClick={() =>
                        void chooseGuard(
                          "observer"
                        )
                      }
                    />
                  </div>
                )}

                {actionError && (
                  <div className="mt-4 rounded-2xl border border-red-300 bg-red-100 px-4 py-3 text-sm font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    {actionError}
                  </div>
                )}

                {successMessage && (
                  <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                    {successMessage}
                  </div>
                )}

                {!selectedDateIsPast &&
                  myAvailability && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        void removeAvailability()
                      }
                      className="mt-4 min-h-11 w-full rounded-xl border border-red-300 px-4 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      Retirer ma
                      disponibilité
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   COMPOSANTS
========================================================= */

function LegendCard({
  icon: Icon,
  title,
  description,
  value,
  tone,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  value: string;
  tone: "red" | "blue" | "purple";
}) {
  const toneClasses = {
    red: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    purple:
      "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
      >
        <Icon size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-black">
          {title}
        </p>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {description}
        </p>
      </div>

      <span className="text-2xl font-black">
        {value}
      </span>
    </div>
  );
}

function CalendarStatus({
  label,
  value,
  danger = false,
  success = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-2 py-1 text-[11px] font-black ${
        danger
          ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
          : success
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
            : "bg-surface-strong text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function MiniCounter({
  value,
  danger = false,
}: {
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-md px-1 py-0.5 text-center text-[9px] font-black ${
        danger
          ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
          : "bg-surface-strong text-muted-foreground"
      }`}
    >
      {value}
    </div>
  );
}

function GuardSection({
  title,
  count,
  max,
  people,
  danger = false,
}: {
  title: string;
  count: number;
  max: number;
  people: GuardAvailability[];
  danger?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border p-4 ${
        danger
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
          : "border-border bg-surface-strong/50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black">
          {title}
        </h3>

        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${
            danger
              ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
              : count >= max
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-card text-muted-foreground"
          }`}
        >
          {count}/{max}
        </span>
      </div>

      {people.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Aucune personne inscrite.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {people.map((person) => (
            <div
              key={
                person.availability_id
              }
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-strong text-xs font-black">
                {getInitials(
                  person.first_name,
                  person.last_name
                )}
              </div>

              <span className="text-sm font-bold">
                {getDisplayName(person)}
              </span>
            </div>
          ))}
        </div>
      )}

      {danger && (
        <p className="mt-3 text-xs font-bold text-red-600 dark:text-red-400">
          {2 - count === 1
            ? "Il manque 1 sapeur-pompier pour assurer le premier départ."
            : `Il manque ${
                2 - count
              } sapeurs-pompiers pour assurer le premier départ.`}
        </p>
      )}
    </section>
  );
}

function GuardChoiceButton({
  label,
  count,
  max,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  count: number;
  max: number;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-[70px] rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
        selected
          ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "border-border bg-card hover:border-red-400 hover:bg-surface-strong"
      }`}
    >
      <span className="block text-sm font-black">
        {label}
      </span>

      <span className="mt-1 block text-xs font-bold text-muted-foreground">
        {count}/{max}{" "}
        {count >= max && !selected
          ? "· Complet"
          : ""}
      </span>
    </button>
  );
}

function PersonalStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-surface-strong px-3 py-3 text-center">
      <div className="text-xl font-black">{value}</div>
      <div className="mt-1 text-[10px] font-bold text-muted-foreground sm:text-xs">
        {label}
      </div>
    </div>
  );
}
