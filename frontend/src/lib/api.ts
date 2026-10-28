import type { BatchResult, Health, ModelMetrics, PredictionResult, StressResult } from "./types";

// Empty = same origin. In dev, Vite proxies /api to the FastAPI server.
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new ApiError("Can't reach the PawLens server. Start the backend and try again.", 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((d: { msg: string }) => d.msg).join(", ");
    } catch { /* not JSON */ }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

function form(file: Blob, name = "image.jpg") {
  const fd = new FormData();
  fd.append("file", file, name);
  return fd;
}

export const api = {
  health: () => request<Health>("/api/health"),

  predict: (file: Blob, opts: { gradcam?: boolean; camModel?: string; name?: string; signal?: AbortSignal } = {}) => {
    const q = new URLSearchParams({ gradcam: String(opts.gradcam ?? true) });
    if (opts.camModel) q.set("cam_model", opts.camModel);
    return request<PredictionResult>(`/api/predict?${q}`, {
      method: "POST",
      body: form(file, opts.name ?? (file instanceof File ? file.name : "image.jpg")),
      signal: opts.signal,
    });
  },

  batch: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f, f.name));
    return request<BatchResult>("/api/predict/batch", { method: "POST", body: fd });
  },

  stress: (file: Blob) => request<StressResult>("/api/stress-test", { method: "POST", body: form(file) }),

  models: () => request<ModelMetrics[]>("/api/models"),

  feedback: (file: Blob, correctLabel: "cat" | "dog" | "not_pet", breed: string, predicted: string) => {
    const fd = form(file);
    fd.append("correct_label", correctLabel);
    fd.append("breed", breed);
    fd.append("predicted", predicted);
    return request<{ saved: boolean }>("/api/feedback", { method: "POST", body: fd });
  },
};
