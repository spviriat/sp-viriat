"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const quickAccessItems = [
  {
    title: "Mon matériel",
    icon: "🧰",
    href: "/dashboard/materiel",
    iconStyle: "bg-red-50 text-red-600 dark:bg-red-950/40",
  },
  {
    title: "Mon sac",
    icon: "🎒",
    href: "/dashboard/sac",
    iconStyle: "bg-slate-100 text-slate-700 dark:bg-slate-800",
  },
  {
    title: "Vérifications",
    icon: "✅",
    href: "/dashboard/verifications",
    iconStyle: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40",
  },
  {
    title: "Disponibilités",
    icon: "📅",
    href: "/dashboard/disponibilites",
    iconStyle: "bg-blue-50 text-blue-600 dark:bg-blue-950/40",
  },
  {
    title: "Actualités",
    icon: "📰",
    href: "/dashboard/actualites",
    iconStyle: "bg-violet-50 text-violet-600 dark:bg-violet-950/40",
    hasNotification: true,
  },
  {
    title: "Événements indésirables",
    icon: "⚠️",
    href: "/dashboard/evenements-indesirables",
    iconStyle: "bg-orange-50 text-orange-600 dark:bg-orange-950/40",
  },
  {
    title: "Documents",
    icon: "📁",
    href: "/dashboard/documents",
    iconStyle: "bg-blue-50 text-blue-600 dark:bg-blue-950/40",
  },
  {
    title: "Annuaire",
    icon: "👥",
    href: "/dashboard/annuaire",
    iconStyle: "bg-purple-50 text-purple-600 dark:bg-purple-950/40",
  },
];

const upcomingEvents = [
  {
    day: "15",
    month: "JUIN",
    title: "Manœuvre départementale",
    location: "Caserne de Viriat",
    time: "08:00",
  },
  {
    day: "14",
    month: "JUIL.",
    title: "Cérémonie du 14 juillet",
    location: "Place de la Mairie",
    time: "10:30",
  },
];

export default function DashboardPage() {
  const router = useRouter();

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [firstName, setFirstName] = useState("Pompier");

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        router.replace("/");
        return;
      }

      const email = session.user.email ?? "";
      const metadataFirstName = session.user.user_metadata?.first_name;

      setUserEmail(email);

      if (typeof metadataFirstName === "string" && metadataFirstName.trim()) {
        setFirstName(metadataFirstName.trim());
      } else if (email) {
        const emailName = email.split("@")[0].split(/[._-]/)[0];

        setFirstName(
          emailName.charAt(0).toUpperCase() + emailName.slice(1).toLowerCase()
        );
      }

      setIsCheckingSession(false);
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    router.replace("/");

    void supabase.auth.signOut({ scope: "local" }).then(({ error }) => {
      if (error) {
        console.error("Erreur lors de la déconnexion :", error);
      }
    });
  };

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-lg dark:bg-slate-900">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

          <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
            Chargement de l&apos;application...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto w-full max-w-4xl">
        <header className="px-4 pb-5 pt-5 sm:px-6 sm:pt-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/logosp.jpg"
                alt="Logo SP Viriat"
                width={64}
                height={64}
                priority
                className="h-14 w-14 rounded-2xl object-cover shadow-sm sm:h-16 sm:w-16"
              />

              <div>
                <p className="text-sm font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                  Sapeurs-pompiers
                </p>

                <p className="text-lg font-black uppercase tracking-wide text-red-600">
                  Viriat
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/notifications"
              aria-label="Voir les notifications"
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm transition active:scale-95 dark:bg-slate-900"
            >
              🔔

              <span className="absolute right-0 top-0 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                2
              </span>
            </Link>
          </div>

          <div className="mt-8">
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Bonjour {firstName} 👋
            </h1>

            <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
              Voici ce qui se passe à la caserne aujourd&apos;hui.
            </p>
          </div>
        </header>

        <div className="space-y-5 px-4 sm:px-6">
          <Link
            href="/dashboard/verifications"
            className="flex items-center gap-4 rounded-3xl border border-red-200 bg-red-50 p-5 transition active:scale-[0.99] dark:border-red-900 dark:bg-red-950/30"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-600 text-2xl text-white">
              ⚠️
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-bold text-red-600">Rappel important</p>

              <h2 className="mt-1 text-lg font-extrabold">
                Vérification des ARI
              </h2>

              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Pense à vérifier ton ARI avant la garde.
              </p>
            </div>

            <span className="text-3xl font-light text-red-600">›</span>
          </Link>

          <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">Ma prochaine garde</h2>

              <Link
                href="/dashboard/planning"
                className="text-sm font-bold text-blue-600"
              >
                📅 Voir le planning
              </Link>
            </div>

            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-50 text-2xl dark:bg-red-950/40">
                  📆
                </div>

                <div>
                  <p className="text-lg font-extrabold">Samedi 25 mai</p>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      08h00 – 08h00
                    </span>

                    <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600 dark:bg-red-950/40">
                      Premier départ
                    </span>
                  </div>
                </div>
              </div>

              <div className="sm:ml-auto sm:text-right">
                <span className="inline-flex rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  ✓ Confirmé
                </span>

                <p className="mt-2 text-sm text-slate-500">dans 3 jours</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <h2 className="text-lg font-extrabold">Accès rapides</h2>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickAccessItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex min-h-32 flex-col items-center justify-center rounded-2xl border border-slate-200 p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] dark:border-slate-700"
                >
                  {item.hasNotification && (
                    <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-600" />
                  )}

                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl ${item.iconStyle}`}
                  >
                    {item.icon}
                  </div>

                  <p className="mt-3 text-sm font-bold leading-tight">
                    {item.title}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Prochains événements</h2>

              <Link
                href="/dashboard/planning"
                className="text-sm font-bold text-blue-600"
              >
                Voir tout
              </Link>
            </div>

            <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
              {upcomingEvents.map((event) => (
                <Link
                  key={`${event.day}-${event.month}`}
                  href="/dashboard/planning"
                  className="flex items-center gap-4 py-4 first:pt-2 last:pb-1"
                >
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-xl font-black text-red-600">
                      {event.day}
                    </span>

                    <span className="text-xs font-bold">{event.month}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">{event.title}</p>

                    <p className="mt-1 truncate text-sm text-slate-500">
                      📍 {event.location}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">{event.time}</span>
                    <span className="text-2xl text-slate-500">›</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <Link
            href="/dashboard/notifications"
            className="flex items-center gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 transition active:scale-[0.99] dark:border-amber-900 dark:bg-amber-950/30"
          >
            <div className="text-3xl">⚠️</div>

            <div className="min-w-0 flex-1">
              <p className="font-extrabold">Pense-bête</p>

              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                N&apos;oublie pas ta tenue de sport pour l&apos;entraînement.
              </p>
            </div>

            <span className="text-3xl font-light">›</span>
          </Link>

          <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <p className="text-sm text-slate-500">
              Connecté avec {userEmail}
            </p>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-4 w-full rounded-2xl border border-red-200 px-5 py-3 font-bold text-red-600 transition active:scale-[0.98] disabled:opacity-50 dark:border-red-900"
            >
              {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
            </button>
          </section>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto grid max-w-4xl grid-cols-5">
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-red-600"
          >
            <span className="text-2xl">🏠</span>
            <span className="text-xs font-bold">Accueil</span>
          </Link>

          <Link
            href="/dashboard/materiel"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">🧰</span>
            <span className="text-xs font-semibold">Matériel</span>
          </Link>

          <Link
            href="/dashboard/planning"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">📅</span>
            <span className="text-xs font-semibold">Planning</span>
          </Link>

          <Link
            href="/dashboard/messages"
            className="relative flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">💬</span>

            <span className="absolute right-[28%] top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              1
            </span>

            <span className="text-xs font-semibold">Messages</span>
          </Link>

          <Link
            href="/dashboard/plus"
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
          >
            <span className="text-2xl">☰</span>
            <span className="text-xs font-semibold">Plus</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}