"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const themes = [
  {
    value: "light",
    label: "Mode clair",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Mode sombre",
    icon: Moon,
  },
  {
    value: "system",
    label: "Mode système",
    icon: Laptop,
  },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        aria-hidden="true"
        className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
      />
    );
  }

  const currentTheme = themes.find((item) => item.value === theme) ?? themes[2];
  const CurrentIcon = currentTheme.icon;

  const cycleTheme = () => {
    const currentIndex = themes.findIndex((item) => item.value === theme);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % themes.length;

    setTheme(themes[nextIndex].value);
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`${currentTheme.label}. Cliquer pour changer de thème.`}
      title={`${currentTheme.label} — cliquer pour changer`}
      className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:text-red-600 hover:shadow-md active:translate-y-0 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-red-900 dark:hover:text-red-400"
    >
      <CurrentIcon
        aria-hidden="true"
        className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
        strokeWidth={2.2}
      />
    </button>
  );
}