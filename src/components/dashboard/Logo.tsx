import Image from "next/image";
import Link from "next/link";

export default function Logo() {
  return (
    <Link
      href="/dashboard"
      aria-label="Retour au tableau de bord SP Viriat"
      className="group flex min-w-0 items-center gap-3 rounded-2xl outline-none transition focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-slate-950"
    >
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-2xl bg-red-600/20 blur-lg transition duration-300 group-hover:bg-red-600/30" />

        <Image
          src="/logosp.jpg"
          alt="Logo des sapeurs-pompiers de Viriat"
          width={64}
          height={64}
          priority
          className="relative h-12 w-12 rounded-2xl border border-slate-200 object-cover shadow-sm transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md dark:border-slate-700 sm:h-14 sm:w-14"
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 sm:text-xs">
          Sapeurs-pompiers
        </p>

        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-black uppercase tracking-wide text-slate-950 dark:text-white sm:text-xl">
            SP Viriat
          </h1>

          <span
            aria-hidden="true"
            className="hidden h-2 w-2 rounded-full bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.7)] sm:block"
          />
        </div>

        <p className="hidden truncate text-xs font-medium text-slate-500 dark:text-slate-400 sm:block">
          SLIS
        </p>
      </div>
    </Link>
  );
}