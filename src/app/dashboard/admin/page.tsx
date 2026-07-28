"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AccessRole = "user" | "admin";

type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  matricule: string | null;
  grade: string | null;
  phone: string | null;
  role: string | null;
  access_role: AccessRole;
  status: string | null;
};

export default function AdminPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const loadAdminPage = async () => {
      setErrorMessage("");
      setSuccessMessage("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace("/");
        return;
      }

      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("access_role")
        .eq("id", session.user.id)
        .single();

      if (profileError || currentProfile?.access_role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      const { data: profiles, error: usersError } = await supabase
        .from("profiles")
        .select(`
          id,
          first_name,
          last_name,
          matricule,
          grade,
          phone,
          role,
          access_role,
          status
        `)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      if (usersError) {
        console.error(
          "Erreur lors de la récupération des utilisateurs :",
          usersError
        );

        setErrorMessage(
          "Impossible de récupérer la liste des utilisateurs."
        );
      } else {
        setUsers((profiles ?? []) as UserProfile[]);
      }

      setIsLoading(false);
    };

    void loadAdminPage();
  }, [router]);

  const openEditDialog = (user: UserProfile) => {
    setErrorMessage("");
    setSuccessMessage("");
    setSelectedUser({ ...user });
  };

  const closeEditDialog = () => {
    if (isSaving) {
      return;
    }

    setSelectedUser(null);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) {
      return;
    }

    const firstName = selectedUser.first_name.trim();
    const lastName = selectedUser.last_name.trim();

    if (!firstName || !lastName) {
      setErrorMessage("Le prénom et le nom sont obligatoires.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        matricule: selectedUser.matricule?.trim() || null,
        grade: selectedUser.grade?.trim() || null,
        phone: selectedUser.phone?.trim() || null,
        access_role: selectedUser.access_role,
      })
      .eq("id", selectedUser.id)
      .select(`
        id,
        first_name,
        last_name,
        matricule,
        grade,
        phone,
        role,
        access_role,
        status
      `)
      .single();

    if (error) {
      console.error(
        "Erreur lors de la modification de l'utilisateur :",
        error
      );

      setErrorMessage(
        "Les modifications n'ont pas pu être enregistrées."
      );

      setIsSaving(false);
      return;
    }

    const savedUser = updatedProfile as UserProfile;

    setUsers((currentUsers) =>
      currentUsers
        .map((user) =>
          user.id === savedUser.id ? savedUser : user
        )
        .sort((firstUser, secondUser) => {
          const firstFullName =
            `${firstUser.last_name} ${firstUser.first_name}`.trim();

          const secondFullName =
            `${secondUser.last_name} ${secondUser.first_name}`.trim();

          return firstFullName.localeCompare(secondFullName, "fr");
        })
    );

    setSelectedUser(null);
    setSuccessMessage("L'utilisateur a été modifié avec succès.");
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="rounded-3xl bg-white px-8 py-7 text-center shadow-xl dark:bg-slate-900">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

          <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
            Chargement de l&apos;administration...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-red-600">
              Administration
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Gestion des utilisateurs
            </h1>

            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Gère les informations et les droits d&apos;accès des utilisateurs.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
          >
            ← Retour au tableau de bord
          </Link>
        </div>

        {errorMessage && !selectedUser && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            {successMessage}
          </div>
        )}

        <section className="mt-8 overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800 sm:px-6">

                      <h2 className="text-xl font-extrabold">
              Utilisateurs
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {users.length} utilisateur{users.length > 1 ? "s" : ""}
            </p>
          </div>

          {users.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              Aucun utilisateur trouvé.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((user) => {
                const fullName =
                  `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
                  "Utilisateur sans nom";

                return (
                  <article
                    key={user.id}
                    className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-lg font-extrabold">
                        {fullName}
                      </p>

                      {(user.grade || user.matricule || user.phone) && (
                        <div className="mt-1 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                          {(user.grade || user.matricule) && (
                            <p>
                              {user.grade || "Grade non renseigné"}
                              {user.matricule
                                ? ` • Matricule ${user.matricule}`
                                : ""}
                            </p>
                          )}

                          {user.phone && (
                            <p>
                              Téléphone : {user.phone}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {user.role || "Rôle métier non renseigné"}
                        </span>

                        <span
                          className={
                            user.access_role === "admin"
                              ? "rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300"
                              : "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          }
                        >
                          {user.access_role === "admin"
                            ? "Administrateur"
                            : "Utilisateur"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditDialog(user)}
                        className="rounded-2xl bg-red-600 px-5 py-2.5 font-bold text-white transition hover:bg-red-700 active:scale-[0.98]"
                      >
                        ✏️ Modifier
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditDialog();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-red-600">
                  Administration
                </p>

                <h2
                  id="edit-user-title"
                  className="mt-2 text-2xl font-black sm:text-3xl"
                >
                  Modifier l&apos;utilisateur
                </h2>

                <p className="mt-2 text-slate-500 dark:text-slate-400">
                  Modifie ses informations et son niveau d&apos;accès.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditDialog}
                disabled={isSaving}
                aria-label="Fermer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ×
              </button>
            </div>

            {errorMessage && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            <div className="mt-8">
              <h3 className="text-lg font-black">
                Informations personnelles
              </h3>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Prénom
                  </span>

                  <input
                    type="text"
                    value={selectedUser.first_name}
                    onChange={(event) =>
                      setSelectedUser({
                        ...selectedUser,
                        first_name: event.target.value,
                      })
                    }
                    disabled={isSaving}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Nom
                  </span>

                  <input
                    type="text"
                    value={selectedUser.last_name}
                    onChange={(event) =>
                      setSelectedUser({
                        ...selectedUser,
                        last_name: event.target.value,
                      })
                    }
                    disabled={isSaving}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Matricule
                  </span>

                  <input
                    type="text"
                    value={selectedUser.matricule ?? ""}
                    onChange={(event) =>
                      setSelectedUser({
                        ...selectedUser,
                        matricule: event.target.value,
                      })
                    }
                    disabled={isSaving}
                    placeholder="Ex. 123456"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Grade
                  </span>

                  <input
                    type="text"
                    value={selectedUser.grade ?? ""}
                    onChange={(event) =>
                      setSelectedUser({
                        ...selectedUser,
                        grade: event.target.value,
                      })
                    }
                    disabled={isSaving}
                    placeholder="Ex. Caporal"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Téléphone
                  </span>

                  <input
                    type="tel"
                    value={selectedUser.phone ?? ""}
                    onChange={(event) =>
                      setSelectedUser({
                        ...selectedUser,
                        phone: event.target.value,
                      })
                    }
                    disabled={isSaving}
                    placeholder="Ex. 06 12 34 56 78"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
                  />
                </label>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-8 dark:border-slate-800">
              <h3 className="text-lg font-black">
                Droits d&apos;accès
              </h3>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Un administrateur peut accéder à la gestion de l&apos;application.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    setSelectedUser({
                      ...selectedUser,
                      access_role: "user",
                    })
                  }
                  className={
                    selectedUser.access_role === "user"
                      ? "rounded-2xl border-2 border-blue-600 bg-blue-50 px-5 py-4 text-left text-blue-700 transition disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-950/30 dark:text-blue-300"
                      : "rounded-2xl border-2 border-slate-200 px-5 py-4 text-left text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                  }
                >
                  <span className="block font-black">
                    Utilisateur
                  </span>

                  <span className="mt-1 block text-sm opacity-80">
                    Accès normal à l&apos;application.
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    setSelectedUser({
                      ...selectedUser,
                      access_role: "admin",
                    })
                  }
                  className={
                    selectedUser.access_role === "admin"
                      ? "rounded-2xl border-2 border-red-600 bg-red-50 px-5 py-4 text-left text-red-700 transition disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-950/30 dark:text-red-300"
                      : "rounded-2xl border-2 border-slate-200 px-5 py-4 text-left text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                  }
                >
                  <span className="block font-black">
                    Administrateur
                  </span>

                  <span className="mt-1 block text-sm opacity-80">
                    Accès à la gestion des utilisateurs.
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEditDialog}
                disabled={isSaving}
                className="rounded-2xl border border-slate-300 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={() => void handleSaveUser()}
                disabled={isSaving}
                className="rounded-2xl bg-red-600 px-6 py-3 font-bold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}