// Vercel caps request bodies at 4.5 MB and phone screenshots often exceed it.
// Narrow the screenshot to 1600 px wide (never by its height: long page
// captures would turn thin and the product photo blurry), save as JPEG, and
// lower the quality until it fits. The server checks the result again.
const MAX_WIDTH = 1600;
export const MAX_BYTES = 4 * 1024 * 1024;
const QUALITIES = [0.9, 0.8, 0.7, 0.6, 0.5];
const KEEP_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function shrinkScreenshot(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // Not decodable here; let the server say what's wrong.
  }
  if (bitmap.width <= MAX_WIDTH && file.size <= MAX_BYTES && KEEP_TYPES.has(file.type)) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob: Blob | null = null;
  for (const quality of QUALITIES) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  return blob ?? file;
}
