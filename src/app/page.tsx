"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage("Adresse e-mail ou mot de passe incorrect.");
        return;
      }

      if (!data.session) {
        setErrorMessage("Impossible de créer la session utilisateur.");
        return;
      }

      window.location.assign("/dashboard");
    } catch (error) {
      console.error("Erreur de connexion :", error);

      setErrorMessage(
        "Une erreur est survenue lors de la connexion. Veuillez réessayer."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-8 sm:px-6"
      style={{ backgroundImage: "url('/caserne.jpg')" }}
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

          <form className="mt-8 space-y-5" onSubmit={handleLogin}>
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
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Votre adresse e-mail"
                required
                disabled={isLoading}
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-red-500 dark:focus:ring-red-950"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Mot de passe
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
              Vos données sont protégées et les échanges sont chiffrés.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}