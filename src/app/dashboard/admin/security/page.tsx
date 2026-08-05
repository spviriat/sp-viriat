"use client";

import Link from "next/link";
import { useState } from "react";

import { supabase } from "@/lib/supabase";

type TestResult = {
  name: string;
  expected: string;
  received: string;
  success: boolean;
  response: unknown;
};

type AdminProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  access_role: string | null;
};

const FAKE_USER_ID =
  "00000000-0000-0000-0000-000000000000";

async function readResponse(
  response: Response
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return "Réponse non JSON";
  }
}

export default function SecurityTestPage() {
  const [isTesting, setIsTesting] =
    useState(false);

  const [results, setResults] =
    useState<TestResult[]>([]);

  const [globalError, setGlobalError] =
    useState("");

  const runTests = async () => {
    setIsTesting(true);
    setResults([]);
    setGlobalError("");

    const testResults: TestResult[] = [];

    /*
     * Petite fonction utilitaire.
     *
     * Elle évite de répéter le même code
     * try/catch pour tous les tests HTTP.
     */
    const runHttpTest = async ({
      name,
      expected,
      expectedStatus,
      url,
      method,
      headers,
      body,
    }: {
      name: string;
      expected: string;
      expectedStatus: number;
      url: string;
      method: string;
      headers?: HeadersInit;
      body?: unknown;
    }) => {
      try {
        const response = await fetch(
          url,
          {
            method,
            headers,
            ...(body !== undefined
              ? {
                  body:
                    JSON.stringify(
                      body
                    ),
                }
              : {}),
          }
        );

        const responseBody =
          await readResponse(
            response
          );

        testResults.push({
          name,
          expected,
          received:
            String(
              response.status
            ),
          success:
            response.status ===
            expectedStatus,
          response:
            responseBody,
        });
      } catch (error) {
        testResults.push({
          name,
          expected,
          received:
            "Erreur réseau",
          success: false,
          response:
            error instanceof Error
              ? error.message
              : "Erreur inconnue",
        });
      }
    };

    try {
      /*
       * =================================================
       * SESSION
       * =================================================
       */

      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        setGlobalError(
          "Aucune session Supabase valide."
        );

        return;
      }

      const accessToken =
        session.access_token;

      const currentUserId =
        session.user.id;

      /*
       * =================================================
       * VÉRIFICATION DU COMPTE ADMIN
       * =================================================
       */

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          id,
          first_name,
          last_name,
          access_role
        `)
        .eq(
          "id",
          currentUserId
        )
        .single();

      if (
        profileError ||
        !profileData
      ) {
        console.error(
          "Impossible de récupérer le profil :",
          profileError
        );

        setGlobalError(
          "Impossible de vérifier le profil du compte connecté."
        );

        return;
      }

      const profile =
        profileData as AdminProfile;

      if (
        profile.access_role !==
        "admin"
      ) {
        setGlobalError(
          "Cette série doit être lancée avec un compte Administrateur."
        );

        return;
      }

      const firstName =
        profile.first_name?.trim() ||
        "Administrateur";

      const lastName =
        profile.last_name?.trim() ||
        "Test";

      /*
       * =================================================
       * TEST 1
       *
       * ADMIN — accès CREATE
       * =================================================
       *
       * Payload volontairement invalide.
       *
       * Si l'admin passe les autorisations,
       * la route doit arriver jusqu'à la
       * validation des champs.
       *
       * Attendu : 400
       *
       * Aucun utilisateur n'est créé.
       */

      await runHttpTest({
        name:
          "Admin — accès CREATE",

        expected:
          "400 (autorisé, payload invalide)",

        expectedStatus: 400,

        url:
          "/api/admin/users/invite",

        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          firstName: "",
          lastName: "",
          email: "",
          businessRoleIds: [],
        },
      });

      /*
       * =================================================
       * TEST 2
       *
       * ADMIN — accès UPDATE
       * =================================================
       *
       * UUID fictif.
       *
       * Attendu : 404
       */

      await runHttpTest({
        name:
          "Admin — accès UPDATE",

        expected:
          "404 (autorisé, cible fictive)",

        expectedStatus: 404,

        url:
          "/api/admin/users/update",

        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          userId:
            FAKE_USER_ID,

          firstName:
            "Security",

          lastName:
            "Test",

          matricule: "",

          grade: "",

          phone: "",

          accessRole:
            "user",

          businessRoleIds: [],
        },
      });

      /*
       * =================================================
       * TEST 3
       *
       * ADMIN — accès DELETE
       * =================================================
       *
       * UUID fictif.
       *
       * Attendu : 404
       */

      await runHttpTest({
        name:
          "Admin — accès DELETE",

        expected:
          "404 (autorisé, cible fictive)",

        expectedStatus: 404,

        url:
          "/api/admin/users/delete",

        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          userId:
            FAKE_USER_ID,
        },
      });

      /*
       * =================================================
       * TEST 4
       *
       * ADMIN — auto-rétrogradation
       * =================================================
       *
       * L'admin essaie de passer
       * son propre access_role à user.
       *
       * Attendu : 403
       */

      await runHttpTest({
        name:
          "Admin — retrait de ses propres droits administrateur",

        expected: "403",

        expectedStatus: 403,

        url:
          "/api/admin/users/update",

        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          userId:
            currentUserId,

          firstName,

          lastName,

          matricule: "",

          grade: "",

          phone: "",

          accessRole:
            "user",

          businessRoleIds: [],
        },
      });

      /*
       * =================================================
       * TEST 5
       *
       * ADMIN — auto-suppression
       * =================================================
       *
       * Attendu : 400
       */

      await runHttpTest({
        name:
          "Admin — suppression de son propre compte",

        expected: "400",

        expectedStatus: 400,

        url:
          "/api/admin/users/delete",

        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          userId:
            currentUserId,
        },
      });

      /*
       * =================================================
       * TEST 6
       *
       * ADMIN — accessRole falsifié
       * =================================================
       *
       * Attendu : 400
       */

      await runHttpTest({
        name:
          "Admin — accessRole falsifié",

        expected: "400",

        expectedStatus: 400,

        url:
          "/api/admin/users/update",

        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          userId:
            FAKE_USER_ID,

          firstName:
            "Security",

          lastName:
            "Test",

          matricule: "",

          grade: "",

          phone: "",

          accessRole:
            "super_admin",

          businessRoleIds: [],
        },
      });

      /*
       * =================================================
       * TEST 7
       *
       * ADMIN — IDs rôles falsifiés
       * =================================================
       *
       * Attendu : 400
       */

      await runHttpTest({
        name:
          "Admin — IDs rôles métier falsifiés",

        expected: "400",

        expectedStatus: 400,

        url:
          "/api/admin/users/update",

        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          userId:
            FAKE_USER_ID,

          firstName:
            "Security",

          lastName:
            "Test",

          matricule: "",

          grade: "",

          phone: "",

          accessRole:
            "user",

          businessRoleIds: [
            -1,
            0,
            "HACK",
          ],
        },
      });

      /*
       * =================================================
       * TEST 8
       *
       * ADMIN — modification de son propre e-mail
       * =================================================
       *
       * La route doit bloquer AVANT
       * la vérification du mot de passe.
       *
       * Attendu : 403
       */

      await runHttpTest({
        name:
          "Admin — modification de son propre e-mail depuis l'administration",

        expected: "403",

        expectedStatus: 403,

        url:
          `/api/admin/users/${currentUserId}`,

        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          email:
            "security-test@example.invalid",

          password:
            "NOT_USED",
        },
      });

      /*
       * =================================================
       * NOUVELLE SÉRIE
       *
       * ROUTE /api/admin/users/[id]
       * =================================================
       */

      /*
       * =================================================
       * TEST 9
       *
       * GET [id] sans authentification
       * =================================================
       *
       * Attendu : 401
       */

      await runHttpTest({
        name:
          "GET [id] — sans authentification",

        expected: "401",

        expectedStatus: 401,

        url:
          `/api/admin/users/${FAKE_USER_ID}`,

        method: "GET",
      });

      /*
       * =================================================
       * TEST 10
       *
       * PATCH [id] sans authentification
       * =================================================
       *
       * Attendu : 401
       */

      await runHttpTest({
        name:
          "PATCH [id] — sans authentification",

        expected: "401",

        expectedStatus: 401,

        url:
          `/api/admin/users/${FAKE_USER_ID}`,

        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: {
          email:
            "test@example.com",

          password:
            "FAKE_PASSWORD",
        },
      });

      /*
       * =================================================
       * TEST 11
       *
       * ADMIN — GET utilisateur fictif
       * =================================================
       *
       * L'admin est autorisé.
       * La cible n'existe pas.
       *
       * Attendu : 404
       */

      await runHttpTest({
        name:
          "Admin — GET e-mail utilisateur fictif",

        expected:
          "404 (autorisé, cible fictive)",

        expectedStatus: 404,

        url:
          `/api/admin/users/${FAKE_USER_ID}`,

        method: "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      });

      /*
       * =================================================
       * TEST 12
       *
       * ADMIN — PATCH sur son propre compte
       * =================================================
       *
       * Même avec un payload invalide,
       * l'interdiction de modifier son
       * propre e-mail doit passer AVANT.
       *
       * Attendu : 403
       */

      await runHttpTest({
        name:
          "Admin — PATCH e-mail sur son propre compte",

        expected: "403",

        expectedStatus: 403,

        url:
          `/api/admin/users/${currentUserId}`,

        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          email:
            "email-invalide",

          password: "",
        },
      });

      /*
       * =================================================
       * TEST 13
       *
       * ADMIN — PATCH sans e-mail
       * =================================================
       *
       * On utilise une cible fictive.
       *
       * IMPORTANT :
       * la validation de l'e-mail intervient
       * avant la recherche de la cible.
       *
       * Attendu : 400
       */

      await runHttpTest({
        name:
          "Admin — PATCH sans nouvelle adresse e-mail",

        expected: "400",

        expectedStatus: 400,

        url:
          `/api/admin/users/${FAKE_USER_ID}`,

        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          email: "",

          password:
            "NOT_USED",
        },
      });

      /*
       * =================================================
       * TEST 14
       *
       * ADMIN — format e-mail invalide
       * =================================================
       *
       * Attendu : 400
       */

      await runHttpTest({
        name:
          "Admin — PATCH format e-mail invalide",

        expected: "400",

        expectedStatus: 400,

        url:
          `/api/admin/users/${FAKE_USER_ID}`,

        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          email:
            "ceci-n-est-pas-un-email",

          password:
            "NOT_USED",
        },
      });

      /*
       * =================================================
       * TEST 15
       *
       * ADMIN — mot de passe manquant
       * =================================================
       *
       * Le format e-mail est valide,
       * mais aucun mot de passe n'est fourni.
       *
       * Attendu : 400
       */

      await runHttpTest({
        name:
          "Admin — PATCH sans mot de passe de confirmation",

        expected: "400",

        expectedStatus: 400,

        url:
          `/api/admin/users/${FAKE_USER_ID}`,

        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          email:
            "security-test@example.com",

          password: "",
        },
      });

      /*
       * =================================================
       * TEST 16
       *
       * ADMIN — mauvais mot de passe
       * =================================================
       *
       * Le mot de passe est volontairement faux.
       *
       * La route doit refuser avant toute
       * modification d'un utilisateur.
       *
       * Attendu : 401
       *
       * Aucun compte n'est modifié.
       */

      await runHttpTest({
        name:
          "Admin — PATCH avec mauvais mot de passe",

        expected: "401",

        expectedStatus: 401,

        url:
          `/api/admin/users/${FAKE_USER_ID}`,

        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${accessToken}`,
        },

        body: {
          email:
            "security-test@example.com",

          password:
            "SECURITY_TEST_WRONG_PASSWORD_123456789!",
        },
      });

      /*
       * =================================================
       * FIN
       * =================================================
       */

      setResults(
        testResults
      );
    } catch (error) {
      console.error(
        "Erreur pendant les tests Administrateur :",
        error
      );

      setGlobalError(
        "Une erreur inattendue est survenue pendant les tests."
      );
    } finally {
      setIsTesting(false);
    }
  };

  const allTestsSuccessful =
    results.length === 16 &&
    results.every(
      (result) =>
        result.success
    );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-900 sm:p-8">

          <p className="text-sm font-black uppercase tracking-widest text-red-600">
            SP Viriat
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Sécurité — Administrateur
          </h1>

          <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">
            Vérification complète des
            autorisations Administrateur,
            des protections utilisateurs
            et de la gestion des adresses
            e-mail.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-black">
              ⚠️ Compte requis
            </p>

            <p className="mt-2 text-sm leading-6">
              Lance cette série uniquement
              avec ton compte
              Administrateur.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            <p className="font-black">
              🛡️ Tests non destructifs
            </p>

            <p className="mt-2 text-sm leading-6">
              Ces tests utilisent des
              données invalides, ton propre
              compte lorsque l&apos;action
              doit être bloquée, ou un UUID
              fictif. Aucun utilisateur
              réel ne doit être créé,
              modifié ou supprimé.
            </p>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-100 p-5 dark:bg-slate-800">
            <p className="font-black">
              16 protections vérifiées
            </p>

            <div className="mt-3 space-y-2 text-sm">
              <p>
                CREATE / UPDATE / DELETE :{" "}
                <strong>
                  autorisations Admin
                </strong>
              </p>

              <p>
                Auto-rétrogradation :{" "}
                <strong>
                  interdite
                </strong>
              </p>

              <p>
                Auto-suppression :{" "}
                <strong>
                  interdite
                </strong>
              </p>

              <p>
                Valeurs falsifiées :{" "}
                <strong>
                  refusées
                </strong>
              </p>

              <p>
                GET e-mail sans session :{" "}
                <strong>
                  refusé
                </strong>
              </p>

              <p>
                PATCH e-mail sans session :{" "}
                <strong>
                  refusé
                </strong>
              </p>

              <p>
                Modification de son propre
                e-mail :{" "}
                <strong>
                  interdite
                </strong>
              </p>

              <p>
                Validation e-mail :{" "}
                <strong>
                  vérifiée
                </strong>
              </p>

              <p>
                Confirmation par mot de
                passe :{" "}
                <strong>
                  vérifiée
                </strong>
              </p>
            </div>
          </div>

          {globalError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {globalError}
            </div>
          )}

          <button
            type="button"
            disabled={
              isTesting
            }
            onClick={() =>
              void runTests()
            }
            className="mt-7 w-full rounded-2xl bg-red-600 px-6 py-4 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTesting
              ? "Tests en cours..."
              : "🛡️ Lancer les 16 tests Administrateur"}
          </button>

          {results.length > 0 && (
            <div className="mt-8 space-y-5">

              <h2 className="text-xl font-black">
                Résultats
              </h2>

              {results.map(
                (
                  result,
                  index
                ) => (
                  <div
                    key={`${result.name}-${index}`}
                    className={
                      result.success
                        ? "rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30"
                        : "rounded-2xl border border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30"
                    }
                  >
                    <div className="flex items-start gap-3">

                      <span className="text-2xl">
                        {result.success
                          ? "✅"
                          : "❌"}
                      </span>

                      <div className="min-w-0 flex-1">

                        <p className="font-black">
                          {
                            result.name
                          }
                        </p>

                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">

                          <div>
                            <span className="font-bold">
                              Attendu :
                            </span>{" "}
                            {
                              result.expected
                            }
                          </div>

                          <div>
                            <span className="font-bold">
                              Reçu :
                            </span>{" "}
                            {
                              result.received
                            }
                          </div>

                        </div>

                        <div className="mt-4">

                          <p className="text-xs font-black uppercase tracking-wide opacity-70">
                            Réponse
                          </p>

                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-black/5 p-3 text-xs dark:bg-black/20">
                            {JSON.stringify(
                              result.response,
                              null,
                              2
                            )}
                          </pre>

                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}

              {allTestsSuccessful && (
                <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-5 text-center dark:bg-emerald-950/30">

                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                    🛡️ 16 tests réussis
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-700 dark:text-emerald-300">
                    Les autorisations
                    Administrateur, les
                    protections du compte,
                    la gestion des
                    utilisateurs et les
                    contrôles de
                    modification des
                    adresses e-mail
                    fonctionnent comme
                    prévu.
                  </p>

                </div>
              )}
            </div>
          )}

          <Link
            href="/dashboard"
            className="mt-8 inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 px-5 py-3 font-bold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            ← Retour au tableau de bord
          </Link>

        </div>
      </div>
    </main>
  );
}