import { BadgeInfo, Mail, Phone } from "lucide-react";
import type { Profile } from "@/types/profile";

type ProfileInfoProps = {
  profile: Profile;
  email: string;
};

type InfoRowProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
};

function InfoRow({ label, value, icon }: InfoRowProps) {
  return (
    <div className="flex items-center gap-4 px-5 py-5 sm:px-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>

        <p className="mt-1 break-words font-bold text-slate-950 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function ProfileInfo({
  profile,
  email,
}: ProfileInfoProps) {
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800 sm:px-6">
        <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">
          Informations personnelles
        </h2>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        <InfoRow
          label="Email"
          value={email || "Non renseigné"}
          icon={<Mail className="h-5 w-5" />}
        />

        <InfoRow
          label="Téléphone"
          value={profile.telephone || "Non renseigné"}
          icon={<Phone className="h-5 w-5" />}
        />

        <InfoRow
          label="Matricule"
          value={profile.matricule || "Non renseigné"}
          icon={<BadgeInfo className="h-5 w-5" />}
        />
      </div>
    </section>
  );
}