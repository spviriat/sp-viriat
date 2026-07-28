import Link from "next/link";

type UpcomingEvent = {
  day: string;
  month: string;
  title: string;
  location: string;
  time: string;
};

type UpcomingEventsProps = {
  events: UpcomingEvent[];
};

export default function UpcomingEvents({
  events,
}: UpcomingEventsProps) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold">
          Prochains événements
        </h2>

        <Link
          href="/dashboard/planning"
          className="text-sm font-bold text-blue-600"
        >
          Voir tout
        </Link>
      </div>

      <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
        {events.map((event) => (
          <Link
            key={`${event.day}-${event.month}-${event.title}`}
            href="/dashboard/planning"
            className="flex items-center gap-4 py-4 first:pt-2 last:pb-1"
          >
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <span className="text-xl font-black text-red-600">
                {event.day}
              </span>

              <span className="text-xs font-bold">
                {event.month}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{event.title}</p>

              <p className="mt-1 truncate text-sm text-slate-500">
                📍 {event.location}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                {event.time}
              </span>

              <span className="text-2xl text-slate-400">›</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}