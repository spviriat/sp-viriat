type WelcomeSectionProps = {
  profile: {
    first_name?: string | null;
  } | null;
};

export default function WelcomeSection({
  profile,
}: WelcomeSectionProps) {
  return (
    <section className="mb-6">
      <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
        Bonjour {profile?.first_name || "Pompier"}
      </h1>

      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Voici ce qui se passe à la caserne aujourd&apos;hui.
      </p>
    </section>
  );
}