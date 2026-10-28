import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { History as HistoryIcon, Trash2, TriangleAlert, X } from "lucide-react";
import { history } from "../lib/storage";
import { pct } from "../lib/image";
import type { HistoryItem } from "../lib/types";
import { Badge, Button, Empty, PageTitle } from "../components/ui";

const when = (t: number) => new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>(history.list);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const sync = () => setItems(history.list());
    window.addEventListener("pawlens-history", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("pawlens-history", sync); window.removeEventListener("storage", sync); };
  }, []);

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="History">Your 30 most recent single-photo results. They are kept in this browser only.</PageTitle>
        {items.length > 0 && (
          confirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Clear all history?</span>
              <Button size="sm" variant="primary" onClick={() => { history.clear(); setConfirm(false); }}>Clear history</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep it</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>Clear history</Button>
          )
        )}
      </div>

      {!items.length ? (
        <Empty icon={<HistoryIcon className="size-6" />} title="Nothing here yet" action={<Link to="/" className="inline-flex h-11 items-center rounded-full bg-dog px-5 text-sm font-semibold text-night">Classify a photo</Link>}>
          Results from the Classify and Camera pages appear here.
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {items.map((h) => (
              <motion.li key={h.id} layout exit={{ opacity: 0, scale: 0.96 }} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
                <img src={h.thumb} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={!h.is_pet ? "gate" : h.species!}>{!h.is_pet ? "Not a pet" : h.species === "cat" ? "Cat" : "Dog"}</Badge>
                    {h.is_pet && <span className="num text-xs text-muted">{pct(h.confidence)}</span>}
                    {h.uncertain && <TriangleAlert className="size-3.5" aria-label="Uncertain" />}
                  </div>
                  <p className="mt-1 truncate text-sm">{h.is_pet ? h.breed ?? "Breed unknown" : "No cat or dog found"}</p>
                  <p className="text-xs text-muted">{when(h.at)}</p>
                </div>
                <button onClick={() => history.remove(h.id)} aria-label="Remove from history" className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
                  <X className="size-4" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
