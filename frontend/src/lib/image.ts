import type { PredictionResult } from "./types";

export const ACCEPT = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] };

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image."));
    img.src = src;
  });
}

/** Small square JPEG data URL for the history list. */
export async function makeThumb(src: string, size = 128): Promise<string> {
  const img = await loadImage(src);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.75);
}

export const pct = (v: number | null | undefined, digits = 0) =>
  v == null ? "–" : `${(v * 100).toFixed(digits)}%`;

export const label = (r: PredictionResult) =>
  !r.is_pet ? "Not a pet" : r.species === "cat" ? "Cat" : "Dog";

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Draws a shareable result card (1080 x 1350 PNG). */
export async function resultCard(photoSrc: string, r: PredictionResult): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0F1222";
  ctx.fillRect(0, 0, W, H);

  const img = await loadImage(photoSrc);
  const box = { x: 60, y: 60, w: 960, h: 820 };
  const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight);
  const sw = box.w / scale, sh = box.h / scale;
  ctx.save();
  roundRect(ctx, box.x, box.y, box.w, box.h, 36);
  ctx.clip();
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, box.x, box.y, box.w, box.h);
  ctx.restore();

  const accent = !r.is_pet ? "#2EC4B6" : r.species === "cat" ? "#9B5DE5" : "#FF7A45";
  ctx.fillStyle = accent;
  ctx.font = "800 120px 'Bricolage Grotesque', sans-serif";
  ctx.fillText(label(r), 60, 1030);
  ctx.fillStyle = "#ECEDF5";
  ctx.font = "500 44px Inter, sans-serif";
  ctx.fillText(r.is_pet ? `${pct(r.species_confidence)} confident` : `Pet likelihood ${pct(r.gate_confidence)}`, 60, 1100);

  ctx.font = "400 38px Inter, sans-serif";
  ctx.fillStyle = "#A3A7C2";
  r.breeds.slice(0, 3).forEach((b, i) => ctx.fillText(`${b.name}  ${pct(b.confidence)}`, 60, 1180 + i * 52));

  ctx.textAlign = "right";
  ctx.fillStyle = "#ECEDF5";
  ctx.font = "700 40px 'Bricolage Grotesque', sans-serif";
  ctx.fillText("PawLens", W - 60, H - 60);

  return new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Escape a value for CSV. */
export const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
