import type { Area } from "react-easy-crop";

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Impossible de charger l’image."));

    image.src = source;
  });
}

export async function createCroppedAvatar(
  imageSource: string,
  crop: Area
): Promise<File> {
  const image = await loadImage(imageSource);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Le recadrage de l’image est impossible.");
  }

  const outputSize = 512;

  canvas.width = outputSize;
  canvas.height = outputSize;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Impossible de générer l’image."));
          return;
        }

        resolve(result);
      },
      "image/webp",
      0.9
    );
  });

  return new File([blob], "avatar.webp", {
    type: "image/webp",
  });
}