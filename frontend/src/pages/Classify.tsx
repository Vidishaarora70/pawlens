import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Analysis } from "../components/Analysis";
import { UploadZone, usePasteImage } from "../components/UploadZone";

const STEPS = [
  { t: "Checks for a pet", d: "A model trained on 1,000 everyday objects decides if a cat or dog is there at all." },
  { t: "Names it", d: "Cat or dog, plus the three most likely breeds out of 37." },
  { t: "Shows where it looked", d: "A heatmap over your photo marks the parts that drove the answer." },
];

export default function Classify() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(() => (loc.state as { file?: File } | null)?.file ?? null);

  // clear router state so a refresh doesn't reuse an old file
  useEffect(() => {
    if (loc.state) navigate(loc.pathname, { replace: true, state: null });
  }, [loc.state, loc.pathname, navigate]);

  const pick = useCallback((f: File) => setFile(f), []);
  usePasteImage(pick);

  if (!file) {
    return (
      <section className="mx-auto max-w-3xl">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-[44px] leading-[1.02] font-extrabold md:text-7xl"
        >
          Cat, dog,
          <br />
          or neither?
        </motion.h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted md:text-lg">
          Give PawLens a photo. It tells you what's in it, guesses the breed, and shows you which part of the picture it based that on.
        </p>
        <div className="mt-8">
          <UploadZone onFiles={(f) => pick(f[0])} />
        </div>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs text-muted">{i + 1}</span>
              <div>
                <p className="font-semibold">{s.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold md:text-3xl">Result</h1>
        <UploadZone compact onFiles={(f) => pick(f[0])} />
      </div>
      <Analysis file={file} />
    </section>
  );
}
