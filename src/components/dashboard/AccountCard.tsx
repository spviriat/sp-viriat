import type { Profile } from "@/types/profile";

type AccountCardProps = {
  profile: Profile | null;
  isLoggingOut: boolean;
  onLogout: () => void;
};

export default function AccountCard({
  profile,
  isLoggingOut,
  onLogout,
}: AccountCardProps) {
  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : "Profil indisponible";

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
        Mon compte
      </p>

      <div className="mt-3 space-y-1">
        <p className="font-extrabold text-slate-900 dark:text-white">
          {fullName}
        </p>

        <p className="text-sm font-medium capitalize text-red-600">
          {profile?.role || "Utilisateur"}
        </p>

        {profile?.grade && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {profile.grade}
          </p>
        )}

        {profile?.fonction && (
          <p className="text-sm text-slate-500">{profile.fonction}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onLogout}
        disabled={isLoggingOut}
        className="mt-5 w-full rounded-2xl border border-red-200 px-5 py-3 font-bold text-red-600 transition hover:bg-red-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/30 sm:hidden"
      >
        {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
      </button>
    </section>
  );
}