"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

type NotificationButtonProps = {
  count?: number;
};

export default function NotificationButton({
  count = 2,
}: NotificationButtonProps) {
  const hasNotifications = count > 0;
  const displayedCount = count > 9 ? "9+" : count;

  return (
    <Link
      href="/dashboard/notifications"
      aria-label={
        hasNotifications
          ? `Voir les notifications, ${count} non lue${count > 1 ? "s" : ""}`
          : "Voir les notifications"
      }
      className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:text-red-600 hover:shadow-md active:translate-y-0 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-red-900 dark:hover:text-red-400"
    >
      <Bell
        aria-hidden="true"
        className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
        strokeWidth={2.2}
      />

      {hasNotifications && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-black leading-none text-white shadow-sm dark:border-slate-900">
          {displayedCount}
        </span>
      )}

      {hasNotifications && (
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 h-2.5 w-2.5 animate-ping rounded-full bg-red-500/60"
        />
      )}
    </Link>
  );
}