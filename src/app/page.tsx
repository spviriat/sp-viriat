"use client";

import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [showPassword, setShowPassword] = useState(false);

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

        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => event.preventDefault()}
        >
          <div>
            <label
              htmlFor="identifiant"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Identifiant
            </label>

            <input
              id="identifiant"
              name="identifiant"
              type="text"
              autoComplete="username"
              placeholder="Votre identifiant"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            />
          </div>

          <div>
            <label
              htmlFor="mot-de-passe"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Mot de passe
            </label>

            <div className="relative">
              <input
                id="mot-de-passe"
                name="mot-de-passe"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Votre mot de passe"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-24 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-3 text-sm font-semibold text-orange-600"
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
          </div>

          <div className="text-right">
            <button
              type="button"
              className="text-sm font-medium text-orange-700 hover:underline"
            >
              Mot de passe oublié ?
            </button>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-red-600 px-4 py-3.5 font-bold text-white shadow-lg transition hover:bg-red-700 active:scale-[0.98]"
          >
            Se connecter
          </button>
        </form>

        <div className="mt-8 border-t border-slate-200 pt-5 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Connexion sécurisée
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Vos données sont protégées et les échanges sont chiffrés.
          </p>
        </div>
      </section>
    </main>
  );
}