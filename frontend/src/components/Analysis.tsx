import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { useHealth } from "../lib/context";
import { makeThumb } from "../lib/image";
import { history } from "../lib/storage";
import type { PredictionResult } from "../lib/types";
import { HeatmapSlider } from "./HeatmapSlider";
import { modelName, ResultPanel } from "./ResultPanel";
import { ErrorNote, Segmented } from "./ui";

/** Photo + heatmap on one side, the answer on the other. Runs the prediction itself. */
export function Analysis({ file, saveToHistory = true }: { file: File | Blob; saveToHistory?: boolean }) {
  const { health } = useHealth();
  const [url, setUrl] = useState<string>("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [camModel, setCamModel] = useState<string | undefined>(undefined);
  const saved = useRef(false);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    saved.current = false;
    setCamModel(undefined);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    api.predict(file, { camModel, signal: ctrl.signal })
      .then(async (r) => {
        setResult(r);
        if (saveToHistory && !saved.current) {
          saved.current = true;
          const src = URL.createObjectURL(file);
          try {
            history.add({
              id: r.id, at: Date.now(), thumb: await makeThumb(src), is_pet: r.is_pet,
              species: r.species, confidence: r.species_confidence, breed: r.breeds[0]?.name ?? null,
              uncertain: r.is_pet && (!r.agreement || r.models_disagree),
            });
          } finally {
            URL.revokeObjectURL(src);
          }
        }
      })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [file, camModel, saveToHistory]);

  const camOptions = (health?.cam_models ?? []).filter((m) => m !== "gate");
  const current = result?.cam_model ?? camModel;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col gap-3">
        {url && <HeatmapSlider photo={url} heatmap={loading ? null : result?.heatmap_png} scanning={loading} alt="Your photo" />}
        {result?.is_pet && camOptions.length > 1 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">Explain with</span>
            <Segmented
              label="Heatmap model"
              value={current ?? camOptions[0]}
              onChange={(v) => setCamModel(v)}
              options={camOptions.map((m) => ({ value: m, label: modelName(m) }))}
            />
          </div>
        )}
        {result?.is_pet && result.heatmap_png && (
          <p className="text-sm leading-relaxed text-muted">
            Drag the handle across the photo. Red and yellow areas mattered most to the answer; blue areas barely mattered.
          </p>
        )}
      </div>

      <div className="min-w-0">
        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : loading && !result ? (
          <PanelSkeleton />
        ) : result && url ? (
          <motion.div key={result.id} initial={{ opacity: 0 }} animate={{ opacity: loading ? 0.5 : 1 }}>
            <ResultPanel result={result} photo={url} file={file} />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-label="Analysing photo" role="status">
      <div className="flex items-center gap-5">
        <div className="size-24 rounded-full bg-surface-2" />
        <div className="flex-1 space-y-3">
          <div className="h-3 w-24 rounded bg-surface-2" />
          <div className="h-12 w-40 rounded-xl bg-surface-2" />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-1/3 rounded bg-surface-2" />
          <div className="h-2 rounded bg-surface-2" />
        </div>
      ))}
      <p className="text-sm text-muted">Checking for a pet, naming it, and working out where it looked…</p>
    </div>
  );
}
