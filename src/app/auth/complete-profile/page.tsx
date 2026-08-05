"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type CompleteProfileResponse = {
  message?: string;
  error?: string;

  profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    access_role: string | null;
    status: string | null;
  };
};

export default function CompleteProfilePage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [
    passwordConfirmation,
    setPasswordConfirmation,
  ] = useState("");

  const [phone, setPhone] = useState("");

  const [
    isCheckingSession,
    setIsCheckingSession,
  ] = useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [
    hasValidSession,
    setHasValidSession,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /*
   * =====================================================
   * VÉRIFICATION DE LA SESSION
   * =====================================================
   */

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

        setHasValidSession(false);
        setIsCheckingSession(false);

        return;
      }

      setHasValidSession(Boolean(session));
      setIsCheckingSession(false);
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) {
          return;
        }

        setHasValidSession(
          Boolean(session)
        );

        setIsCheckingSession(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /*
   * =====================================================
   * ACTIVATION
   * =====================================================
   */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanPhone = phone.trim();

    /*
     * ===================================================
     * VALIDATION
     * ===================================================
     */

    if (!password) {
      setErrorMessage(
        "Le mot de passe est obligatoire."
      );

      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        "Le mot de passe doit contenir au moins 8 caractères."
      );

      return;
    }

    if (
      password !==
      passwordConfirmation
    ) {
      setErrorMessage(
        "Les deux mots de passe ne correspondent pas."
      );

      return;
    }

    setIsSaving(true);

    try {
      /*
       * =================================================
       * 1. VÉRIFICATION DE LA SESSION
       * =================================================
       */

      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.user ||
        !session.access_token
      ) {
        setErrorMessage(
          "Votre session n'est plus valide. Veuillez vous reconnecter."
        );

        return;
      }

      /*
       * =================================================
       * 2. CRÉATION DU MOT DE PASSE
       * =================================================
       */

      const {
        error: passwordError,
      } =
        await supabase.auth.updateUser({
          password,
        });

      if (passwordError) {
        console.error(
          "Erreur lors de la création du mot de passe :",
          passwordError
        );

        /*
         * Supabase refuse notamment de remplacer
         * le mot de passe par exactement le même.
         */

        if (
          passwordError.message
            .toLowerCase()
            .includes(
              "different from the old password"
            )
        ) {
          setErrorMessage(
            "Ce mot de passe est déjà celui de votre compte. Choisissez un nouveau mot de passe différent."
          );

          return;
        }

        setErrorMessage(
          passwordError.message ||
            "Impossible d'enregistrer le mot de passe."
        );

        return;
      }

      /*
       * =================================================
       * 3. RÉCUPÉRATION DU TOKEN ACTUALISÉ
       * =================================================
       */

      const {
        data: {
          session: updatedSession,
        },
        error:
          updatedSessionError,
      } =
        await supabase.auth.getSession();

      if (
        updatedSessionError ||
        !updatedSession?.access_token
      ) {
        setErrorMessage(
          "Le mot de passe a été enregistré, mais votre session n'a pas pu être actualisée. Veuillez vous reconnecter."
        );

        return;
      }

      /*
       * =================================================
       * 4. FINALISATION DU PROFIL
       * =================================================
       *
       * IMPORTANT :
       *
       * La route utilisée est maintenant :
       *
       * /api/activate-account
       *
       * et non :
       *
       * /api/auth/complete-profile
       */

      const response = await fetch(
  "/api/auth/complete-profile",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${updatedSession.access_token}`,
          },

          body: JSON.stringify({
            phone: cleanPhone,
          }),
        }
      );

      /*
       * =================================================
       * 5. LECTURE SÉCURISÉE DE LA RÉPONSE
       * =================================================
       *
       * On lit d'abord la réponse en texte.
       * Cela permet de diagnostiquer proprement
       * une éventuelle réponse HTML de Next.js.
       */

      const responseText =
        await response.text();

      let result:
        CompleteProfileResponse;

      try {
        result = responseText
          ? (JSON.parse(
              responseText
            ) as CompleteProfileResponse)
          : {};
      } catch (jsonError) {
        console.error(
          "Réponse non JSON de /api/activate-account :",
          {
            status: response.status,
            statusText:
              response.statusText,
            body: responseText,
            jsonError,
          }
        );

        setErrorMessage(
          `La finalisation du compte a échoué : le serveur a renvoyé une réponse invalide (${response.status}).`
        );

        return;
      }

      /*
       * =================================================
       * 6. ERREUR API
       * =================================================
       */

      if (!response.ok) {
        console.error(
          "Erreur API /api/activate-account :",
          response.status,
          result
        );

        setErrorMessage(
          result.error ??
            `Impossible de finaliser le compte (erreur ${response.status}).`
        );

        return;
      }

      /*
       * =================================================
       * 7. VÉRIFICATION DU PROFIL
       * =================================================
       */

      if (
        result.profile?.status !==
        "active"
      ) {
        console.error(
          "Le serveur n'a pas retourné un profil actif :",
          result
        );

        setErrorMessage(
          "Le compte a été traité, mais son statut n'est pas correctement activé."
        );

        return;
      }

      /*
       * =================================================
       * 8. SUCCÈS
       * =================================================
       */

      setSuccessMessage(
        result.message ??
          "Votre compte est prêt. Redirection vers le tableau de bord..."
      );

      setPassword("");
      setPasswordConfirmation("");

      /*
       * =================================================
       * 9. REDIRECTION
       * =================================================
       */

      window.setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 800);
    } catch (error) {
      console.error(
        "Erreur inattendue lors de l'activation du compte :",
        error
      );

      setErrorMessage(
        "Une erreur inattendue est survenue. Veuillez réessayer."
      );
    } finally {
      setIsSaving(false);
    }
  };

  /*
   * =====================================================
   * CHARGEMENT
   * =====================================================
   */

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl dark:bg-slate-900">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600 dark:border-slate-700" />

          <p className="mt-5 font-bold text-slate-700 dark:text-slate-200">
            Vérification de votre
            invitation...
          </p>
        </div>
      </main>
    );
  }

  /*
   * =====================================================
   * SESSION ABSENTE
   * =====================================================
   */

  if (!hasValidSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl dark:bg-slate-900 sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-2xl dark:bg-red-950/40">
            ⚠️
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-widest text-red-600">
            SP Viriat
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
            Invitation invalide
          </h1>

          <p className="mt-4 leading-7 text-slate-600 dark:text-slate-400">
            Votre session
            d&apos;activation est
            invalide, a expiré ou
            n&apos;est plus disponible.
          </p>

          <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">
            Revenez à la connexion et
            utilisez les identifiants qui
            vous ont été communiqués.
          </p>

          <button
            type="button"
            onClick={() =>
              router.replace("/")
            }
            className="mt-8 w-full rounded-2xl bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700 active:scale-[0.98]"
          >
            Retour à la connexion
          </button>
        </div>
      </main>
    );
  }

  /*
   * =====================================================
   * FORMULAIRE
   * =====================================================
   */

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-900 sm:p-10">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-red-600">
            SP Viriat
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Activez votre compte
          </h1>

          <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">
            Choisissez votre mot de
            passe et complétez votre
            numéro de téléphone.
          </p>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            ✅ {successMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >
          <label className="block">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Téléphone
            </span>

            <input
              type="tel"
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target.value
                )
              }
              disabled={isSaving}
              autoComplete="tel"
              placeholder="Ex. 06 12 34 56 78"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Mot de passe *
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              disabled={isSaving}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Au moins 8 caractères"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Confirmer le mot de passe *
            </span>

            <input
              type="password"
              value={
                passwordConfirmation
              }
              onChange={(event) =>
                setPasswordConfirmation(
                  event.target.value
                )
              }
              disabled={isSaving}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Saisissez de nouveau votre mot de passe"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
            />
          </label>

          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Votre mot de passe doit
            contenir au minimum{" "}
            <strong>
              8 caractères
            </strong>
            .
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-2xl bg-red-600 px-6 py-3.5 font-bold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? "Activation du compte..."
              : "Activer mon compte"}
          </button>
        </form>
      </div>
    </main>
  );
}