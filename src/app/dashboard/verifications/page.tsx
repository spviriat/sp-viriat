"use client";

import Link from "next/link";
import {
  Ambulance,
  ChevronLeft,
  ClipboardCheck,
  Construction,
  PackageCheck,
  Truck,
} from "lucide-react";

type VerificationCardProps = {
  title: string;
  description: string;
  icon: typeof ClipboardCheck;
  href?: string;
  badge?: string;
  disabled?: boolean;
};

export default function VerificationsPage() {
  return (
    <main className="app-page min-h-screen">
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
        <Link
          href="/dashboard"
          className="app-button-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
        >
          <ChevronLeft size={18} />
          Accueil
        </Link>

        <header className="mt-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
            Vérifications
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Mes vérifications
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Retrouvez ici les contrôles opérationnels à effectuer.
            Les vérifications des sacs de secours sont déjà disponibles.
            Les contrôles VPI, FPT, VL et matériel pourront être ajoutés
            progressivement sans modifier cette page d&apos;accueil.
          </p>
        </header>

        <section className="mt-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <VerificationCard
              title="Sacs de secours"
              description="Premier secours VPI, Oxygénothérapie VPI et Premier secours FPT."
              icon={Ambulance}
              href="/dashboard/secourisme"
              badge="Disponible"
            />

            <VerificationCard
              title="VPI"
              description="Contrôle de l'engin, des équipements et du matériel embarqué."
              icon={Truck}
              disabled
              badge="À venir"
            />

            <VerificationCard
              title="FPT"
              description="Contrôle de l'engin, des équipements et du matériel embarqué."
              icon={Truck}
              disabled
              badge="À venir"
            />

            <VerificationCard
              title="VL"
              description="Contrôle du véhicule, de ses équipements et du matériel embarqué."
              icon={Truck}
              disabled
              badge="À venir"
            />

            <VerificationCard
              title="Matériel"
              description="Vérifications périodiques du matériel opérationnel."
              icon={PackageCheck}
              disabled
              badge="À venir"
            />
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-strong text-muted-foreground">
              <Construction size={20} />
            </div>

            <div>
              <h2 className="font-black">
                Espace évolutif
              </h2>

              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Cette page servira de point d&apos;entrée unique pour toutes
                les vérifications. Les nouvelles catégories pourront être
                rendues fonctionnelles au fur et à mesure.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function VerificationCard({
  title,
  description,
  icon,
  href,
  badge,
  disabled = false,
}: VerificationCardProps) {
  const Icon = icon;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-strong text-foreground">
          <Icon size={22} />
        </div>

        {badge && (
          <span
            className={
              disabled
                ? "rounded-full border border-border bg-surface-strong px-3 py-1 text-xs font-black text-muted-foreground"
                : "rounded-full border border-emerald-400 bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            }
          >
            {badge}
          </span>
        )}
      </div>

      <h2 className="mt-5 text-xl font-black">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>

      <div className="mt-5 text-sm font-black">
        {disabled ? (
          <span className="text-muted-foreground">
            Vérifications à venir
          </span>
        ) : (
          <span className="text-red-600 dark:text-red-400">
            Ouvrir les vérifications →
          </span>
        )}
      </div>
    </>
  );

  if (disabled || !href) {
    return (
      <div className="rounded-3xl border border-border bg-card p-5 opacity-75 shadow-sm">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-400 hover:shadow-md"
    >
      {content}
    </Link>
  );
}