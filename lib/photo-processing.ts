export const MAX_ORIGINAL_BYTES = 10_000_000;
export const MAX_PROCESSED_BYTES = 1_000_000;
export const MAX_EDGE = 2_500;
export const MAX_PIXELS = 60_000_000;
export const MIN_EDGE = 960;

export type AcceptedPhotoType = "image/jpeg" | "image/png" | "image/webp";

export class PhotoProcessingError extends Error {
  constructor(
    message: string,
    readonly category: "decode" | "format" | "oversize" | "processing",
  ) {
    super(message);
    this.name = "PhotoProcessingError";
  }
}

export interface ProcessedPhoto {
  blob: Blob;
  height: number;
  originalType: AcceptedPhotoType;
  width: number;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

export function detectPhotoType(bytes: Uint8Array): AcceptedPhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && ascii(bytes, 1, 3) === "PNG"
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function validateOriginalPhoto(file: Pick<File, "size">, header: Uint8Array): AcceptedPhotoType {
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new PhotoProcessingError("This file is larger than 10 MB.", "oversize");
  }
  const type = detectPhotoType(header);
  if (!type) {
    throw new PhotoProcessingError("Please choose a JPEG, PNG or WebP image.", "format");
  }
  return type;
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== "image/webp") {
        reject(new PhotoProcessingError("This browser could not prepare the photo as WebP.", "processing"));
        return;
      }
      resolve(blob);
    }, "image/webp", quality);
  });
}

interface DecodedPhoto {
  close: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
}

async function decodePhoto(file: File): Promise<DecodedPhoto> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      close: () => bitmap.close(),
      height: bitmap.height,
      source: bitmap,
      width: bitmap.width,
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = "async";
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("decode-failed"));
      element.src = url;
    });
    return {
      close: () => URL.revokeObjectURL(url),
      height: image.naturalHeight,
      source: image,
      width: image.naturalWidth,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export function calculatePhotoDimensions(width: number, height: number, longEdge = MAX_EDGE): { height: number; width: number } {
  const originalLongEdge = Math.max(width, height);
  const scale = Math.min(1, longEdge / originalLongEdge);
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const originalType = validateOriginalPhoto(file, header);

  let decoded: DecodedPhoto;
  try {
    decoded = await decodePhoto(file);
  } catch {
    throw new PhotoProcessingError("We couldn’t read this image. Please choose another photo.", "decode");
  }

  try {
    if (decoded.width < 1 || decoded.height < 1 || decoded.width * decoded.height > MAX_PIXELS) {
      throw new PhotoProcessingError("This image is too large to prepare safely.", "decode");
    }

    const originalLongEdge = Math.max(decoded.width, decoded.height);
    let longEdge = Math.min(originalLongEdge, MAX_EDGE);
    const qualities = [0.88, 0.82, 0.76, 0.7, 0.64, 0.58];

    while (true) {
      const { width, height } = calculatePhotoDimensions(decoded.width, decoded.height, longEdge);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new PhotoProcessingError("We couldn’t prepare this image.", "processing");
      context.drawImage(decoded.source, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await canvasBlob(canvas, quality);
        if (blob.size <= MAX_PROCESSED_BYTES) {
          return { blob, height, originalType, width };
        }
      }

      if (longEdge <= MIN_EDGE || originalLongEdge <= MIN_EDGE) break;
      longEdge = Math.max(MIN_EDGE, Math.floor(longEdge * 0.85));
    }
  } finally {
    decoded.close();
  }

  throw new PhotoProcessingError("We couldn’t compress this image. Please choose another photo.", "processing");
}

export function mediaSizeBucket(bytes: number): "under-250kb" | "250-500kb" | "500kb-1mb" {
  if (bytes < 250_000) return "under-250kb";
  if (bytes < 500_000) return "250-500kb";
  return "500kb-1mb";
}

export function durationBucket(milliseconds: number): "under-1s" | "1-3s" | "3-5s" | "over-5s" {
  if (milliseconds < 1_000) return "under-1s";
  if (milliseconds < 3_000) return "1-3s";
  if (milliseconds < 5_000) return "3-5s";
  return "over-5s";
}
