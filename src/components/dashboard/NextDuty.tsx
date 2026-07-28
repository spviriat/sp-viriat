import Link from "next/link";

export default function NextDuty() {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-red-600 to-red-700 p-6 text-white shadow-xl">
      <p className="text-xs font-bold uppercase tracking-widest text-red-100">
        Ma prochaine garde
      </p>

      <h2 className="mt-2 text-3xl font-black">
        Samedi 15 juin
      </h2>

      <p className="mt-2 text-red-100">
        08:00 – 20:00
      </p>

      <div className="mt-6 rounded-2xl bg-white/10 p-4">
        <p className="text-sm font-semibold">
          Équipe Alpha
        </p>

        <p className="mt-1 text-sm text-red-100">
          Centre de secours de Viriat
        </p>
      </div>

      <Link
        href="/dashboard/planning"
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 font-bold text-red-600 transition hover:bg-red-50"
      >
        Voir le planning
      </Link>
    </section>
  );
}