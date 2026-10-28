import { motion } from "framer-motion";
import { useHealth } from "../lib/context";

const PIPELINE = [
  { t: "Pet check", d: "MobileNetV2 trained on ImageNet adds up the chance of every cat and dog class. Too low, and PawLens says no pet was found.", c: "#2EC4B6" },
  { t: "Cat or dog", d: "Our MobileNetV2, retrained on about 23,000 cat and dog photos, makes the call. The custom CNN gives a second opinion.", c: "#FF7A45" },
  { t: "Breed", d: "EfficientNetB0, fine-tuned on the Oxford-IIIT Pet dataset, ranks 37 breeds. If it disagrees with the species model, the answer is marked uncertain.", c: "#9B5DE5" },
  { t: "Heatmap", d: "Grad-CAM follows the model's gradients back to its last layer of image features, showing which areas pushed the answer most.", c: "#3A86FF" },
];

const TEAM = [
  ["Anushka Srivastava", "202310101150121"],
  ["Shikha Verma", "202310101150132"],
  ["Vidisha Arora", "202310101150160"],
];

const REFS = [
  "Parkhi, Vedaldi, Zisserman & Jawahar. Cats and Dogs. CVPR 2012 (Oxford-IIIT Pet dataset).",
  "Elson, Douceur, Howell & Saul. Asirra: a CAPTCHA that exploits interest-aligned manual image categorization. ACM CCS 2007 (cats vs dogs images).",
  "Sandler et al. MobileNetV2: Inverted Residuals and Linear Bottlenecks. CVPR 2018.",
  "Tan & Le. EfficientNet: Rethinking Model Scaling for Convolutional Neural Networks. ICML 2019.",
  "Selvaraju et al. Grad-CAM: Visual Explanations from Deep Networks via Gradient-based Localization. ICCV 2017.",
];

export default function About() {
  const { health } = useHealth();
  return (
    <section className="max-w-4xl">
      <h1 className="text-4xl font-extrabold md:text-5xl">How PawLens decides</h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted">
        Most cat-vs-dog classifiers must answer “cat” or “dog”, even for a photo of a car, and can't show why. PawLens checks first, explains itself, and says when it isn't sure.
      </p>

      <ol className="relative mt-10 space-y-8 border-l-2 border-line pl-8">
        {PIPELINE.map((s, i) => (
          <motion.li key={s.t} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: i * 0.06 }} className="relative">
            <span className="absolute -left-[43px] grid size-7 place-items-center rounded-full text-xs font-bold text-night" style={{ background: s.c }}>{i + 1}</span>
            <h2 className="text-2xl font-bold">{s.t}</h2>
            <p className="mt-1.5 max-w-2xl leading-relaxed text-muted">{s.d}</p>
          </motion.li>
        ))}
      </ol>

      <div className="mt-14 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">Team</h2>
          <ul className="mt-3 space-y-2">
            {TEAM.map(([n, r]) => (
              <li key={r} className="flex justify-between gap-3 border-b border-line pb-2 text-sm">
                <span className="font-medium">{n}</span>
                <span className="num text-muted">{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">B.Tech CSE, Data Science and Artificial Intelligence. Project-II, session 2026–27.</p>
        </div>
        <div>
          <h2 className="text-2xl font-bold">Built with</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            TensorFlow and Keras for the models, trained on Google Colab. FastAPI serves them. The app is React with TypeScript, Tailwind CSS, Framer Motion and Recharts.
          </p>
          {health && (
            <p className="mt-3 text-sm text-muted">
              Running now: <span className="text-ink">{health.models_loaded.length} models</span>, pet threshold <span className="num text-ink">{Math.round(health.gate_threshold * 100)}%</span>, version {health.version}.
            </p>
          )}
        </div>
      </div>

      <div className="mt-14">
        <h2 className="text-2xl font-bold">References</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
          {REFS.map((r) => <li key={r}>{r}</li>)}
        </ol>
      </div>
    </section>
  );
}
