"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error(
          "Erreur lors de la vérification de la session :",
          error
        );
      }

      if (session) {
        setHasSession(true);
      }

      setIsChecking(false);
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
      }

      setIsChecking(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (!newPassword || !confirmation) {
      setErrorMessage(
        "Les deux champs sont obligatoires."
      );
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage(
        "Le mot de passe doit contenir au moins 8 caractères."
      );
      return;
    }

    if (newPassword !== confirmation) {
      setErrorMessage(
        "Les deux mots de passe ne correspondent pas."
      );
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error(
          "Erreur lors de la réinitialisation du mot de passe :",
          error
        );

        setErrorMessage(
          error.message ||
            "Impossible de modifier votre mot de passe."
        );

        return;
      }

      setNewPassword("");
      setConfirmation("");

      setSuccessMessage(
        "Votre mot de passe a été modifié avec succès. Retour à la connexion..."
      );

      window.setTimeout(async () => {
        await supabase.auth.signOut({
          scope: "local",
        });

        router.replace("/");
      }, 1500);
    } catch (error) {
      console.error(
        "Erreur inattendue lors de la réinitialisation :",
        error
      );

      setErrorMessage(
        "Une erreur inattendue est survenue. Veuillez réessayer."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="rounded-3xl bg-white px-8 py-7 text-center shadow-xl dark:bg-slate-900">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-red-600 dark:border-slate-700" />

          <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
            Vérification du lien...
          </p>
        </div>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-950 dark:bg-slate-950 dark:text-white">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl dark:bg-slate-900">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-2xl dark:bg-red-950/40">
            ⚠️
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-widest text-red-600">
            SP Viriat
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Lien invalide
          </h1>

          <p className="mt-4 leading-7 text-slate-600 dark:text-slate-400">
            Ce lien de récupération est invalide, a expiré ou a déjà été
            utilisé.
          </p>

          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-8 w-full rounded-2xl bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700 active:scale-[0.98]"
          >
            Retour à la connexion
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-900 sm:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-2xl dark:bg-red-950/40">
          🔐
        </div>

        <p className="mt-6 text-sm font-bold uppercase tracking-widest text-red-600">
          SP Viriat
        </p>

        <h1 className="mt-2 text-3xl font-black">
          Nouveau mot de passe
        </h1>

        <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            ✅ {successMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >
          <label className="block">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Nouveau mot de passe
            </span>

            <input
              type="password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(event.target.value)
              }
              required
              minLength={8}
              disabled={isSaving}
              autoComplete="new-password"
              placeholder="Au moins 8 caractères"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Confirmer le mot de passe
            </span>

            <input
              type="password"
              value={confirmation}
              onChange={(event) =>
                setConfirmation(event.target.value)
              }
              required
              minLength={8}
              disabled={isSaving}
              autoComplete="new-password"
              placeholder="Confirmez votre mot de passe"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
            />
          </label>

          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Le nouveau mot de passe doit contenir au minimum{" "}
            <strong>8 caractères</strong>.
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-2xl bg-red-600 px-6 py-3.5 font-bold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? "Modification..."
              : "Modifier mon mot de passe"}
          </button>
        </form>
      </div>
    </main>
  );
}