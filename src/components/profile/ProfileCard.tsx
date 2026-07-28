import Image from "next/image";
import { BadgeCheck, Building2, Pencil } from "lucide-react";

import type { Profile } from "@/types/profile";

type ProfileCardProps = {
  profile: Profile;
  onEdit?: () => void;
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`
    .toUpperCase()
    .trim() || "SP";
}

export default function ProfileCard({
  profile,
  onEdit,
}: ProfileCardProps) {
  const fullName =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    "Utilisateur";

  const initials = getInitials(
    profile.first_name ?? "",
    profile.last_name ?? ""
  );

  const status = profile.status?.trim() || "Actif";
  const isActive = status.toLowerCase() === "actif";

  return (
    <section className="relative rounded-3xl bg-white shadow-sm dark:bg-slate-900">
      <div className="relative h-28 overflow-hidden rounded-t-3xl bg-gradient-to-r from-red-700 to-red-500 sm:h-32">
        <div className="absolute -left-10 -top-14 h-36 w-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 right-10 h-44 w-44 rounded-full bg-black/10" />

        <button
          type="button"
          onClick={onEdit}
          className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-md transition hover:bg-slate-100 active:scale-95 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
        >
          <Pencil className="h-4 w-4" />
          Modifier
        </button>
      </div>

      <div className="relative px-5 pb-7 pt-16 sm:px-8 sm:pb-8 sm:pt-20">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-800 text-3xl font-extrabold text-white shadow-xl dark:border-slate-900 sm:h-32 sm:w-32 sm:text-4xl">
            {profile.avatar_url ? (
              <Image
  src={profile.avatar_url}
  alt={`Photo de profil de ${fullName}`}
  width={128}
  height={128}
  unoptimized
  className="h-full w-full object-cover"
/>
            ) : (
              <span>{initials}</span>
            )}
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-slate-950 dark:text-white sm:text-3xl">
            {fullName}
          </h2>

          <p className="mt-1 font-bold text-red-600">
            {profile.grade || "Grade non renseigné"}
          </p>

          {profile.fonction && (
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {profile.fonction}
            </p>
          )}

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Building2 className="h-4 w-4 text-red-600" />
              SLIS
            </span>

            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
              }`}
            >
              <BadgeCheck className="h-4 w-4" />
              {status}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}