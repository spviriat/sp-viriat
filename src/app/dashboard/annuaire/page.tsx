"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

type BusinessRole = {
  code: string;
  label: string;
};

type DirectoryProfile = {
  id: string;
  first_name: string;
  last_name: string;
  grade: string | null;
  phone: string | null;
  access_role: string | null;
  access_status: string | null;
  businessRoles: BusinessRole[];
};

export default function AnnuairePage() {
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadDirectory = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        // --------------------------------------------------
        // 1. Récupération des profils actifs
        // --------------------------------------------------

        const { data: profilesData, error: profilesError } =
          await supabase
            .from("profiles")
            .select(`
              id,
              first_name,
              last_name,
              grade,
              phone,
              access_role,
              access_status
            `)
            .eq("access_status", "active")
            .order("last_name", { ascending: true })
            .order("first_name", { ascending: true });

        if (profilesError) {
          throw profilesError;
        }

        const activeProfiles = profilesData ?? [];

        if (activeProfiles.length === 0) {
          setProfiles([]);
          return;
        }

        // --------------------------------------------------
        // 2. Récupération des rôles métier
        // --------------------------------------------------

        const profileIds = activeProfiles.map(
          (profile) => profile.id
        );

        const {
          data: assignmentsData,
          error: assignmentsError,
        } = await supabase
          .from("profile_business_roles")
          .select(`
            profile_id,
            business_roles (
              code,
              label
            )
          `)
          .in("profile_id", profileIds);

        if (assignmentsError) {
          throw assignmentsError;
        }

        // --------------------------------------------------
        // 3. Association profils / rôles
        // --------------------------------------------------

        const directoryProfiles: DirectoryProfile[] =
          activeProfiles.map((profile) => {
            const roles =
              assignmentsData
                ?.filter(
                  (assignment) =>
                    assignment.profile_id === profile.id
                )
                .map((assignment: any) => ({
                  code:
                    assignment.business_roles?.code ?? "",
                  label:
                    assignment.business_roles?.label ?? "",
                }))
                .filter((role) => role.code && role.label) ??
              [];

            return {
              id: profile.id,
              first_name: profile.first_name ?? "",
              last_name: profile.last_name ?? "",
              grade: profile.grade ?? null,
              phone: profile.phone ?? null,
              access_role: profile.access_role ?? null,
              access_status: profile.access_status ?? null,
              businessRoles: roles,
            };
          });

        setProfiles(directoryProfiles);
      } catch (error) {
        console.error(
          "Erreur chargement annuaire :",
          error
        );

        setErrorMessage(
          "Impossible de charger l'annuaire."
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadDirectory();
  }, []);

  // --------------------------------------------------
  // Recherche
  // --------------------------------------------------

  const filteredProfiles = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLocaleLowerCase("fr");

    if (!normalizedSearch) {
      return profiles;
    }

    return profiles.filter((profile) => {
      const searchableText = [
        profile.first_name,
        profile.last_name,
        profile.grade ?? "",
        ...profile.businessRoles.map(
          (role) => role.label
        ),
      ]
        .join(" ")
        .toLocaleLowerCase("fr");

      return searchableText.includes(normalizedSearch);
    });
  }, [profiles, search]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* En-tête */}

      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-red-600">
          Personnel
        </p>

        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
          Annuaire
        </h1>

        <p className="mt-2 text-muted-foreground">
          Coordonnées et fonctions du personnel actif.
        </p>
      </div>

      {/* Recherche */}

      <div className="mt-8">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg">
            🔎
          </span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Rechercher un nom, un grade ou une fonction..."
            className="w-full rounded-2xl border border-border bg-card py-4 pl-12 pr-4 font-medium outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 dark:focus:ring-red-950"
          />
        </div>
      </div>

      {/* Compteur */}

      {!isLoading && !errorMessage && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground">
            {filteredProfiles.length}{" "}
            {filteredProfiles.length > 1
              ? "personnes"
              : "personne"}
          </p>
        </div>
      )}

      {/* Chargement */}

      {isLoading && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="text-3xl">👥</div>

          <p className="mt-3 font-bold">
            Chargement de l&apos;annuaire...
          </p>
        </div>
      )}

      {/* Erreur */}

      {!isLoading && errorMessage && (
        <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <p className="font-bold">
            {errorMessage}
          </p>
        </div>
      )}

      {/* Aucun résultat */}

      {!isLoading &&
        !errorMessage &&
        filteredProfiles.length === 0 && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="text-4xl">👤</div>

            <p className="mt-4 font-black">
              Aucun résultat
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Aucun membre actif ne correspond à cette
              recherche.
            </p>
          </div>
        )}

      {/* Annuaire */}

      {!isLoading &&
        !errorMessage &&
        filteredProfiles.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProfiles.map((profile) => (
              <article
                key={profile.id}
                className="rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6"
              >
                {/* Identité */}

                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-100 text-xl font-black text-red-600 dark:bg-red-950/40 dark:text-red-400">
                    {profile.first_name
                      .charAt(0)
                      .toUpperCase()}

                    {profile.last_name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-black">
                        {profile.first_name}{" "}
                        {profile.last_name.toUpperCase()}
                      </h2>

                      {profile.access_role === "admin" && (
                        <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white dark:bg-white dark:text-slate-900">
                          🛡️ Admin
                        </span>
                      )}
                    </div>

                    {profile.grade && (
                      <p className="mt-1 text-sm font-bold text-red-600">
                        {profile.grade}
                      </p>
                    )}
                  </div>
                </div>

                {/* Téléphone */}

                {profile.phone && (
                  <a
                    href={`tel:${profile.phone.replace(
                      /\s/g,
                      ""
                    )}`}
                    className="mt-5 flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 transition hover:bg-muted"
                  >
                    <span className="text-xl">📞</span>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Téléphone
                      </p>

                      <p className="mt-0.5 font-bold">
                        {profile.phone}
                      </p>
                    </div>
                  </a>
                )}

                {/* Rôles métier */}

                {profile.businessRoles.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Fonctions
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.businessRoles.map((role) => {
                        const isCommandRole =
                          role.code === "chef_centre" ||
                          role.code === "adjoint_chef_centre";

                        return (
                          <span
                            key={role.code}
                            className={
                              isCommandRole
                                ? "inline-flex rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                : "inline-flex rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300"
                            }
                          >
                            {isCommandRole && (
                              <span className="mr-1">⭐</span>
                            )}
                            {role.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
    </main>
  );
}