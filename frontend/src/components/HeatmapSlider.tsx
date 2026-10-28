import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GripVertical } from "lucide-react";

type Props = { photo: string; heatmap?: string | null; scanning?: boolean; alt: string };

/**
 * Shows the photo. When a Grad-CAM heatmap exists, a handle lets the user
 * drag between the photo (left) and "where the model looked" (right).
 * The range input underneath keeps it usable with a keyboard.
 */
export function HeatmapSlider({ photo, heatmap, scanning, alt }: Props) {
  const [pos, setPos] = useState(50);
  const reduce = useReducedMotion();

  return (
    <figure className="relative overflow-hidden rounded-[24px] bg-surface-2 ring-1 ring-line">
      <img src={photo} alt={alt} className="block max-h-[62vh] w-full object-contain" draggable={false} />

      {heatmap && (
        <>
          <motion.img
            src={heatmap}
            alt="Heatmap of where the model looked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
            draggable={false}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Compare photo and heatmap"
            className="compare-range absolute inset-0 h-full w-full"
          />
          <div aria-hidden className="compare-handle pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" style={{ left: `${pos}%` }}>
            <div className="absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-night shadow-lg">
              <GripVertical className="size-4" />
            </div>
          </div>
          <figcaption className="pointer-events-none absolute bottom-3 inset-x-3 flex justify-between text-xs font-semibold text-white">
            <span className="rounded-full bg-black/55 px-2.5 py-1 backdrop-blur">Photo</span>
            <span className="rounded-full bg-black/55 px-2.5 py-1 backdrop-blur">Where it looked</span>
          </figcaption>
        </>
      )}

      {scanning && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-0 bg-night/25" />
          {!reduce && (
            <motion.div
              className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-dog/45 to-transparent"
              initial={{ top: "-20%" }}
              animate={{ top: ["-20%", "100%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
      )}
    </figure>
  );
}
