import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import JSZip from "jszip";
import { FileArchive, FileSpreadsheet, ScanSearch, Trash2, TriangleAlert } from "lucide-react";
import { api } from "../lib/api";
import { useHealth, useToast } from "../lib/context";
import { csvCell, download, label, pct } from "../lib/image";
import type { PredictionResult } from "../lib/types";
import { UploadZone } from "../components/UploadZone";
import { Badge, Button, ErrorNote, PageTitle, Segmented } from "../components/ui";

type Item = { file: File; url: string; result?: PredictionResult };
type Filter = "all" | "cat" | "dog" | "other" | "uncertain";
type Sort = "order" | "high" | "low";
const CHUNK = 10;

const isUncertain = (r?: PredictionResult) => !!r && r.is_pet && (!r.agreement || r.models_disagree);
const bucket = (r?: PredictionResult) => (!r ? null : !r.is_pet ? "other" : r.species!);

export default function Batch() {
  const { health } = useHealth();
  const toast = useToast();
  const navigate = useNavigate();
  const max = health?.max_batch ?? 50;
  const [items, setItems] = useState<Item[]>([]);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("order");

  // object URLs for thumbnails: free them when replaced or when leaving the page
  const urls = useRef<string[]>([]);
  const freeUrls = () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = []; };
  useEffect(() => freeUrls, []);

  const run = async (files: File[]) => {
    freeUrls();
    const list = files.slice(0, max).map((file) => ({ file, url: URL.createObjectURL(file) }));
    urls.current = list.map((x) => x.url);
    if (files.length > max) toast(`Only the first ${max} photos were added.`, "error");
    setItems(list);
    setDone(0);
    setError(null);
    setFilter("all");
    setRunning(true);
    const results: PredictionResult[] = [];
    try {
      for (let i = 0; i < list.length; i += CHUNK) {
        const res = await api.batch(list.slice(i, i + CHUNK).map((x) => x.file));
        results.push(...res.results);
        setItems((cur) => cur.map((it, j) => (j < results.length ? { ...it, result: results[j] } : it)));
        setDone(results.length);
      }
      toast(`Sorted ${results.length} photos`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const counts = useMemo(() => {
    const c = { all: items.length, cat: 0, dog: 0, other: 0, uncertain: 0 };
    items.forEach((i) => {
      const b = bucket(i.result);
      if (b) c[b]++;
      if (isUncertain(i.result)) c.uncertain++;
    });
    return c;
  }, [items]);

  const shown = useMemo(() => {
    let list = items.map((it, i) => ({ ...it, i }));
    if (filter === "uncertain") list = list.filter((x) => isUncertain(x.result));
    else if (filter !== "all") list = list.filter((x) => bucket(x.result) === filter);
    const conf = (x: Item) => (x.result?.is_pet ? x.result.species_confidence ?? 0 : x.result ? 1 - x.result.gate_confidence : -1);
    if (sort !== "order") list.sort((a, b) => (sort === "high" ? conf(b) - conf(a) : conf(a) - conf(b)));
    return list;
  }, [items, filter, sort]);

  const finished = items.filter((i) => i.result);

  const exportCsv = () => {
    const rows = [["file", "result", "pet_likelihood", "species", "species_confidence", "top_breed", "breed_confidence", "uncertain"]];
    finished.forEach(({ file, result: r }) =>
      rows.push([file.name, label(r!), r!.gate_confidence, r!.species ?? "", r!.species_confidence ?? "", r!.breeds[0]?.name ?? "", r!.breeds[0]?.confidence ?? "", isUncertain(r) ? "yes" : "no"].map(String)),
    );
    download(new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" }), "pawlens-results.csv");
  };

  const exportZip = async () => {
    const zip = new JSZip();
    const used = new Set<string>();
    finished.forEach(({ file, result }) => {
      const folder = { cat: "cats", dog: "dogs", other: "other" }[bucket(result)!];
      let name = `${folder}/${file.name}`;
      for (let n = 2; used.has(name); n++) name = `${folder}/${n}-${file.name}`;
      used.add(name);
      zip.file(name, file);
    });
    download(await zip.generateAsync({ type: "blob" }), "pawlens-sorted.zip");
  };

  return (
    <section>
      <PageTitle title="Batch sorter">Add up to {max} photos at once. PawLens sorts them into cats, dogs and other, and you can download the sorted set.</PageTitle>

      {items.length === 0 ? (
        <UploadZone multiple maxFiles={max} onFiles={run} title="Drop your photos here" hint={`or click to choose up to ${max} images (JPG, PNG or WEBP).`} />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Segmented
              label="Filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "cat", label: "Cats", count: counts.cat },
                { value: "dog", label: "Dogs", count: counts.dog },
                { value: "other", label: "Not a pet", count: counts.other },
                { value: "uncertain", label: "Uncertain", count: counts.uncertain },
              ]}
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-full bg-surface px-3 text-ink ring-1 ring-line">
                <option value="order">Upload order</option>
                <option value="high">Most confident first</option>
                <option value="low">Least confident first</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2 md:ml-auto">
              <Button size="sm" icon={<FileSpreadsheet className="size-4" />} onClick={exportCsv} disabled={running || !finished.length}>Download CSV</Button>
              <Button size="sm" icon={<FileArchive className="size-4" />} onClick={exportZip} disabled={running || !finished.length}>Download ZIP</Button>
              <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => { freeUrls(); setItems([]); }} disabled={running}>Start over</Button>
            </div>
          </div>

          {running && (
            <div className="mb-5" role="status" aria-live="polite">
              <div className="mb-1.5 flex justify-between text-sm"><span>Sorting photos…</span><span className="num text-muted">{done}/{items.length}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <motion.div className="h-full rounded-full bg-dog" animate={{ width: `${(done / items.length) * 100}%` }} />
              </div>
            </div>
          )}
          {error && <div className="mb-5"><ErrorNote>{error}</ErrorNote></div>}

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {shown.map(({ file, url, result: r, i }) => (
              <motion.li key={url} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 20) * 0.02 }}
                className="group overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
                <div className="relative aspect-square bg-surface-2">
                  <img src={url} alt={file.name} className="h-full w-full object-cover" loading="lazy" />
                  {!r && <div className="absolute inset-0 animate-pulse bg-surface/50" />}
                  {r && (
                    <button onClick={() => navigate("/", { state: { file } })} className="absolute inset-0 grid place-items-center bg-night/55 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100">
                      <span className="flex items-center gap-1.5"><ScanSearch className="size-4" />Explain</span>
                    </button>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  {r ? (
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={!r.is_pet ? "gate" : r.species!}>{label(r)}</Badge>
                      <span className="num text-xs text-muted">{r.is_pet ? pct(r.species_confidence) : ""}</span>
                    </div>
                  ) : <div className="h-6 w-16 rounded-full bg-surface-2" />}
                  <p className="truncate text-xs text-muted" title={r?.breeds[0]?.name ?? file.name}>
                    {isUncertain(r) && <TriangleAlert className="mr-1 inline size-3 text-ink" aria-label="Uncertain" />}
                    {r?.breeds[0]?.name ?? file.name}
                  </p>
                </div>
              </motion.li>
            ))}
          </ul>
          {!shown.length && <p className="py-10 text-center text-sm text-muted">No photos in this group.</p>}
        </>
      )}
    </section>
  );
}
