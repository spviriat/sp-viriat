"use client";

import { useEffect, useState } from "react";
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
      .update({
        telephone: values.telephone,
        matricule: values.matricule,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .select(`
        id,
        first_name,
        last_name,
        grade,
        fonction,
        telephone,
        avatar_url,
        role,
        theme,
        matricule,
        status
      `)
      .single();

    if (error) {
      console.error(
        "Erreur lors de la mise à jour du profil :",
        error
      );

      setMessage("Impossible d’enregistrer les modifications.");
      setIsSaving(false);
      return;
    }

    setProfile(data);
    setIsEditOpen(false);
    setMessage("Profil mis à jour avec succès.");
    setIsSaving(false);
  };

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

      setMessage("Impossible de supprimer la photo.");
      setIsSaving(false);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .select(`
        id,
        first_name,
        last_name,
        grade,
        fonction,
        telephone,
        avatar_url,
        role,
        theme,
        matricule,
        status
      `)
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

        <ProfileInfo profile={profile} email={email} />
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