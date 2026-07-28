import Link from "next/link";
import {
  Backpack,
  CalendarDays,
  ClipboardCheck,
  FolderOpen,
  Newspaper,
  Package,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

type QuickAccessItem = {
  title: string;
  href: string;
  icon?: string;
  hasNotification?: boolean;
};

type QuickAccessProps = {
  items: QuickAccessItem[];
};

type IconStyle = {
  icon: LucideIcon;
  className: string;
};

const iconStyles: Record<string, IconStyle> = {
  "/dashboard/materiel": {
    icon: Package,
    className:
      "bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-400/20",
  },
  "/dashboard/sac": {
    icon: Backpack,
    className:
      "bg-fuchsia-500/15 text-fuchsia-400 ring-1 ring-inset ring-fuchsia-400/20",
  },
  "/dashboard/verifications": {
    icon: ClipboardCheck,
    className:
      "bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-400/20",
  },
  "/dashboard/disponibilites": {
    icon: CalendarDays,
    className:
      "bg-blue-500/15 text-blue-400 ring-1 ring-inset ring-blue-400/20",
  },
  "/dashboard/actualites": {
    icon: Newspaper,
    className:
      "bg-violet-500/15 text-violet-400 ring-1 ring-inset ring-violet-400/20",
  },
  "/dashboard/evenements-indesirables": {
    icon: TriangleAlert,
    className:
      "bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-400/20",
  },
  "/dashboard/documents": {
    icon: FolderOpen,
    className:
      "bg-orange-500/15 text-orange-400 ring-1 ring-inset ring-orange-400/20",
  },
  "/dashboard/annuaire": {
    icon: Users,
    className:
      "bg-indigo-500/15 text-indigo-400 ring-1 ring-inset ring-indigo-400/20",
  },
};

const defaultIconStyle: IconStyle = {
  icon: Package,
  className:
    "bg-slate-500/15 text-slate-400 ring-1 ring-inset ring-slate-400/20",
};

export default function QuickAccess({ items }: QuickAccessProps) {
  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">
            Navigation
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            Accès rapides
          </h2>
        </div>

        <Link
          href="/dashboard/plus"
          className="rounded-xl px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 active:scale-95 dark:hover:bg-red-950/30"
        >
          Voir tout
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => {
          const iconStyle = iconStyles[item.href] ?? defaultIconStyle;
          const Icon = iconStyle.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex min-h-32 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-5 text-center transition duration-200 hover:-translate-y-1 hover:border-red-200 hover:bg-white hover:shadow-lg active:translate-y-0 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-950/35 dark:hover:border-red-900 dark:hover:bg-slate-950"
            >
              {item.hasNotification && (
                <span className="absolute right-3 top-3 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                </span>
              )}

              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition duration-200 group-hover:scale-110 ${iconStyle.className}`}
              >
                <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.2} />
              </span>

              <span className="mt-4 text-sm font-extrabold leading-tight text-slate-800 transition group-hover:text-red-600 dark:text-slate-100">
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}