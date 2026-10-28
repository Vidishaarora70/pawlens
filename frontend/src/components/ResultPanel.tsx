import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Flag, SearchX, TriangleAlert } from "lucide-react";
import type { PredictionResult } from "../lib/types";
import { download, pct, resultCard } from "../lib/image";
import { useToast } from "../lib/context";
import { ConfidenceRing } from "./ConfidenceRing";
import { FeedbackDialog } from "./FeedbackDialog";
import { Badge, Button } from "./ui";

const MODEL_NAMES: Record<string, string> = {
  mobilenetv2: "MobileNetV2",
  custom_cnn: "Custom CNN",
  imagenet_gate: "ImageNet model",
  breed: "Breed model",
  gate: "ImageNet model",
};
export const modelName = (m: string) => MODEL_NAMES[m] ?? m;

const fade = (i: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 * i, duration: 0.35 } });

export function ResultPanel({ result, photo, file }: { result: PredictionResult; photo: string; file: Blob }) {
  const toast = useToast();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const r = result;
  const isCat = r.species === "cat";
  const uncertain = r.is_pet && (!r.agreement || r.models_disagree);

  const saveCard = async () => {
    try {
      download(await resultCard(photo, r), `pawlens-${r.is_pet ? r.species : "not-a-pet"}.png`);
      toast("Result card saved");
    } catch {
      toast("Couldn't create the result card.", "error");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!r.is_pet ? (
        <motion.div {...fade(0)} className="rounded-3xl bg-surface p-6 ring-1 ring-line">
          <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-gate/15 text-gate-ink">
            <SearchX className="size-6" />
          </div>
          <h2 className="text-3xl font-bold">No cat or dog found</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            The pet check gives this photo a <span className="num text-ink">{pct(r.gate_confidence)}</span> chance of showing a cat or dog, which is too low to name one.
            If there is a pet in it, try a photo where the animal fills more of the frame.
          </p>
        </motion.div>
      ) : (
        <>
          <motion.div {...fade(0)} className="flex items-center gap-5">
            <ConfidenceRing value={r.species_confidence ?? 0} color={isCat ? "#9B5DE5" : "#FF7A45"} />
            <div className="min-w-0">
              <p className="text-sm text-muted">This looks like a</p>
              <h2 className={`text-5xl font-extrabold md:text-6xl ${isCat ? "text-cat-ink" : "text-dog-ink"}`}>{isCat ? "Cat" : "Dog"}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {uncertain && <Badge tone="warn"><TriangleAlert className="size-3.5" />Uncertain</Badge>}
                {r.demo_mode && <Badge tone="plain">Demo mode</Badge>}
              </div>
            </div>
          </motion.div>

          {uncertain && (
            <motion.p {...fade(1)} className="rounded-2xl bg-[#FFC857]/15 px-4 py-3 text-sm leading-relaxed">
              {r.models_disagree
                ? "The species models don't agree on this photo, so treat the answer with care."
                : `The breed model thinks this is more likely a ${isCat ? "dog" : "cat"} breed, so treat the answer with care.`}
            </motion.p>
          )}

          {r.breeds.length > 0 && (
            <motion.section {...fade(2)}>
              <h3 className="mb-3 text-base font-bold">{r.demo_mode ? "Closest ImageNet classes" : "Most likely breeds"}</h3>
              <ol className="space-y-3">
                {r.breeds.map((b, i) => (
                  <li key={b.name}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className={i === 0 ? "font-semibold" : "text-muted"}>{b.name}</span>
                      <span className="num text-xs text-muted">{pct(b.confidence, 1)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <motion.div
                        className={`h-full rounded-full ${isCat ? "bg-cat" : "bg-dog"}`}
                        style={{ opacity: 1 - i * 0.25 }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(2, b.confidence * 100)}%` }}
                        transition={{ delay: 0.25 + i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </motion.section>
          )}

          {r.votes.length > 1 && (
            <motion.section {...fade(3)}>
              <h3 className="mb-2 text-base font-bold">What each model says</h3>
              <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
                {r.votes.map((v) => (
                  <li key={v.model} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span>{modelName(v.model)}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={v.species}>{v.species === "cat" ? "Cat" : "Dog"}</Badge>
                      <span className="num w-12 text-right text-xs text-muted">{pct(v.confidence)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </motion.section>
          )}
        </>
      )}

      <motion.div {...fade(4)} className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon={<Download className="size-4" />} onClick={saveCard}>Save result card</Button>
        <Button size="sm" variant="ghost" icon={<Flag className="size-4" />} onClick={() => setFeedbackOpen(true)}>Wrong answer?</Button>
        <span className="num ml-auto text-xs text-muted">{Math.round(r.inference_ms)} ms</span>
      </motion.div>

      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} file={file} result={r} />
    </div>
  );
}
