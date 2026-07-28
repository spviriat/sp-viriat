"use client";

import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/dashboard/Logo";
import NotificationButton from "@/components/dashboard/NotificationButton";
import UserMenu from "@/components/dashboard/UserMenu";
import type { Profile } from "@/types/profile";

type DashboardHeaderProps = {
  profile: Profile | null;
  isLoggingOut: boolean;
  onLogout: () => void;
};

export default function DashboardHeader({
  profile,
  isLoggingOut,
  onLogout,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Logo />

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />

          <NotificationButton count={2} />

          <UserMenu
            firstName={profile?.first_name}
            lastName={profile?.last_name}
            grade={profile?.grade}
            avatarUrl={profile?.avatar_url}
            isLoggingOut={isLoggingOut}
            onLogout={onLogout}
          />
        </div>
      </div>
    </header>
  );
}