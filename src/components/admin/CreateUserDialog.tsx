"use client";

import { useState } from "react";

import { supabase } from "@/lib/supabase";

type BusinessRole = {
  id: number;
  code: string;
  label: string;
};

type CreateUserDialogProps = {
  businessRoles: BusinessRole[];
  onClose: () => void;
  onCreated: () => void;
};

type CreatedUserCredentials = {
  firstName: string;
  lastName: string;
  email: string;
  temporaryPassword: string;
};

type CreateUserApiResponse = {
  error?: string;
  message?: string;
  temporaryPassword?: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    access_role: string;
    status: string;
    business_role_ids: number[];
  };
};

const ROLE_CATEGORIES = [
  {
    title: "Commandement",
    icon: "🚒",
    codes: ["chef_centre", "adjoint_chef_centre"],
  },
  {
    title: "Responsabilités opérationnelles",
    icon: "🧰",
    codes: [
      "responsable_pharmacie",
      "responsable_habillement",
      "responsable_materiel",
    ],
  },
  {
    title: "Corps",
    icon: "👥",
    codes: ["sapeur_pompier", "observateur"],
  },
  {
    title: "Amicale",
    icon: "🤝",
    codes: [
      "president_amicale",
      "president_amicale_anciens",
      "membre_bureau",
      "amicaliste",
    ],
  },
];

export default function CreateUserDialog({
  businessRoles,
  onClose,
  onCreated,
}: CreateUserDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [createdUser, setCreatedUser] =
    useState<CreatedUserCredentials | null>(null);

  const [isCopied, setIsCopied] = useState(false);

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId]
    );
  };

  const handleClose = () => {
    if (isCreating) {
      return;
    }

    /*
     * Si l'utilisateur vient d'être créé, on prévient la page
     * d'administration afin qu'elle recharge la liste.
     */
    if (createdUser) {
      onCreated();
      return;
    }

    onClose();
  };

  const handleCreate = async () => {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirstName || !cleanLastName || !cleanEmail) {
      setErrorMessage(
        "Le prénom, le nom et l'adresse e-mail sont obligatoires."
      );
      return;
    }

    setIsCreating(true);
    setErrorMessage("");
    setIsCopied(false);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setErrorMessage(
          "Votre session a expiré. Veuillez vous reconnecter."
        );
        return;
      }

      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          firstName: cleanFirstName,
          lastName: cleanLastName,
          email: cleanEmail,
          businessRoleIds: selectedRoleIds,
        }),
      });

      const result =
        (await response.json()) as CreateUserApiResponse;

      if (!response.ok) {
        setErrorMessage(
          result.error ?? "Impossible de créer l'utilisateur."
        );
        return;
      }

      if (!result.temporaryPassword) {
        setErrorMessage(
          "L'utilisateur a été créé, mais le mot de passe provisoire n'a pas été retourné."
        );
        return;
      }

      setCreatedUser({
        firstName: cleanFirstName,
        lastName: cleanLastName,
        email: cleanEmail,
        temporaryPassword: result.temporaryPassword,
      });
    } catch (error) {
      console.error("Erreur création utilisateur :", error);

      setErrorMessage(
        "Une erreur inattendue est survenue pendant la création."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const buildConnectionMessage = () => {
    if (!createdUser) {
      return "";
    }

    const applicationUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "";

    return `Votre compte SP Viriat a été créé.

Connexion :
${applicationUrl}

Identifiant :
${createdUser.email}

Mot de passe provisoire :
${createdUser.temporaryPassword}

Lors de votre première connexion, vous devrez choisir un nouveau mot de passe et compléter votre numéro de téléphone.`;
  };

  const handleCopy = async () => {
    if (!createdUser) {
      return;
    }

    setErrorMessage("");

    try {
      await navigator.clipboard.writeText(
        buildConnectionMessage()
      );

      setIsCopied(true);

      window.setTimeout(() => {
        setIsCopied(false);
      }, 2500);
    } catch (error) {
      console.error(
        "Impossible de copier les informations :",
        error
      );

      setErrorMessage(
        "Impossible de copier automatiquement les informations. Vous pouvez les copier manuellement."
      );
    }
  };

  /*
   * =====================================================
   * ÉCRAN DE SUCCÈS
   * =====================================================
   */

  if (createdUser) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            handleClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-success-title"
          className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl dark:bg-emerald-950/40">
                ✅
              </div>

              <p className="mt-5 text-sm font-bold uppercase tracking-widest text-emerald-600">
                Utilisateur créé
              </p>

              <h2
                id="create-user-success-title"
                className="mt-2 text-2xl font-black sm:text-3xl"
              >
                Compte créé avec succès
              </h2>

              <p className="mt-2 text-slate-500 dark:text-slate-400">
                Copiez les informations ci-dessous et
                transmettez-les à l&apos;utilisateur.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Fermer"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              ×
            </button>
          </div>

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Utilisateur
              </p>

              <p className="mt-1 text-xl font-black">
                {createdUser.firstName} {createdUser.lastName}
              </p>
            </div>

            <div className="mt-5">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Identifiant
              </p>

              <p className="mt-1 break-all font-bold">
                {createdUser.email}
              </p>
            </div>

            <div className="mt-5">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Mot de passe provisoire
              </p>

              <div className="mt-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="break-all font-mono text-lg font-black tracking-wide text-amber-900 dark:text-amber-200">
                  {createdUser.temporaryPassword}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>Important :</strong> ce mot de passe
            provisoire ne sera plus affiché après la fermeture de
            cette fenêtre. Copiez-le avant de terminer.
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className={
                isCopied
                  ? "w-full rounded-2xl bg-emerald-600 px-6 py-3.5 font-bold text-white transition"
                  : "w-full rounded-2xl bg-slate-900 px-6 py-3.5 font-bold text-white transition hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              }
            >
              {isCopied
                ? "✓ Informations copiées"
                : "📋 Copier les informations de connexion"}
            </button>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-2xl bg-red-600 px-6 py-3.5 font-bold text-white transition hover:bg-red-700 active:scale-[0.98]"
            >
              Terminer
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * =====================================================
   * FORMULAIRE DE CRÉATION
   * =====================================================
   */

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isCreating
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-red-600">
              Administration
            </p>

            <h2
              id="create-user-title"
              className="mt-2 text-2xl font-black sm:text-3xl"
            >
              Créer un utilisateur
            </h2>

            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Un mot de passe provisoire sera généré
              automatiquement. L&apos;utilisateur devra le modifier
              lors de sa première connexion.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
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
            Informations
          </h3>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <label>
              <span className="text-sm font-bold">
                Prénom *
              </span>

              <input
                type="text"
                value={firstName}
                onChange={(event) =>
                  setFirstName(event.target.value)
                }
                disabled={isCreating}
                autoComplete="given-name"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
              />
            </label>

            <label>
              <span className="text-sm font-bold">
                Nom *
              </span>

              <input
                type="text"
                value={lastName}
                onChange={(event) =>
                  setLastName(event.target.value)
                }
                disabled={isCreating}
                autoComplete="family-name"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-sm font-bold">
                Adresse e-mail *
              </span>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                disabled={isCreating}
                autoComplete="email"
                placeholder="prenom.nom@exemple.fr"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
              />
            </label>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-8 dark:border-slate-800">
          <h3 className="text-lg font-black">
            Rôles métier
          </h3>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sélectionne les fonctions de l&apos;utilisateur.
            Plusieurs rôles peuvent être attribués.
          </p>

          <div className="mt-5 space-y-6">
            {ROLE_CATEGORIES.map((category) => {
              const roles = category.codes
                .map((code) =>
                  businessRoles.find(
                    (role) => role.code === code
                  )
                )
                .filter(
                  (role): role is BusinessRole =>
                    Boolean(role)
                );

              if (roles.length === 0) {
                return null;
              }

              return (
                <section key={category.title}>
                  <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <span aria-hidden="true">
                      {category.icon}
                    </span>

                    {category.title}
                  </h4>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {roles.map((role) => {
                      const selected =
                        selectedRoleIds.includes(role.id);

                      return (
                        <label
                          key={role.id}
                          className={
                            selected
                              ? "flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-red-600 bg-red-50 px-4 py-3 text-red-700 transition dark:bg-red-950/30 dark:text-red-300"
                              : "flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-slate-200 px-4 py-3 text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                          }
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={isCreating}
                            onChange={() =>
                              toggleRole(role.id)
                            }
                            className="h-5 w-5 shrink-0 accent-red-600 disabled:cursor-not-allowed"
                          />

                          <span className="font-bold">
                            {role.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="rounded-2xl border border-slate-300 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isCreating}
            className="rounded-2xl bg-red-600 px-6 py-3 font-bold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating
              ? "Création en cours..."
              : "Créer l'utilisateur"}
          </button>
        </div>
      </div>
    </div>
  );
}