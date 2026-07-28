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
    } catch (err) {
      console.error(err);

      setErrorMessage(
        "Une erreur est survenue lors de la connexion. Veuillez réessayer."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center px-4 py-8"
      style={{ backgroundImage: "url('/caserne.JPG')" }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <section className="relative z-10 w-full max-w-lg rounded-3xl border border-white/30 bg-white/80 p-7 shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="text-center">
          <Image
            src="/logosp.jpg"
            alt="Logo SP Viriat"
            width={150}
            height={150}
            className="mx-auto mb-2 object-contain"
            priority
          />

          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-600">
            Depuis 1868
          </p>

          <h1 className="mt-2 text-4xl font-bold text-slate-900">
            SP Viriat
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            L&apos;application du SLIS de Viriat
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleLogin}>
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-slate-700"
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Votre adresse e-mail"
              autoComplete="email"
              required
              disabled={isLoading}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Mot de passe
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              autoComplete="current-password"
              required
              disabled={isLoading}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:bg-slate-100"
            />
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-red-600 py-3 font-bold text-white transition hover:bg-red-700 active:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-400"
          >
            {isLoading ? "Connexion en cours..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-8 border-t border-slate-200 pt-5 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Connexion sécurisée
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Vos données sont protégées et les échanges sont chiffrés.
          </p>
        </div>
      </section>
    </main>
  );
}