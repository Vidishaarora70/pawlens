import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../lib/context";
import { label } from "../lib/image";
import type { PredictionResult } from "../lib/types";
import { Button, cx } from "./ui";

type Choice = "cat" | "dog" | "not_pet";

export function FeedbackDialog({ open, onClose, file, result }: { open: boolean; onClose: () => void; file: Blob; result: PredictionResult }) {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [breed, setBreed] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const send = async () => {
    if (!choice) return;
    setSending(true);
    try {
      await api.feedback(file, choice, breed.trim(), label(result));
      toast("Feedback sent. It's saved for the next training run.");
      setChoice(null);
      setBreed("");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  };

  const options: { v: Choice; t: string }[] = [
    { v: "cat", t: "Cat" },
    { v: "dog", t: "Dog" },
    { v: "not_pet", t: "Not a pet" },
  ];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(92vw,420px)] rounded-3xl bg-surface p-0 text-ink shadow-2xl ring-1 ring-line backdrop:bg-night/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <h2 className="text-2xl font-bold">What is it really?</h2>
        <p className="mt-1.5 text-sm text-muted">PawLens said “{label(result)}”. Your answer and the photo are saved on the server to improve the next model.</p>
        <fieldset className="mt-5">
          <legend className="sr-only">Correct answer</legend>
          <div className="grid grid-cols-3 gap-2">
            {options.map((o) => (
              <label key={o.v} className={cx("cursor-pointer rounded-2xl px-3 py-3 text-center text-sm font-semibold ring-1 transition", choice === o.v ? "bg-dog/15 text-dog-ink ring-dog" : "ring-line hover:bg-surface-2")}>
                <input type="radio" name="fb" value={o.v} checked={choice === o.v} onChange={() => setChoice(o.v)} className="sr-only" />
                {o.t}
              </label>
            ))}
          </div>
        </fieldset>
        {choice && choice !== "not_pet" && (
          <label className="mt-4 block text-sm">
            <span className="text-muted">Breed, if you know it (optional)</span>
            <input value={breed} onChange={(e) => setBreed(e.target.value)} maxLength={60} className="mt-1.5 h-11 w-full rounded-xl bg-surface-2 px-3 text-ink outline-none ring-1 ring-line focus:ring-dog" placeholder="e.g. Beagle" />
          </label>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={send} disabled={!choice || sending}>{sending ? "Sending…" : "Send feedback"}</Button>
        </div>
      </div>
    </dialog>
  );
}
