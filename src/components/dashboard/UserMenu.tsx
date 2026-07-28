"use client";

import Link from "next/link";
import {
  ChevronDown,
  CircleHelp,
  LogOut,
  Settings,
  Shield,
  User,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  firstName?: string | null;
  lastName?: string | null;
  grade?: string | null;
  avatarUrl?: string | null;
  isLoggingOut: boolean;
  onLogout: () => void;
};

export default function UserMenu({
  firstName,
  lastName,
  grade,
  avatarUrl,
  isLoggingOut,
  onLogout,
}: UserMenuProps) {
  const fullName =
    `${firstName ?? ""} ${lastName ?? ""}`.trim() || "Utilisateur";

  const initials =
    `${firstName?.charAt(0) ?? ""}${lastName?.charAt(0) ?? ""}`
      .toUpperCase() || "SP";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Ouvrir le menu utilisateur"
          className="group flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-1.5 py-1.5 shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-red-600 active:translate-y-0 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-red-900"
        >
          <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-700">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={`Photo de ${fullName}`} />
            ) : null}

            <AvatarFallback className="bg-red-600 font-black text-white">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="hidden min-w-0 text-left md:block">
            <p className="max-w-36 truncate text-sm font-bold text-slate-900 dark:text-white">
              {fullName}
            </p>

            <p className="max-w-36 truncate text-xs text-slate-500 dark:text-slate-400">
              {grade || "Grade non renseigné"}
            </p>
          </div>

          <ChevronDown
            aria-hidden="true"
            className="mr-1 hidden h-4 w-4 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180 md:block"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-72 rounded-2xl p-2 shadow-xl"
      >
        <DropdownMenuLabel className="p-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border border-slate-200 dark:border-slate-700">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={`Photo de ${fullName}`} />
              ) : null}

              <AvatarFallback className="bg-red-600 font-black text-white">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <p className="truncate font-bold text-slate-900 dark:text-white">
                {fullName}
              </p>

              <p className="truncate text-xs text-muted-foreground">
                {grade || "Grade non renseigné"}
              </p>

              <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-red-600">
                SLIS
              </p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
          <Link href="/dashboard/profil">
            <User className="h-4 w-4" />
            Mon profil
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
          <Link href="/dashboard/parametres">
            <Settings className="h-4 w-4" />
            Paramètres
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
          <Link href="/dashboard/confidentialite">
            <Shield className="h-4 w-4" />
            Confidentialité
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
          <Link href="/dashboard/aide">
            <CircleHelp className="h-4 w-4" />
            Aide
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={isLoggingOut}
          onSelect={(event) => {
            event.preventDefault();
            onLogout();
          }}
          className="cursor-pointer rounded-xl font-semibold text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/40 dark:focus:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Déconnexion..." : "Se déconnecter"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}