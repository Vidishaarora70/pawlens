import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartColumn } from "lucide-react";
import { api } from "../lib/api";
import { useTheme } from "../lib/context";
import { pct } from "../lib/image";
import type { ModelMetrics } from "../lib/types";
import { Badge, Empty, ErrorNote, PageTitle, Segmented } from "../components/ui";

const NAMES: Record<string, string> = {
  species_custom_cnn: "Custom CNN",
  species_mobilenetv2: "MobileNetV2",
  breed_efficientnetb0: "EfficientNetB0 (breeds)",
  gate_mobilenetv2_imagenet: "Pet Gate (ImageNet)",
};
const nice = (m: string) => NAMES[m] ?? m;
const fmtParams = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : `${Math.round(n / 1e3)} K`);

function useChartColors() {
  const { dark } = useTheme();
  return { axis: dark ? "#A3A7C2" : "#5A5F7D", grid: dark ? "#2A3052" : "#E1E3EE", tip: dark ? "#171B31" : "#FFFFFF" };
}

export default function ModelLab() {
  const [models, setModels] = useState<ModelMetrics[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.models().then(setModels).catch((e) => setError(e.message)); }, []);

  const ORDER = ["species_mobilenetv2", "species_custom_cnn", "breed_efficientnetb0"];
  const rank = (m: ModelMetrics) => (ORDER.indexOf(m.model) + 1 || 99);
  const sorted = useMemo(() => [...(models ?? [])].sort((a, b) => (a.task === "gate" ? 100 : rank(a)) - (b.task === "gate" ? 100 : rank(b))), [models]);
  const trained = useMemo(() => sorted.filter((m) => m.task !== "gate"), [sorted]);
  const [sel, setSel] = useState<string>("");
  useEffect(() => { if (trained.length && !trained.find((m) => m.model === sel)) setSel(trained[0].model); }, [trained, sel]);

  if (error) return <section><PageTitle title="Model lab" /><ErrorNote>{error}</ErrorNote></section>;
  if (!models) return <section><PageTitle title="Model lab" /><div className="h-64 animate-pulse rounded-3xl bg-surface-2" /></section>;

  const gate = models.find((m) => m.task === "gate");
  const cnn = trained.find((m) => m.model === "species_custom_cnn");
  const mnv2 = trained.find((m) => m.model === "species_mobilenetv2");
  const current = trained.find((m) => m.model === sel);

  return (
    <section>
      <PageTitle title="Model lab">Real test results from training, read from the metrics files the training scripts write. Nothing here is typed in by hand.</PageTitle>

      {!trained.length ? (
        <Empty icon={<ChartColumn className="size-6" />} title="No trained models yet">
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-left">
            <li>Open <code className="num text-xs">training/PawLens_Training.ipynb</code> in Google Colab with a GPU.</li>
            <li>Run all cells and download <code className="num text-xs">pawlens_models.zip</code>.</li>
            <li>Unzip it into <code className="num text-xs">backend/models</code> and restart the server.</li>
          </ol>
          {gate && <p className="mt-4">Right now only the Pet Gate is running ({fmtParams(gate.params)} parameters, about {gate.runtime_ms} ms per photo here).</p>}
        </Empty>
      ) : (
        <div className="space-y-10">
          {cnn && mnv2 && <Comparison a={cnn} b={mnv2} />}

          <div>
            <h2 className="mb-3 text-2xl font-bold">All models</h2>
            <div className="overflow-x-auto rounded-3xl ring-1 ring-line">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface-2 text-left text-muted">
                  <tr>
                    {["Model", "Job", "Test accuracy", "F1", "Top-3", "Parameters", "Speed here"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {sorted.map((m) => (
                    <tr key={m.model}>
                      <td className="px-4 py-3 font-semibold">{nice(m.model)} {!m.loaded && <Badge tone="plain">not loaded</Badge>}</td>
                      <td className="px-4 py-3 text-muted">{m.task === "gate" ? "Reject non-pets" : m.task === "breed" ? "37 breeds" : "Cat vs dog"}</td>
                      <td className="num px-4 py-3">{pct(m.test_accuracy, 1)}</td>
                      <td className="num px-4 py-3">{m.f1 != null ? m.f1.toFixed(3) : "–"}</td>
                      <td className="num px-4 py-3">{pct(m.top3_accuracy ?? null, 1)}</td>
                      <td className="num px-4 py-3">{fmtParams(m.params)}</td>
                      <td className="num px-4 py-3">{m.runtime_ms != null ? `${m.runtime_ms} ms` : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">Speed is measured on this server when it starts, for one photo. The ImageNet gate is used as-is, so it has no test score here.</p>
          </div>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">Training details</h2>
              <Segmented label="Model" value={sel} onChange={setSel} options={trained.map((m) => ({ value: m.model, label: nice(m.model) }))} />
            </div>
            {current && <Details m={current} />}
          </div>
        </div>
      )}
    </section>
  );
}

function Comparison({ a, b }: { a: ModelMetrics; b: ModelMetrics }) {
  const c = useChartColors();
  const data = [
    { k: "Accuracy", a: a.test_accuracy, b: b.test_accuracy },
    { k: "Precision", a: a.precision, b: b.precision },
    { k: "Recall", a: a.recall, b: b.recall },
    { k: "F1", a: a.f1, b: b.f1 },
  ].map((d) => ({ k: d.k, cnn: +((d.a ?? 0) * 100).toFixed(1), mnv2: +((d.b ?? 0) * 100).toFixed(1) }));
  const gain = ((b.test_accuracy ?? 0) - (a.test_accuracy ?? 0)) * 100;

  return (
    <div className="grid gap-6 rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <h2 className="text-2xl font-bold">Built from scratch vs transfer learning</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Both models learn cat vs dog from the same images. MobileNetV2 starts from what it already learned on ImageNet{" "}
          {Math.abs(gain) < 0.05 ? "and scores the same on accuracy here." : (
            <>and scores <strong className="num text-ink">{Math.abs(gain).toFixed(1)} points</strong> {gain > 0 ? "higher" : "lower"} on accuracy.</>
          )}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          {[a, b].map((m) => (
            <div key={m.model}>
              <dt className="font-semibold">{nice(m.model)}</dt>
              <dd className="num mt-1 text-muted">{fmtParams(m.params)} params</dd>
              <dd className="num text-muted">{m.runtime_ms ?? m.avg_inference_ms_cpu} ms / photo</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={4}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="k" tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.grid }} />
            <YAxis domain={[0, 100]} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
            <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} contentStyle={{ background: c.tip, border: `1px solid ${c.grid}`, borderRadius: 12, fontSize: 12 }} formatter={(v) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="cnn" name="Custom CNN" fill="#9B5DE5" radius={[6, 6, 0, 0]} />
            <Bar dataKey="mnv2" name="MobileNetV2" fill="#FF7A45" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Details({ m }: { m: ModelMetrics }) {
  const c = useChartColors();
  const h = m.history ?? {};
  const curve = (h.accuracy ?? []).map((_, i) => ({
    epoch: i + 1,
    train: +(h.accuracy[i] * 100).toFixed(1),
    val: h.val_accuracy?.[i] != null ? +(h.val_accuracy[i] * 100).toFixed(1) : null,
    loss: h.loss?.[i], vloss: h.val_loss?.[i],
  }));
  const tip = { background: c.tip, border: `1px solid ${c.grid}`, borderRadius: 12, fontSize: 12 };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <figure className="rounded-3xl bg-surface p-5 ring-1 ring-line">
        <figcaption className="mb-1 font-display text-lg font-bold">Accuracy per epoch</figcaption>
        <p className="mb-3 text-xs text-muted">{m.description}. Validation is data the model never trains on.</p>
        {curve.length ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="epoch" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} />
                <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="train" name="Training" stroke="#9B5DE5" strokeWidth={2} dot={false} />
                <Line dataKey="val" name="Validation" stroke="#FF7A45" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="py-10 text-center text-sm text-muted">No training history in this metrics file.</p>}
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-muted">Test accuracy</dt><dd className="num text-lg font-semibold">{pct(m.test_accuracy, 1)}</dd></div>
          {m.top3_accuracy != null
            ? <div><dt className="text-muted">Top-3</dt><dd className="num text-lg font-semibold">{pct(m.top3_accuracy, 1)}</dd></div>
            : <div><dt className="text-muted">F1</dt><dd className="num text-lg font-semibold">{m.f1?.toFixed(3) ?? "–"}</dd></div>}
          <div><dt className="text-muted">Test photos</dt><dd className="num text-lg font-semibold">{m.test_samples?.toLocaleString() ?? "–"}</dd></div>
        </dl>
      </figure>
      {m.confusion_matrix && m.labels && <Confusion cm={m.confusion_matrix} labels={m.labels} />}
    </div>
  );
}

function Confusion({ cm, labels }: { cm: number[][]; labels: string[] }) {
  const small = labels.length <= 4;
  const rows = cm.map((r) => { const t = r.reduce((a, b) => a + b, 0) || 1; return r.map((v) => v / t); });

  return (
    <figure className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <figcaption className="mb-1 font-display text-lg font-bold">Confusion matrix</figcaption>
      <p className="mb-4 text-xs text-muted">Rows are the true answer, columns are what the model said. A strong diagonal means few mistakes.</p>
      {small ? (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `auto repeat(${labels.length}, minmax(0,1fr))` }}>
          <span />
          {labels.map((l) => <span key={l} className="pb-1 text-center text-xs text-muted">said {l}</span>)}
          {cm.map((r, i) => (
            <div key={i} className="contents">
              <span className="self-center pr-2 text-xs text-muted">is {labels[i]}</span>
              {r.map((v, j) => (
                <div key={j} className="grid aspect-[4/3] place-items-center rounded-2xl" style={{ background: `rgba(255,122,69,${0.08 + rows[i][j] * 0.8})` }}>
                  <span className="num text-lg font-semibold">{v.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid w-max gap-px" style={{ gridTemplateColumns: `repeat(${labels.length}, 12px)` }}>
            {cm.flatMap((r, i) => r.map((v, j) => (
              <div key={`${i}-${j}`} className="size-3 rounded-[2px]" title={`True: ${labels[i]}\nPredicted: ${labels[j]}\nPhotos: ${v}`}
                style={{ background: rows[i][j] > 0 ? `rgba(255,122,69,${0.12 + rows[i][j] * 0.88})` : "var(--surface-2)" }} />
            )))}
          </div>
          <p className="mt-3 text-xs text-muted">Hover a square to see the breeds. Mistakes off the diagonal are usually between similar-looking breeds.</p>
        </div>
      )}
    </figure>
  );
}
