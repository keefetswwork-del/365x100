import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

const MAX_BYTES = 1_000_000;
const MAX_EDGE = 2_500;

async function renderWebp(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cover image could not be prepared.");
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("Cover image could not be prepared.");
  return blob;
}

export async function preparePublicationCover(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    for (const quality of [0.88, 0.78, 0.68, 0.58]) {
      const blob = await renderWebp(bitmap, width, height, quality);
      if (blob.size <= MAX_BYTES) return blob;
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }
  } finally {
    bitmap.close();
  }
  throw new Error("Choose a smaller image.");
}

export async function uploadPublicationCover(client: SupabaseClient<Database>, publicationId: string, cover: Blob): Promise<void> {
  const form = new FormData();
  form.set("publicationId", publicationId);
  form.set("operationId", crypto.randomUUID());
  form.set("file", cover, "chapter-cover.webp");
  const { error } = await client.functions.invoke("publication-cover-media", { body: form });
  if (error) throw new Error("Cover could not be uploaded.");
}

export async function removePublicationCoverUpload(client: SupabaseClient<Database>, publicationId: string): Promise<void> {
  const { error } = await client.functions.invoke("publication-cover-media", { body: { publicationId }, method: "DELETE" });
  if (error) throw new Error("Cover could not be removed.");
}
