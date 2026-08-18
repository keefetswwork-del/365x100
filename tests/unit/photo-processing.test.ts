import { expect, test } from "@playwright/test";

import {
  calculatePhotoDimensions,
  detectPhotoType,
  durationBucket,
  MAX_ORIGINAL_BYTES,
  mediaSizeBucket,
  PhotoProcessingError,
  validateOriginalPhoto,
} from "../../lib/photo-processing";
import {
  MAX_PROCESSED_BYTES,
  parseWebPDimensions,
  validateProcessedPhoto,
} from "../../supabase/functions/journal-media/core";

function webp(width: number, height: number, size = 30): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([..."RIFF"].map((character) => character.charCodeAt(0)), 0);
  bytes.set([..."WEBP"].map((character) => character.charCodeAt(0)), 8);
  bytes.set([..."VP8X"].map((character) => character.charCodeAt(0)), 12);
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes[24] = encodedWidth & 0xff;
  bytes[25] = (encodedWidth >> 8) & 0xff;
  bytes[26] = (encodedWidth >> 16) & 0xff;
  bytes[27] = encodedHeight & 0xff;
  bytes[28] = (encodedHeight >> 8) & 0xff;
  bytes[29] = (encodedHeight >> 16) & 0xff;
  return bytes;
}

test("detects supported formats from magic bytes rather than filenames", () => {
  expect(detectPhotoType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
  expect(detectPhotoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  expect(detectPhotoType(webp(1200, 800))).toBe("image/webp");
  expect(detectPhotoType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
});

test("accepts exactly 10 MB and rejects one byte more", () => {
  const header = new Uint8Array([0xff, 0xd8, 0xff]);
  expect(validateOriginalPhoto({ size: MAX_ORIGINAL_BYTES }, header)).toBe("image/jpeg");
  expect(() => validateOriginalPhoto({ size: MAX_ORIGINAL_BYTES + 1 }, header)).toThrow(PhotoProcessingError);
});

test("preserves aspect ratio and never enlarges a photo", () => {
  expect(calculatePhotoDimensions(5000, 3000)).toEqual({ width: 2500, height: 1500 });
  expect(calculatePhotoDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  expect(calculatePhotoDimensions(1200, 2400, 960)).toEqual({ width: 480, height: 960 });
});

test("validates exact processed-byte and dimension boundaries", () => {
  const exact = webp(2500, 2500, MAX_PROCESSED_BYTES);
  expect(parseWebPDimensions(exact)).toEqual({ width: 2500, height: 2500 });
  expect(validateProcessedPhoto(exact)).toEqual({ width: 2500, height: 2500 });
  expect(() => validateProcessedPhoto(webp(2500, 2500, MAX_PROCESSED_BYTES + 1))).toThrow("invalid-size");
  expect(() => validateProcessedPhoto(webp(2501, 2500))).toThrow("invalid-webp");
});

test("records only coarse size and duration buckets", () => {
  expect(mediaSizeBucket(249_999)).toBe("under-250kb");
  expect(mediaSizeBucket(250_000)).toBe("250-500kb");
  expect(mediaSizeBucket(500_000)).toBe("500kb-1mb");
  expect(durationBucket(999)).toBe("under-1s");
  expect(durationBucket(5_000)).toBe("over-5s");
});
