"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Camera,
  Check,
  Loader2,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { createCroppedAvatar } from "@/lib/cropImage";
import type { Profile } from "@/types/profile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EditableProfileFields = {
  telephone: string | null;
  matricule: string | null;
  avatarFile: File | null;
};

type EditProfileDialogProps = {
  open: boolean;
  profile: Profile;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: EditableProfileFields) => Promise<void>;
  onDeleteAvatar: () => Promise<void>;
};

function getInitials(firstName: string, lastName: string) {
  return (
    `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`
      .toUpperCase()
      .trim() || "SP"
  );
}

export default function EditProfileDialog({
  open,
  profile,
  isSaving,
  onOpenChange,
  onSave,
  onDeleteAvatar,
}: EditProfileDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [telephone, setTelephone] = useState(profile.telephone ?? "");
  const [matricule, setMatricule] = useState(profile.matricule ?? "");

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    profile.avatar_url
  );

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isCreatingCrop, setIsCreatingCrop] = useState(false);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<Area | null>(null);

  const [fileError, setFileError] = useState<string | null>(null);

  const fullName =
    `${profile.first_name} ${profile.last_name}`.trim() ||
    "Utilisateur";

  const initials = getInitials(
    profile.first_name ?? "",
    profile.last_name ?? ""
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setTelephone(profile.telephone ?? "");
    setMatricule(profile.matricule ?? "");
    setAvatarFile(null);
    setPreviewUrl(profile.avatar_url);
    setSourceUrl(null);
    setIsCropping(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setFileError(null);
  }, [
    open,
    profile.telephone,
    profile.matricule,
    profile.avatar_url,
  ]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }

      if (sourceUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [previewUrl, sourceUrl]);

  const handleCropComplete = useCallback(
    (_croppedArea: Area, croppedPixels: Area) => {
      setCroppedAreaPixels(croppedPixels);
    },
    []
  );

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setFileError(
        "Format non accepté. Utilise une image JPG, PNG ou WebP."
      );
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setFileError("L’image ne doit pas dépasser 5 Mo.");
      return;
    }

    if (sourceUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceUrl);
    }

    const objectUrl = URL.createObjectURL(file);

    setSourceUrl(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setFileError(null);
    setIsCropping(true);
  };

  const handleConfirmCrop = async () => {
    if (!sourceUrl || !croppedAreaPixels) {
      setFileError("Impossible de recadrer cette image.");
      return;
    }

    setIsCreatingCrop(true);
    setFileError(null);

    try {
      const croppedFile = await createCroppedAvatar(
        sourceUrl,
        croppedAreaPixels
      );

      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }

      setAvatarFile(croppedFile);
      setPreviewUrl(URL.createObjectURL(croppedFile));
      setIsCropping(false);
    } catch (error) {
      console.error("Erreur lors du recadrage :", error);
      setFileError("Impossible de recadrer l’image.");
    } finally {
      setIsCreatingCrop(false);
    }
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);

    if (sourceUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceUrl);
    }

    setSourceUrl(null);
  };

  const handleDeleteAvatar = async () => {
    const confirmed = window.confirm(
      "Voulez-vous vraiment supprimer votre photo de profil ?"
    );

    if (!confirmed) {
      return;
    }

    await onDeleteAvatar();
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    await onSave({
      telephone: telephone.trim() || null,
      matricule: matricule.trim() || null,
      avatarFile,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Modifier mon profil</DialogTitle>

              <DialogDescription>
                Le nom, le grade et le centre sont gérés par
                l&apos;administration.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-3xl font-extrabold text-white shadow-lg">
                    {previewUrl ? (
                      <Image
                        src={previewUrl}
                        alt={`Photo de profil de ${fullName}`}
                        width={112}
                        height={112}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-label="Choisir une photo"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                    className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-red-600 text-white shadow-md transition hover:bg-red-700 disabled:opacity-50 dark:border-slate-950"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={isSaving}
                  className="hidden"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                >
                  <Upload className="h-4 w-4" />
                  Choisir une photo
                </Button>

                {profile.avatar_url && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteAvatar}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Supprimer la photo
                      </>
                    )}
                  </Button>
                )}

                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  JPG, PNG ou WebP. Taille maximale : 5 Mo.
                </p>

                {fileError && (
                  <p className="text-center text-sm font-medium text-red-600">
                    {fileError}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="telephone">Téléphone</Label>

                <Input
                  id="telephone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="06 12 34 56 78"
                  value={telephone}
                  onChange={(event) =>
                    setTelephone(event.target.value)
                  }
                  disabled={isSaving}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="matricule">Matricule</Label>

                <Input
                  id="matricule"
                  type="text"
                  placeholder="SP001"
                  value={matricule}
                  onChange={(event) =>
                    setMatricule(event.target.value)
                  }
                  disabled={isSaving}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Annuler
              </Button>

              <Button
                type="submit"
                disabled={isSaving || Boolean(fileError)}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Enregistrer
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCropping}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isCreatingCrop) {
            handleCancelCrop();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recadrer la photo</DialogTitle>

            <DialogDescription>
              Déplace la photo et utilise le zoom pour centrer ton
              visage.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="relative h-80 overflow-hidden rounded-2xl bg-black">
              {sourceUrl && (
                <Cropper
                  image={sourceUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={handleCropComplete}
                />
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="avatar-zoom">Zoom</Label>

              <input
                id="avatar-zoom"
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(event) =>
                  setZoom(Number(event.target.value))
                }
                disabled={isCreatingCrop}
                className="w-full accent-red-600"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelCrop}
              disabled={isCreatingCrop}
            >
              <X className="h-4 w-4" />
              Annuler
            </Button>

            <Button
              type="button"
              onClick={handleConfirmCrop}
              disabled={isCreatingCrop || !croppedAreaPixels}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isCreatingCrop ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recadrage...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Valider le cadrage
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}