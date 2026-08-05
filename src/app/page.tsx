"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

import { supabase } from "@/lib/supabase";

type UserProfileStatus = {
  status: string | null;
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isForgotPasswordOpen, setIsForgotPasswordOpen] =
    useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [isSendingReset, setIsSendingReset] =
    useState(false);

  const [resetError, setResetError] =
    useState("");

  const [resetSuccess, setResetSuccess] =
    useState("");

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setIsLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (error) {
        console.error("Erreur Supabase :", error);

        if (error.status === 400) {
          setErrorMessage(
            "Adresse e-mail ou mot de passe incorrect."
          );
        } else {
          setErrorMessage(
            "Impossible de vous connecter. Veuillez réessayer."
          );
        }

        return;
      }

      if (!data.session || !data.user) {
        setErrorMessage(
          "Impossible de créer la session utilisateur."
        );

        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", data.user.id)
        .single<UserProfileStatus>();

      if (profileError || !profile) {
        console.error(
          "Impossible de récupérer le profil :",
          profileError
        );

        await supabase.auth.signOut();

        setErrorMessage(
          "Votre compte existe, mais votre profil n'a pas pu être chargé. Contactez un administrateur."
        );

        return;
      }

      if (profile.status === "temporary_password") {
        window.location.assign(
          "/auth/complete-profile"
        );

        return;
      }

      window.location.assign("/dashboard");
    } catch (error) {
      console.error(
        "Erreur de connexion :",
        error
      );

      setErrorMessage(
        "Une erreur est survenue lors de la connexion. Veuillez réessayer."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const openForgotPassword = () => {
    setResetError("");
    setResetSuccess("");

    setResetEmail(
      email.trim().toLowerCase()
    );

    setIsForgotPasswordOpen(true);
  };

  const closeForgotPassword = () => {
    if (isSendingReset) {
      return;
    }

    setIsForgotPasswordOpen(false);
    setResetError("");
    setResetSuccess("");
  };

  const handleForgotPassword = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const cleanEmail =
      resetEmail.trim().toLowerCase();

    setResetError("");
    setResetSuccess("");

    if (!cleanEmail) {
      setResetError(
        "Veuillez saisir votre adresse e-mail."
      );

      return;
    }

    setIsSendingReset(true);

    try {
      const redirectTo =
        `${window.location.origin}/auth/reset-password`;

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo,
          }
        );

      if (error) {
        console.error(
          "Erreur récupération mot de passe :",
          error
        );

        if (
          error.status === 429 ||
          error.message
            .toLowerCase()
            .includes("rate limit")
        ) {
          setResetError(
            "Trop d'e-mails ont été envoyés récemment. Veuillez réessayer un peu plus tard."
          );

          return;
        }

        setResetError(
          "Impossible d'envoyer l'e-mail de récupération pour le moment."
        );

        return;
      }

      /*
       * Message volontairement générique :
       * on ne révèle pas si une adresse existe ou non.
       */
      setResetSuccess(
        "Si cette adresse correspond à un compte SP Viriat, un e-mail de réinitialisation vient d'être envoyé."
      );
    } catch (error) {
      console.error(
        "Erreur inattendue récupération mot de passe :",
        error
      );

      setResetError(
        "Une erreur inattendue est survenue. Veuillez réessayer."
      );
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-8 sm:px-6"
      style={{
        backgroundImage: "url('/caserne.jpg')",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/65" />

      <div className="absolute inset-0 bg-gradient-to-br from-red-950/50 via-slate-950/20 to-slate-950/70" />

      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-red-600/20 blur-3xl" />

      <div className="absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-orange-500/15 blur-3xl" />

      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/20 bg-white/90 shadow-2xl backdrop-blur-2xl dark:bg-slate-950/85">
        <div className="h-1.5 w-full bg-gradient-to-r from-red-700 via-red-500 to-orange-500" />

        <div className="p-6 sm:p-9">
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-3xl border border-white/60 bg-white p-3 shadow-lg sm:h-32 sm:w-32">
              <Image
                src="/logosp.jpg"
                alt="Logo des Sapeurs-Pompiers de Viriat"
                width={130}
                height={130}
                className="h-full w-full object-contain"
                priority
              />
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.35em] text-red-600">
              Depuis 1868
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              SP Viriat
            </h1>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              L&apos;application du SLIS de Viriat
            </p>
          </div>

          <form
            className="mt-8 space-y-5"
            onSubmit={handleLogin}
          >
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Adresse e-mail
              </label>

              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Votre adresse e-mail"
                required
                disabled={isLoading}
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-red-500 dark:focus:ring-red-950"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Mot de passe
                </label>

                <button
                  type="button"
                  onClick={openForgotPassword}
                  disabled={isLoading}
                  className="text-sm font-bold text-red-600 transition hover:text-red-700 hover:underline disabled:opacity-50"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Votre mot de passe"
                required
                disabled={isLoading}
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-red-500 dark:focus:ring-red-950"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-red-700 to-red-600 px-4 font-bold text-white shadow-lg shadow-red-900/20 transition duration-200 hover:from-red-800 hover:to-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <span className="flex items-center gap-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />

                  Connexion en cours...
                </span>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <div className="mt-7 border-t border-slate-200 pt-5 text-center dark:border-slate-800">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                ✓
              </span>

              Connexion sécurisée
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Vos données sont protégées et les échanges sont
              chiffrés.
            </p>
          </div>
        </div>
      </section>

      {isForgotPasswordOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !isSendingReset
            ) {
              closeForgotPassword();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-password-title"
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-xl dark:bg-red-950/40">
                  🔑
                </div>

                <p className="mt-5 text-sm font-bold uppercase tracking-widest text-red-600">
                  SP Viriat
                </p>

                <h2
                  id="forgot-password-title"
                  className="mt-2 text-2xl font-black"
                >
                  Mot de passe oublié
                </h2>

                <p className="mt-2 leading-6 text-slate-500 dark:text-slate-400">
                  Saisissez votre adresse e-mail. Vous recevrez
                  un lien permettant de choisir un nouveau mot
                  de passe.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForgotPassword}
                disabled={isSendingReset}
                aria-label="Fermer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleForgotPassword}
              className="mt-7"
            >
              <label className="block">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Adresse e-mail
                </span>

                <input
                  type="email"
                  value={resetEmail}
                  onChange={(event) => {
                    setResetEmail(
                      event.target.value
                    );

                    setResetError("");
                    setResetSuccess("");
                  }}
                  required
                  disabled={isSendingReset}
                  autoComplete="email"
                  placeholder="prenom.nom@exemple.fr"
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
                />
              </label>

              {resetError && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                >
                  {resetError}
                </div>
              )}

              {resetSuccess && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold leading-6 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                  ✅ {resetSuccess}
                </div>
              )}

              {!resetSuccess && (
                <button
                  type="submit"
                  disabled={isSendingReset}
                  className="mt-6 w-full rounded-2xl bg-red-600 px-6 py-3.5 font-bold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingReset
                    ? "Envoi en cours..."
                    : "Envoyer le lien de récupération"}
                </button>
              )}

              {resetSuccess && (
                <button
                  type="button"
                  onClick={closeForgotPassword}
                  className="mt-6 w-full rounded-2xl bg-slate-900 px-6 py-3.5 font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  Fermer
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </main>
  );
}