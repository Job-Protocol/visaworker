// Browser helpers for capturing pasted/dropped screenshots and preparing them
// for the Anthropic vision API. Downscales oversized images so they fit under
// Anthropic's 5MB base64 cap (~3.75MB raw).
export type ImageAttachment = {
  id: string;
  media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  data: string; // base64, no data-URL prefix
  dataUrl: string; // for previewing in <img src="...">
  sizeBytes: number;
};

const SUPPORTED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const MAX_DIMENSION = 1800;
const MAX_BASE64_BYTES = 3_800_000; // ~5MB base64

export function isSupportedImageFile(file: File | Blob | null | undefined): boolean {
  if (!file) return false;
  return SUPPORTED_IMAGE_MIMES.has(file.type);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      type,
      quality,
    );
  });
}

/**
 * Turn a pasted/dropped image blob into a base64 attachment ready to send
 * to the agent. Downscales large screenshots and falls back to JPEG when
 * the PNG version would exceed Anthropic's per-image limit.
 */
export async function prepareImageAttachment(file: File | Blob): Promise<ImageAttachment> {
  if (!SUPPORTED_IMAGE_MIMES.has(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
  }

  const rawDataUrl = await blobToDataUrl(file);
  const rawBase64 = rawDataUrl.split(",")[1] ?? "";

  // If it's already small enough and not oversized, keep it as-is (preserves
  // GIF frames and PNG transparency for the common case).
  if (rawBase64.length <= MAX_BASE64_BYTES) {
    const img = await loadImage(rawDataUrl).catch(() => null);
    if (!img || (img.naturalWidth <= MAX_DIMENSION && img.naturalHeight <= MAX_DIMENSION)) {
      return {
        id: crypto.randomUUID(),
        media_type: file.type as ImageAttachment["media_type"],
        data: rawBase64,
        dataUrl: rawDataUrl,
        sizeBytes: file.size,
      };
    }
  }

  // Downscale via canvas.
  const img = await loadImage(rawDataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, w, h);

  // Try PNG first; if still too big, drop to JPEG.
  let outType: ImageAttachment["media_type"] = "image/png";
  let blob = await canvasToBlob(canvas, "image/png");
  if (blob.size > MAX_BASE64_BYTES * 0.75) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
    outType = "image/jpeg";
  }
  const outUrl = await blobToDataUrl(blob);
  const outBase64 = outUrl.split(",")[1] ?? "";

  return {
    id: crypto.randomUUID(),
    media_type: outType,
    data: outBase64,
    dataUrl: outUrl,
    sizeBytes: blob.size,
  };
}

/** Extract image files from a clipboard DataTransferItemList or a FileList. */
export function extractImageBlobs(list: DataTransferItemList | FileList | null): File[] {
  if (!list) return [];
  const out: File[] = [];
  // DataTransferItemList has `.kind`; FileList doesn't.
  const first = (list as unknown as { [n: number]: unknown })[0] as
    | { kind?: string }
    | undefined;
  if (first && typeof first === "object" && "kind" in first) {
    const items = list as DataTransferItemList;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f && SUPPORTED_IMAGE_MIMES.has(f.type)) out.push(f);
      }
    }
    return out;
  }
  const files = list as FileList;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (SUPPORTED_IMAGE_MIMES.has(f.type)) out.push(f);
  }
  return out;
}

