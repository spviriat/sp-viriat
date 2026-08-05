"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/profile";

import EditProfileDialog from "@/components/profile/EditProfileDialog";
import type { EditableProfileFields } from "@/components/profile/EditProfileDialog";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileInfo from "@/components/profile/ProfileInfo";

export default function ProfilePage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");

  const [message, setMessage] = useState<string | null>(null);

  /*
   * =====================================================
   * MOT DE PASSE
   * =====================================================
   */

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [isChangingPassword, setIsChangingPassword] =
    useState(false);

  const [passwordError, setPasswordError] =
    useState<string | null>(null);

  const [passwordSuccess, setPasswordSuccess] =
    useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace("/");
        return;
      }

      setEmail(session.user.email ?? "");

      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          first_name,
          last_name,
          grade,
          fonction,
          telephone,
          avatar_url,
          role,
          access_role,
          theme,
          matricule,
          status
        `)
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error(
          "Erreur lors de la récupération du profil :",
          error
        );
      } else {
        setProfile(data);
      }

      setIsLoading(false);
    };

    void loadProfile();
  }, [router]);

  /*
   * =====================================================
   * MODIFICATION DU PROFIL
   * =====================================================
   */

  const handleSaveProfile = async (
    values: EditableProfileFields
  ) => {
    if (!profile || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    let avatarUrl = profile.avatar_url;

    if (values.avatarFile) {
      const filePath = `${profile.id}/avatar.webp`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, values.avatarFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: values.avatarFile.type,
        });

      if (uploadError) {
        console.error(
          "Erreur lors de l’envoi de la photo :",
          uploadError
        );

        setMessage("Impossible d’envoyer la photo.");
        setIsSaving(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      avatarUrl = `${publicUrl}?v=${Date.now()}`;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        first_name,
        last_name,
        grade,
        fonction,
        telephone,
        avatar_url,
        role,
        access_role,
        theme,
        matricule,
        status
      `)
      .eq("id", profile.id)
      .single();

    if (error) {
      console.error(
        "Erreur lors de la mise à jour du profil :",
        error
      );

      setMessage(
        "Impossible d’enregistrer les modifications."
      );

      setIsSaving(false);
      return;
    }

    setProfile(data);
    setIsEditOpen(false);
    setMessage("Profil mis à jour avec succès.");
    setIsSaving(false);
  };

  /*
   * =====================================================
   * SUPPRESSION DE L'AVATAR
   * =====================================================
   */

  const handleDeleteAvatar = async () => {
    if (!profile || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const filePath = `${profile.id}/avatar.webp`;

    const { error: deleteError } = await supabase.storage
      .from("avatars")
      .remove([filePath]);

    if (deleteError) {
      console.error(
        "Erreur lors de la suppression de la photo :",
        deleteError
      );

      setMessage(
        "Impossible de supprimer la photo."
      );

      setIsSaving(false);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("profiles")
      .select(`
        id,
        first_name,
        last_name,
        grade,
        fonction,
        telephone,
        avatar_url,
        role,
        access_role,
        theme,
        matricule,
        status
      `)
      .eq("id", profile.id)
      .single();

    if (updateError) {
      console.error(
        "Erreur lors de la mise à jour du profil :",
        updateError
      );

      setMessage(
        "La photo a été supprimée, mais le profil n’a pas pu être mis à jour."
      );

      setIsSaving(false);
      return;
    }

    setProfile(data);
    setIsEditOpen(false);
    setMessage("Photo de profil supprimée.");
    setIsSaving(false);
  };

  /*
   * =====================================================
   * MODIFICATION DU MOT DE PASSE
   * =====================================================
   */

  const handleChangePassword = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (isChangingPassword) {
      return;
    }

    setPasswordError(null);
    setPasswordSuccess(null);

    if (
      !currentPassword ||
      !newPassword ||
      !confirmNewPassword
    ) {
      setPasswordError(
        "Tous les champs sont obligatoires."
      );

      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        "Le nouveau mot de passe doit contenir au moins 8 caractères."
      );

      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError(
        "Les deux nouveaux mots de passe ne correspondent pas."
      );

      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        "Le nouveau mot de passe doit être différent de l’ancien."
      );

      return;
    }

    if (!email) {
      setPasswordError(
        "Impossible de déterminer votre adresse e-mail."
      );

      return;
    }

    setIsChangingPassword(true);

    try {
      /*
       * Vérification de l'ancien mot de passe.
       */

      const {
        error: verificationError,
      } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (verificationError) {
        setPasswordError(
          "Votre mot de passe actuel est incorrect."
        );

        return;
      }

      /*
       * Enregistrement du nouveau mot de passe.
       */

      const {
        error: passwordUpdateError,
      } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (passwordUpdateError) {
        console.error(
          "Erreur lors du changement de mot de passe :",
          passwordUpdateError
        );

        setPasswordError(
          passwordUpdateError.message ||
            "Impossible de modifier votre mot de passe."
        );

        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      setPasswordSuccess(
        "Votre mot de passe a été modifié avec succès."
      );
    } catch (error) {
      console.error(
        "Erreur inattendue lors du changement de mot de passe :",
        error
      );

      setPasswordError(
        "Une erreur inattendue est survenue. Veuillez réessayer."
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-red-600" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-center text-slate-950 dark:bg-slate-950 dark:text-white">
        Impossible de charger le profil.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-10 text-slate-950 dark:bg-slate-950 dark:text-white">
      <ProfileHeader />

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {message && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
            {message}
          </div>
        )}

        <ProfileCard
          profile={profile}
          onEdit={() => {
            setMessage(null);
            setIsEditOpen(true);
          }}
        />

        <ProfileInfo
          profile={profile}
          email={email}
        />

        {/* =================================================
            SÉCURITÉ
        ================================================= */}

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-xl dark:bg-red-950/40">
                🔐
              </div>

              <div>
                <h2 className="text-xl font-black">
                  Sécurité
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Gérez votre mot de passe de connexion.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleChangePassword}
            className="p-5 sm:p-6"
          >
            {passwordError && (
              <div
                role="alert"
                className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                ✅ {passwordSuccess}
              </div>
            )}

            <div className="grid gap-5">
              <label className="block">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Mot de passe actuel
                </span>

                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(
                      event.target.value
                    );

                    setPasswordError(null);
                    setPasswordSuccess(null);
                  }}
                  disabled={isChangingPassword}
                  autoComplete="current-password"
                  placeholder="Votre mot de passe actuel"
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Nouveau mot de passe
                  </span>

                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(
                        event.target.value
                      );

                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    disabled={isChangingPassword}
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Au moins 8 caractères"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Confirmer
                  </span>

                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => {
                      setConfirmNewPassword(
                        event.target.value
                      );

                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    disabled={isChangingPassword}
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Confirmez le nouveau mot de passe"
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-red-950"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              Le nouveau mot de passe doit contenir au
              minimum <strong>8 caractères</strong>.
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full rounded-2xl bg-red-600 px-6 py-3 font-bold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isChangingPassword
                  ? "Modification..."
                  : "Modifier mon mot de passe"}
              </button>
            </div>
          </form>
        </section>
      </div>

      <EditProfileDialog
        open={isEditOpen}
        profile={profile}
        isSaving={isSaving}
        onOpenChange={setIsEditOpen}
        onSave={handleSaveProfile}
        onDeleteAvatar={handleDeleteAvatar}
      />
    </main>
  );
}