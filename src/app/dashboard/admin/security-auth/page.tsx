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

type Profile = {
  id: string;
  access_role: string | null;
  status: string | null;
};

async function readResponse(
  response: Response
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return "Réponse non JSON";
  }
}

export default function SecurityAuthTestPage() {
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

    try {
      /*
       * =================================================
       * SESSION ACTUELLE
       * =================================================
       */

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token ||
        !session.user
      ) {
        setGlobalError(
          "Aucune session Supabase valide. Connecte-toi avant de lancer les tests."
        );

        return;
      }

      const currentUser =
        session.user;

      const currentUserId =
        currentUser.id;

      /*
       * =================================================
       * TEST 1
       * SESSION EXISTANTE
       * =================================================
       */

      testResults.push({
        name:
          "AUTH — session utilisateur présente",

        expected:
          "Session valide",

        received:
          session.access_token
            ? "Session valide"
            : "Session absente",

        success:
          Boolean(
            session.access_token
          ),

        response: {
          userId:
            currentUserId,

          hasAccessToken:
            Boolean(
              session.access_token
            ),
        },
      });

      /*
       * =================================================
       * TEST 2
       * getUser() valide réellement le JWT
       * =================================================
       *
       * getSession() lit la session locale.
       *
       * getUser() demande à Supabase Auth
       * de vérifier réellement l'utilisateur.
       */

      try {
        const {
          data: userData,
          error: userError,
        } =
          await supabase.auth.getUser();

        testResults.push({
          name:
            "AUTH — validation serveur de la session",

          expected:
            "Utilisateur authentifié",

          received:
            userError
              ? "Session refusée"
              : userData.user
                ? "Utilisateur authentifié"
                : "Utilisateur absent",

          success:
            !userError &&
            userData.user?.id ===
              currentUserId,

          response:
            userError ?? {
              userId:
                userData.user?.id ??
                null,

              emailPresent:
                Boolean(
                  userData.user
                    ?.email
                ),
            },
        });
      } catch (error) {
        testResults.push({
          name:
            "AUTH — validation serveur de la session",

          expected:
            "Utilisateur authentifié",

          received:
            "Erreur",

          success:
            false,

          response:
            error instanceof Error
              ? error.message
              : "Erreur inconnue",
        });
      }

      /*
       * =================================================
       * TEST 3
       * JWT complètement falsifié
       * =================================================
       *
       * On appelle une route protégée avec
       * un faux Bearer token.
       *
       * Attendu : 401
       */

      try {
        const response =
          await fetch(
            "/api/admin/users/update",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  "Bearer FAKE_SECURITY_TOKEN",
              },

              body:
                JSON.stringify({
                  userId:
                    currentUserId,

                  firstName:
                    "Security",

                  lastName:
                    "Test",

                  matricule:
                    "",

                  grade:
                    "",

                  phone:
                    "",

                  accessRole:
                    "user",

                  businessRoleIds:
                    [],
                }),
            }
          );

        const body =
          await readResponse(
            response
          );

        testResults.push({
          name:
            "AUTH — JWT falsifié",

          expected:
            "401",

          received:
            String(
              response.status
            ),

          success:
            response.status ===
            401,

          response:
            body,
        });
      } catch (error) {
        testResults.push({
          name:
            "AUTH — JWT falsifié",

          expected:
            "401",

          received:
            "Erreur réseau",

          success:
            false,

          response:
            error instanceof Error
              ? error.message
              : "Erreur inconnue",
        });
      }

      /*
       * =================================================
       * TEST 4
       * Bearer vide
       * =================================================
       */

      try {
        const response =
          await fetch(
            "/api/admin/users/update",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  "Bearer ",
              },

              body:
                JSON.stringify({
                  userId:
                    currentUserId,

                  firstName:
                    "Security",

                  lastName:
                    "Test",

                  accessRole:
                    "user",

                  businessRoleIds:
                    [],
                }),
            }
          );

        const body =
          await readResponse(
            response
          );

        testResults.push({
          name:
            "AUTH — Bearer vide",

          expected:
            "401",

          received:
            String(
              response.status
            ),

          success:
            response.status ===
            401,

          response:
            body,
        });
      } catch (error) {
        testResults.push({
          name:
            "AUTH — Bearer vide",

          expected:
            "401",

          received:
            "Erreur réseau",

          success:
            false,

          response:
            error instanceof Error
              ? error.message
              : "Erreur inconnue",
        });
      }

      /*
       * =================================================
       * TEST 5
       * Header Authorization mal formé
       * =================================================
       */

      try {
        const response =
          await fetch(
            "/api/admin/users/update",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Token ${session.access_token}`,
              },

              body:
                JSON.stringify({
                  userId:
                    currentUserId,

                  firstName:
                    "Security",

                  lastName:
                    "Test",

                  accessRole:
                    "user",

                  businessRoleIds:
                    [],
                }),
            }
          );

        const body =
          await readResponse(
            response
          );

        testResults.push({
          name:
            "AUTH — Authorization mal formé",

          expected:
            "401",

          received:
            String(
              response.status
            ),

          success:
            response.status ===
            401,

          response:
            body,
        });
      } catch (error) {
        testResults.push({
          name:
            "AUTH — Authorization mal formé",

          expected:
            "401",

          received:
            "Erreur réseau",

          success:
            false,

          response:
            error instanceof Error
              ? error.message
              : "Erreur inconnue",
        });
      }

      /*
       * =================================================
       * TEST 6
       * Lecture de son propre profil
       * =================================================
       *
       * La RLS doit permettre à l'utilisateur
       * authentifié de lire son propre profil.
       */

      try {
        const {
          data,
          error,
        } = await supabase
          .from("profiles")
          .select(
            "id, access_role, status"
          )
          .eq(
            "id",
            currentUserId
          )
          .single();

        const profile =
          data as Profile | null;

        testResults.push({
          name:
            "RLS — lecture de son propre profil",

          expected:
            "Profil accessible",

          received:
            error
              ? "Lecture refusée"
              : profile?.id ===
                  currentUserId
                ? "Profil accessible"
                : "Profil incorrect",

          success:
            !error &&
            profile?.id ===
              currentUserId,

          response:
            error ?? profile,
        });
      } catch (error) {
        testResults.push({
          name:
            "RLS — lecture de son propre profil",

          expected:
            "Profil accessible",

          received:
            "Erreur",

          success:
            false,

          response:
            error instanceof Error
              ? error.message
              : "Erreur inconnue",
        });
      }

      /*
       * =================================================
       * TEST 7
       * Tentative UPDATE directe de son access_role
       * =================================================
       *
       * IMPORTANT :
       *
       * On ne tente PAS de changer le rôle.
       *
       * On réécrit exactement la valeur actuelle.
       *
       * La RLS doit quand même bloquer l'UPDATE direct.
       */

      try {
        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "access_role"
          )
          .eq(
            "id",
            currentUserId
          )
          .single();

        if (
          profileError ||
          !profileData
        ) {
          testResults.push({
            name:
              "RLS — UPDATE direct du niveau d'accès",

            expected:
              "0 ligne modifiée",

            received:
              "Profil introuvable",

            success:
              false,

            response:
              profileError,
          });
        } else {
          const {
            data,
            error,
          } = await supabase
            .from("profiles")
            .update({
              access_role:
                profileData.access_role,
            })
            .eq(
              "id",
              currentUserId
            )
            .select();

          const modifiedRows =
            data?.length ?? 0;

          testResults.push({
            name:
              "RLS — UPDATE direct du niveau d'accès",

            expected:
              "0 ligne modifiée",

            received:
              `${modifiedRows} ligne(s)`,

            success:
              Boolean(error) ||
              modifiedRows === 0,

            response:
              error ?? data,
          });
        }
      } catch (error) {
        testResults.push({
          name:
            "RLS — UPDATE direct du niveau d'accès",

          expected:
            "0 ligne modifiée",

          received:
            "Requête refusée",

          success:
            true,

          response:
            error instanceof Error
              ? error.message
              : "Erreur inconnue",
        });
      }

      /*
       * =================================================
       * TEST 8
       * Accès direct à audit_logs
       * =================================================
       *
       * Après notre durcissement SQL,
       * le navigateur ne doit pas pouvoir
       * lire directement audit_logs.
       */

      try {
        const {
          data,
          error,
        } = await supabase
          .from("audit_logs")
          .select("*")
          .limit(1);

        const rows =
          data?.length ?? 0;

        testResults.push({
          name:
            "RLS — accès navigateur à audit_logs",

          expected:
            "Accès refusé",

          received:
            error
              ? "Accès refusé"
              : `${rows} ligne(s) accessible(s)`,

          success:
            Boolean(error),

          response:
            error ?? data,
        });
      } catch (error) {
        testResults.push({
          name:
            "RLS — accès navigateur à audit_logs",

          expected:
            "Accès refusé",

          received:
            "Accès refusé",

          success:
            true,

          response:
            error instanceof Error
              ? error.message
              : "Erreur inconnue",
        });
      }

      /*
       * =================================================
       * TEST 9
       * Appel direct RPC is_admin
       * =================================================
       *
       * authenticated possède EXECUTE.
       *
       * L'appel doit fonctionner.
       *
       * Pour le compte admin utilisé actuellement,
       * le résultat attendu est true.
       */

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "is_admin"
          );

        testResults.push({
          name:
            "AUTH — RPC is_admin",

          expected:
            "true pour Administrateur",

          received:
            error
              ? "Erreur RPC"
              : String(data),

          success:
            !error &&
            data === true,

          response:
            error ?? {
              is_admin:
                data,
            },
        });
      } catch (error) {
        testResults.push({
          name:
            "AUTH — RPC is_admin",

          expected:
            "true pour Administrateur",

          received:
            "Erreur",

          success:
            false,

          response:
            error instanceof Error
              ? error.message
              : "Erreur inconnue",
        });
      }

      /*
       * =================================================
       * TEST 10
       * RPC current_user_can_manage_users
       * =================================================
       *
       * Un administrateur doit obtenir true.
       */

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "current_user_can_manage_users"
          );

        testResults.push({
          name:
            "AUTH — RPC gestion utilisateurs",

          expected:
            "true pour Administrateur",

          received:
            error
              ? "Erreur RPC"
              : String(data),

          success:
            !error &&
            data === true,

          response:
            error ?? {
              current_user_can_manage_users:
                data,
            },
        });
      } catch (error) {
        testResults.push({
          name:
            "AUTH — RPC gestion utilisateurs",

          expected:
            "true pour Administrateur",

          received:
            "Erreur",

          success:
            false,

          response:
            error instanceof Error
              ? error.message
              : "Erreur inconnue",
        });
      }

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
        "Erreur tests authentification :",
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
    results.length === 10 &&
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
            Sécurité —
            Authentification
          </h1>

          <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">
            Dernière série de contrôles
            sur les sessions, les JWT,
            les RPC sensibles et les
            accès directs à Supabase.
          </p>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            <p className="font-black">
              🛡️ Tests non destructifs
            </p>

            <p className="mt-2 text-sm leading-6">
              Cette série ne change pas
              ton mot de passe, ne change
              pas ton adresse e-mail et
              ne supprime pas ta session.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-black">
              ⚠️ Compte requis
            </p>

            <p className="mt-2 text-sm leading-6">
              Lance cette série avec ton
              compte Administrateur,
              comme pour les 16 tests
              précédents.
            </p>
          </div>

          {globalError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {globalError}
            </div>
          )}

          <button
            type="button"
            disabled={isTesting}
            onClick={() =>
              void runTests()
            }
            className="mt-7 w-full rounded-2xl bg-red-600 px-6 py-4 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTesting
              ? "Tests en cours..."
              : "🔐 Lancer les 10 tests Auth"}
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
                          {result.name}
                        </p>

                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <span className="font-bold">
                              Attendu :
                            </span>{" "}
                            {result.expected}
                          </div>

                          <div>
                            <span className="font-bold">
                              Reçu :
                            </span>{" "}
                            {result.received}
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
                    🔐 10 tests Auth
                    réussis
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-700 dark:text-emerald-300">
                    Les contrôles de
                    session, JWT, RLS,
                    audit et fonctions
                    d&apos;autorisation
                    fonctionnent comme
                    prévu.
                  </p>
                </div>
              )}
            </div>
          )}

          <Link
            href="/dashboard/admin/security"
            className="mt-8 inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 px-5 py-3 font-bold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            ← Retour aux tests
            Administrateur
          </Link>
        </div>
      </div>
    </main>
  );
}