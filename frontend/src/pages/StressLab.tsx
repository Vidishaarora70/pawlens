import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FlaskConical, RotateCcw, ScanSearch } from "lucide-react";
import { api } from "../lib/api";
import { useTheme } from "../lib/context";
import { loadImage, pct } from "../lib/image";
import type { PredictionResult, StressResult, StressTest } from "../lib/types";
import { ConfidenceRing } from "../components/ConfidenceRing";
import { UploadZone, usePasteImage } from "../components/UploadZone";
import { Badge, Button, ErrorNote, PageTitle } from "../components/ui";

type Edits = { blur: number; brightness: number; rotation: number; noise: number };
const NONE: Edits = { blur: 0, brightness: 100, rotation: 0, noise: 0 };

const TITLES: Record<string, { title: string; x: (v: number) => string }> = {
  blur: { title: "Blur", x: (v) => `${v}px` },
  brightness: { title: "Low light", x: (v) => `${v}%` },
  rotation: { title: "Rotation", x: (v) => `${v}°` },
  noise: { title: "Noise", x: (v) => `${v}` },
};

function verdict(score: number) {
  if (score >= 80) return "Very robust. The answer holds even when the photo gets much worse.";
  if (score >= 55) return "Fairly robust. Small changes are fine, heavy ones start to confuse it.";
  return "Fragile. The answer changes quickly when the photo gets worse.";
}

/** Renders the photo with the current edits onto a canvas (same look as the preview). */
async function renderEdited(src: string, e: Edits): Promise<Blob> {
  const img = await loadImage(src);
  const scale = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  const rad = (e.rotation * Math.PI) / 180;
  const cw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const ch = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
  const c = document.createElement("canvas");
  c.width = Math.round(cw);
  c.height = Math.round(ch);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(rad);
  ctx.filter = `blur(${e.blur * scale * (Math.max(img.naturalWidth, img.naturalHeight) / 224) }px) brightness(${e.brightness}%)`;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  if (e.noise > 0) {
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      // Box-Muller gaussian noise, same idea as the server's stress test
      const g = Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random()) * e.noise;
      d.data[i] += g; d.data[i + 1] += g; d.data[i + 2] += g;
    }
    ctx.putImageData(d, 0, 0);
  }
  return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.9));
}

export default function StressLab() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [edits, setEdits] = useState<Edits>(NONE);
  const [check, setCheck] = useState<PredictionResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<StressResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback((f: File) => { setFile(f); setEdits(NONE); setCheck(null); setResult(null); setError(null); }, []);
  usePasteImage(pick);

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const runTest = async () => {
    if (!file) return;
    setRunning(true);
    setError(null);
    try { setResult(await api.stress(file)); } catch (e) { setError((e as Error).message); } finally { setRunning(false); }
  };

  const checkEdited = async () => {
    setChecking(true);
    setError(null);
    try { setCheck(await api.predict(await renderEdited(url, edits), { gradcam: false, name: "edited.jpg" })); }
    catch (e) { setError((e as Error).message); }
    finally { setChecking(false); }
  };

  if (!file) {
    return (
      <section>
        <PageTitle title="Stress test lab">
          Real photos are blurry, dark, tilted or grainy. Add one pet photo and see how far you can push it before PawLens changes its answer.
        </PageTitle>
        <UploadZone onFiles={(f) => pick(f[0])} title="Drop a cat or dog photo" />
      </section>
    );
  }

  const sliders: { key: keyof Edits; label: string; min: number; max: number; unit: string }[] = [
    { key: "blur", label: "Blur", min: 0, max: 8, unit: "px" },
    { key: "brightness", label: "Brightness", min: 10, max: 160, unit: "%" },
    { key: "rotation", label: "Rotation", min: 0, max: 180, unit: "°" },
    { key: "noise", label: "Noise", min: 0, max: 75, unit: "" },
  ];

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold md:text-4xl">Stress test lab</h1>
        <UploadZone compact onFiles={(f) => pick(f[0])} title="Use another photo" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
        <div>
          <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[24px] bg-[#808080] ring-1 ring-line">
            <img
              src={url}
              alt="Your photo with the edits applied"
              className="max-h-full max-w-full object-contain transition-[filter,transform] duration-150"
              style={{ filter: `blur(${edits.blur * 2}px) brightness(${edits.brightness}%)`, transform: `rotate(${edits.rotation}deg)` }}
            />
            {edits.noise > 0 && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full mix-blend-overlay" style={{ opacity: Math.min(0.9, edits.noise / 60) }} aria-hidden>
                <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /></filter>
                <rect width="100%" height="100%" filter="url(#grain)" />
              </svg>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-xl font-bold">Try it by hand</h2>
            <p className="mt-1 text-sm text-muted">Move the sliders, then check what PawLens says about the edited photo.</p>
          </div>
          {sliders.map((s) => (
            <label key={s.key} className="block">
              <span className="mb-1 flex justify-between text-sm"><span>{s.label}</span><span className="num text-muted">{edits[s.key]}{s.unit}</span></span>
              <input type="range" className="slider" min={s.min} max={s.max} value={edits[s.key]} onChange={(e) => setEdits({ ...edits, [s.key]: Number(e.target.value) })} />
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={<ScanSearch className="size-4" />} onClick={checkEdited} disabled={checking}>{checking ? "Checking…" : "Check edited photo"}</Button>
            <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => { setEdits(NONE); setCheck(null); }}>Reset</Button>
            {check && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm">
                <Badge tone={!check.is_pet ? "gate" : check.species!}>{!check.is_pet ? "Not a pet" : check.species === "cat" ? "Cat" : "Dog"}</Badge>
                {check.is_pet && <span className="num text-muted">{pct(check.species_confidence)}</span>}
              </motion.span>
            )}
          </div>

          <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
            <h2 className="text-xl font-bold">Full stress test</h2>
            <p className="mt-1 text-sm text-muted">Runs 24 versions of the photo (4 kinds of damage, 6 levels each) and scores how well the answer survives.</p>
            <Button className="mt-4" variant="primary" icon={<FlaskConical className="size-4" />} onClick={runTest} disabled={running}>
              {running ? "Running 24 checks…" : "Run stress test"}
            </Button>
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
        </div>
      </div>

      {result && <StressReport r={result} />}
    </section>
  );
}

function StressReport({ r }: { r: StressResult }) {
  const color = r.base_label === "cat" ? "#9B5DE5" : "#FF7A45";
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <ConfidenceRing value={r.robustness_score / 100} color={color} size={104} label="robustness" />
        <div className="max-w-xl">
          <h2 className="text-3xl font-bold">Robustness score <span className="num">{Math.round(r.robustness_score)}</span></h2>
          <p className="mt-1 text-[15px] text-muted">
            {verdict(r.robustness_score)} Original answer: <strong className="text-ink">{r.base_label === "cat" ? "Cat" : "Dog"}</strong> at <span className="num">{pct(r.base_confidence)}</span>.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {r.tests.map((t) => <StressChart key={t.name} t={t} color={color} label={r.base_label} />)}
      </div>
    </motion.div>
  );
}

function StressChart({ t, color, label }: { t: StressTest; color: string; label: string }) {
  const { dark } = useTheme();
  const meta = TITLES[t.name];
  const data = useMemo(() => t.levels.map((lv, i) => ({ level: meta.x(lv), conf: Math.round(t.confidence[i] * 100), ok: t.still_correct[i] })), [t, meta]);
  const axis = dark ? "#A3A7C2" : "#5A5F7D";
  const grid = dark ? "#2A3052" : "#E1E3EE";
  return (
    <figure className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-bold">{meta.title}</span>
        <span className="text-xs text-muted">
          {t.label_flipped_at == null ? `Still “${label}” at every level` : `Answer changes at ${meta.x(t.label_flipped_at)}`}
        </span>
      </figcaption>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="level" tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: grid }} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
            <Tooltip
              contentStyle={{ background: dark ? "#171B31" : "#fff", border: `1px solid ${grid}`, borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: axis }}
              formatter={(v) => [`${v}%`, `Confidence in “${label}”`]}
            />
            <ReferenceLine y={50} stroke={axis} strokeDasharray="4 4" />
            {t.label_flipped_at != null && <ReferenceLine x={meta.x(t.label_flipped_at)} stroke="#E63946" strokeDasharray="3 3" />}
            <Line type="monotone" dataKey="conf" stroke={color} strokeWidth={2.5} dot={{ r: 3.5, fill: color }} isAnimationActive />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
