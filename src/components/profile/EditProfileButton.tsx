"use client";

import { Pencil } from "lucide-react";

type EditProfileButtonProps = {
  onClick?: () => void;
};

export default function EditProfileButton({
  onClick,
}: EditProfileButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3.5 font-bold text-white transition hover:bg-red-700 active:scale-[0.98]"
    >
      <Pencil className="h-5 w-5" />
      Modifier mon profil
    </button>
  );
}